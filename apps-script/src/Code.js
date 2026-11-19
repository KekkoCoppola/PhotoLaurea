// PhotoLaurea Web App. Runs as the owner (Francesco); config lives in Script Properties:
// EVENT_CODE, ROOT_FOLDER_ID, ALLOWED_ORIGIN.

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'BAD_REQUEST' });
  }
  try {
    var handler = ACTIONS_[req && req.action];
    if (!handler) return reply_({ ok: false, error: 'BAD_REQUEST' });
    if (req.action !== 'ping' && !isValidCode(req.code, prop_('EVENT_CODE'))) {
      return reply_({ ok: false, error: 'BAD_CODE' });
    }
    return reply_({ ok: true, data: handler(req) });
  } catch (err) {
    if (err && err.apiCode) return reply_({ ok: false, error: err.apiCode });
    console.error(err && err.stack ? err.stack : err);
    return reply_({ ok: false, error: 'SERVER' });
  }
}

var ACTIONS_ = {
  ping: function () {
    return { pong: true };
  },
  // Returning guest: an existing photo becomes the profile photo, so the selfie is asked only once.
  login: function (req) {
    var folder = resolveUserFolder_(req.name);
    var files = driveList_(
      "'" + folder.getId() + "' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
      'files(id,createdTime,mimeType,appProperties)'
    );
    var meta = driveGet_(folder.getId(), 'appProperties');
    return { name: folder.getName(), folderId: folder.getId(), avatarId: pickAvatar(files), avatarPreset: avatarPresetOf(meta) };
  },
  // Is this guest's folder still there? Never creates it: a deleted folder logs the guest out.
  whoami: function (req) {
    var folder = findGuestFolder(guestFolders_(), req.name);
    return folder ? { exists: true, name: folder.name, avatarPreset: avatarPresetOf(folder) } : { exists: false };
  },
  // The guest picks one of the site's avatars instead of a selfie (stored on their folder).
  setAvatarPreset: function (req) {
    var preset = avatarPresetOf({ appProperties: { avatarPreset: req.preset } });
    if (!preset) throw apiError_('BAD_REQUEST');
    var folder = resolveUserFolder_(req.name);
    driveUpdate_(folder.getId(), { appProperties: { avatarPreset: preset } });
    forgetGuestCaches_(folder.getName());
    return { avatarPreset: preset };
  },
  // Home: every guest's latest photos. Cached briefly so a room full of phones polling stays cheap.
  feed: function () {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('feed');
    if (hit) return JSON.parse(hit);
    var folders = guestFolders_();
    var files = [];
    for (var i = 0; i < folders.length; i += FEED_FOLDERS_PER_QUERY_) {
      var parentsQ = folders.slice(i, i + FEED_FOLDERS_PER_QUERY_)
        .map(function (f) { return "'" + f.id + "' in parents"; })
        .join(' or ');
      files = files.concat(driveList_(
        '(' + parentsQ + ") and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
        'files(id,parents,createdTime,mimeType,appProperties,description,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height))'
      ));
    }
    var data = { users: summarizeUsers(folders, files, FEED_RECENT_) };
    try {
      cache.put('feed', JSON.stringify(data), FEED_CACHE_SECONDS_);
    } catch (err) {
      // over the 100 KB cache limit: serve uncached
    }
    return data;
  },
  // One guest's whole album, newest first, with sizes for the two-column grid.
  // req.viewer: who is looking. The owner also gets the items hidden as "Solo io e Kekko".
  album: function (req) {
    var key = nameKey(req.name);
    if (!key) throw apiError_('BAD_NAME');
    var own = nameKey(req.viewer) === key;
    var cache = CacheService.getScriptCache();
    var cacheKey = albumCacheKey_(key, own);
    var hit = cache.get(cacheKey);
    if (hit) return JSON.parse(hit);
    var folder = findGuestFolder(guestFolders_(), req.name);
    var data = { name: folder ? folder.name : normalizeName(req.name), items: [] };
    if (folder) {
      data.items = albumItems(driveList_(
        "'" + folder.id + "' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
        'files(id,createdTime,mimeType,appProperties,description,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height))'
      ), own);
    }
    try {
      cache.put(cacheKey, JSON.stringify(data), FEED_CACHE_SECONDS_);
    } catch (err) {
      // over the 100 KB cache limit: serve uncached
    }
    return data;
  },
  // Owner only: "all" (default) or "private" (= Solo io e Kekko: hidden from home and others).
  setVisibility: function (req) {
    var target = ownedFile_(req);
    var visibility = req.visibility === 'private' ? 'private' : null; // null removes the property
    driveUpdate_(target.id, { appProperties: { visibility: visibility } });
    forgetGuestCaches_(target.folder.name);
    return { id: target.id, visibility: visibility || 'all' };
  },
  // Owner only: moves the file to the Drive trash (Kekko can still restore it for 30 days).
  deleteItem: function (req) {
    var target = ownedFile_(req);
    driveUpdate_(target.id, { trashed: true });
    forgetGuestCaches_(target.folder.name);
    return { id: target.id };
  },
  // Voice note bytes, base64. Drive blocks playing its files inside other sites, so the
  // app plays them from here. Only voice notes in guest folders (see isServableVoice).
  media: function (req) {
    var id = String(req.id || '');
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw apiError_('BAD_REQUEST');
    var file = driveGet_(id, 'parents,mimeType,size,appProperties');
    var parent = file && file.parents && file.parents[0] ? driveGet_(file.parents[0], 'parents') : null;
    if (!isServableVoice(file, parent, prop_('ROOT_FOLDER_ID'), MEDIA_MAX_BYTES_)) throw apiError_('BAD_REQUEST');
    var bytes = DriveApp.getFileById(id).getBlob().getBytes();
    return { mimeType: file.mimeType, data: Utilities.base64Encode(bytes) };
  },
  startUpload: function (req) {
    var folder = resolveUserFolder_(req.name);
    var size = Number(req.size);
    if (!req.fileName || !(size >= 0)) throw apiError_('BAD_REQUEST');
    // A new selfie replaces a previously chosen site avatar.
    if (req.kind === 'avatar') {
      driveUpdate_(folder.getId(), { appProperties: { avatarPreset: null } });
      forgetGuestCaches_(folder.getName());
    }
    var res = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
          'X-Upload-Content-Type': req.mimeType || 'application/octet-stream',
          'X-Upload-Content-Length': String(size),
          Origin: prop_('ALLOWED_ORIGIN'),
        },
        payload: JSON.stringify(Object.assign(
          { parents: [folder.getId()] },
          uploadMeta(req.kind, String(req.fileName), new Date(), { text: req.text, durationMs: req.durationMs })
        )),
      }
    );
    var headers = res.getAllHeaders();
    var location = headers.Location || headers.location;
    if (res.getResponseCode() !== 200 || !location) {
      console.error('startUpload failed: ' + res.getResponseCode() + ' ' + res.getContentText());
      throw apiError_('UPSTREAM');
    }
    return { uploadUrl: location };
  },
};

var FEED_RECENT_ = 4; // 3 visible cards + 1 blurred "+N" card
var FEED_CACHE_SECONDS_ = 20;
var FEED_FOLDERS_PER_QUERY_ = 40; // keeps the Drive q string well under its length limit

var MEDIA_MAX_BYTES_ = 15 * 1024 * 1024;

function albumCacheKey_(key, own) {
  return 'album:' + key + (own ? ':own' : '');
}

// The file named in req.id, checked to sit in the requester's own folder (req.name).
function ownedFile_(req) {
  var id = String(req.id || '');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw apiError_('BAD_REQUEST');
  var file = driveGet_(id, 'id,parents,trashed');
  if (!file || file.trashed || !file.parents || !file.parents[0]) throw apiError_('FORBIDDEN');
  var folder = driveGet_(file.parents[0], 'name,parents');
  if (!canManage(folder, prop_('ROOT_FOLDER_ID'), req.name)) throw apiError_('FORBIDDEN');
  return { id: id, folder: folder };
}

// Drive v3 files.update (metadata only).
function driveUpdate_(id, body) {
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=id', {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    console.error('files.update failed: ' + res.getResponseCode() + ' ' + res.getContentText());
    throw apiError_('UPSTREAM');
  }
}

// After a change, the home and both views of that guest's album must not serve stale data.
function forgetGuestCaches_(guestName) {
  var key = nameKey(guestName);
  CacheService.getScriptCache().removeAll(['feed', albumCacheKey_(key, false), albumCacheKey_(key, true)]);
}

// Drive v3 files.get metadata, or null if the file does not exist / is not visible.
function driveGet_(id, fields) {
  var res = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=' + encodeURIComponent(fields),
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) {
    console.error('files.get failed: ' + res.getResponseCode() + ' ' + res.getContentText());
    throw apiError_('UPSTREAM');
  }
  return JSON.parse(res.getContentText());
}

// Laurea/<guest> folders, read-only (never creates one).
function guestFolders_() {
  return driveList_(
    "'" + prop_('ROOT_FOLDER_ID') + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    'files(id,name,appProperties)'
  );
}

// Drive v3 files.list with paging, as the script owner.
function driveList_(q, fields) {
  var out = [];
  var pageToken = '';
  do {
    var url = 'https://www.googleapis.com/drive/v3/files?pageSize=1000' +
      '&q=' + encodeURIComponent(q) +
      '&fields=' + encodeURIComponent('nextPageToken,' + fields) +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      console.error('files.list failed: ' + res.getResponseCode() + ' ' + res.getContentText());
      throw apiError_('UPSTREAM');
    }
    var body = JSON.parse(res.getContentText());
    out = out.concat(body.files || []);
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return out;
}

// Find Laurea/<name> ignoring case, or create it. Script lock avoids duplicates on concurrent logins.
// Folders in the Drive trash do not count (DriveApp lists them too): a guest whose folder was
// deleted gets a fresh one instead of uploading into the trash.
function resolveUserFolder_(rawName) {
  var name = normalizeName(rawName);
  if (!name) throw apiError_('BAD_NAME');
  var key = nameKey(name);
  var root = DriveApp.getFolderById(prop_('ROOT_FOLDER_ID'));
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var it = root.getFolders();
    while (it.hasNext()) {
      var f = it.next();
      if (!f.isTrashed() && nameKey(f.getName()) === key) return f;
    }
    return root.createFolder(name);
  } finally {
    lock.releaseLock();
  }
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function apiError_(code) {
  var err = new Error(code);
  err.apiCode = code;
  return err;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor (Esegui → autorizza) to grant Drive + UrlFetch permissions to the web app.
function autorizza() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest', { muteHttpExceptions: true });
  console.log('Permessi OK. ROOT_FOLDER_ID impostato: ' + Boolean(prop_('ROOT_FOLDER_ID')));
}
