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
    return { name: folder.getName(), folderId: folder.getId(), avatarId: pickAvatar(files) };
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
  album: function (req) {
    var key = nameKey(req.name);
    if (!key) throw apiError_('BAD_NAME');
    var cache = CacheService.getScriptCache();
    var cacheKey = 'album:' + key;
    var hit = cache.get(cacheKey);
    if (hit) return JSON.parse(hit);
    var folder = guestFolders_().filter(function (f) { return nameKey(f.name) === key; })[0];
    var data = { name: folder ? folder.name : normalizeName(req.name), items: [] };
    if (folder) {
      data.items = albumItems(driveList_(
        "'" + folder.id + "' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
        'files(id,createdTime,mimeType,appProperties,description,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height))'
      ));
    }
    try {
      cache.put(cacheKey, JSON.stringify(data), FEED_CACHE_SECONDS_);
    } catch (err) {
      // over the 100 KB cache limit: serve uncached
    }
    return data;
  },
  startUpload: function (req) {
    var folder = resolveUserFolder_(req.name);
    var size = Number(req.size);
    if (!req.fileName || !(size >= 0)) throw apiError_('BAD_REQUEST');
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

// Laurea/<guest> folders, read-only (never creates one).
function guestFolders_() {
  return driveList_(
    "'" + prop_('ROOT_FOLDER_ID') + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    'files(id,name)'
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
      if (nameKey(f.getName()) === key) return f;
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
