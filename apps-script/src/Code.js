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
  login: function (req) {
    var folder = resolveUserFolder_(req.name);
    return { name: folder.getName(), folderId: folder.getId() };
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
        payload: JSON.stringify({
          name: buildDriveFileName(String(req.fileName), new Date()),
          parents: [folder.getId()],
        }),
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
