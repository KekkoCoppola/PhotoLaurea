// Pure helpers. Apps Script global scope: no import/export.

var NAME_MAX_LENGTH = 40;

function normalizeName(raw) {
  return String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH)
    .trim();
}

function nameKey(name) {
  return normalizeName(name).toLocaleLowerCase('it');
}

// YYYYMMDD-HHMMSS in Rome time, so files sort by when they were taken at the party.
function romeStamp(date) {
  var parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
  return parts.year + parts.month + parts.day + '-' + parts.hour + parts.minute + parts.second;
}

function buildDriveFileName(original, date) {
  return romeStamp(date) + '_' + original;
}

function buildAvatarFileName(date) {
  return 'PROFILO_' + romeStamp(date) + '.jpg';
}

var TEXT_MAX_LENGTH = 1000;

// Drive metadata for a new upload, tagged in appProperties.photolaurea:
// 'avatar' = profile photo (left out of the gallery); 'text' = message, also kept in the
// description so listings carry it; 'voice' = voice note with its duration (Drive has none for audio).
function uploadMeta(kind, original, date, extra) {
  extra = extra || {};
  if (kind === 'avatar') {
    return { name: buildAvatarFileName(date), appProperties: { photolaurea: 'avatar' } };
  }
  if (kind === 'text') {
    return {
      name: 'TESTO_' + romeStamp(date) + '.txt',
      description: String(extra.text == null ? '' : extra.text).trim().slice(0, TEXT_MAX_LENGTH),
      appProperties: { photolaurea: 'text' },
    };
  }
  if (kind === 'voice') {
    var ext = /\.([a-z0-9]{2,4})$/i.exec(original);
    return {
      name: 'VOCALE_' + romeStamp(date) + '.' + (ext ? ext[1].toLowerCase() : 'webm'),
      appProperties: { photolaurea: 'voice', durationMs: String(Math.round(Number(extra.durationMs) || 0)) },
    };
  }
  return { name: buildDriveFileName(original, date) };
}

function isValidCode(given, expected) {
  var e = String(expected == null ? '' : expected).trim().toUpperCase();
  if (!e) return false;
  return String(given == null ? '' : given).trim().toUpperCase() === e;
}

function tagOf(file) {
  return (file.appProperties && file.appProperties.photolaurea) || '';
}

function isAvatarFile(file) {
  return tagOf(file) === 'avatar';
}

// photo | video | text | voice
function itemKind(file) {
  var tag = tagOf(file);
  if (tag === 'text' || tag === 'voice') return tag;
  return /^video\//.test(file.mimeType || '') ? 'video' : 'photo';
}

// Taller tiles for longer messages, so the start of the text shows in the grid.
function textRatio(text) {
  var n = String(text || '').length;
  return n < 80 ? 0.8 : n < 200 ? 1.1 : 1.35;
}

// What the client needs to draw one gallery item (grid tile, stack card, focused view).
// ratio = height / width as displayed (quarter-turn EXIF rotation swaps the sides).
function toItem(f) {
  var kind = itemKind(f);
  var item = { id: f.id, mimeType: f.mimeType, kind: kind };
  if (kind === 'text') {
    item.ratio = textRatio(f.description);
    item.text = f.description || '';
  } else if (kind === 'voice') {
    item.ratio = 1;
    item.durationMs = Number((f.appProperties || {}).durationMs) || 0;
  } else {
    var meta = f.imageMediaMetadata || f.videoMediaMetadata || {};
    var w = Number(meta.width);
    var h = Number(meta.height);
    if (meta.rotation % 2 === 1) { var t = w; w = h; h = t; }
    item.ratio = w > 0 && h > 0 ? Math.round((h / w) * 10000) / 10000 : DEFAULT_RATIO;
  }
  return item;
}

// Profile photo of a guest folder: the newest photo marked as profile; if none, the first photo
// the guest ever uploaded (returning guests and uploads made before profiles existed); else null.
function pickAvatar(files) {
  var marked = null;
  var first = null;
  files.forEach(function (f) {
    if (isAvatarFile(f)) {
      if (!marked || f.createdTime > marked.createdTime) marked = f;
    } else if (/^image\//.test(f.mimeType || '')) {
      if (!first || f.createdTime < first.createdTime) first = f;
    }
  });
  return marked ? marked.id : first ? first.id : null;
}

// Home feed: one entry per guest folder that has at least one photo/video.
// folders: [{id, name}]; files: Drive v3 [{id, parents, createdTime, mimeType, appProperties}].
// Profile photos never count as gallery items; the newest one becomes avatarId.
// Sorted by most recent upload first. createdTime is RFC 3339 UTC, so string order = time order.
function summarizeUsers(folders, files, recentLimit) {
  var byFolder = {};
  folders.forEach(function (f) {
    byFolder[f.id] = { name: f.name, files: [], media: [] };
  });
  files.forEach(function (file) {
    var user = byFolder[(file.parents || [])[0]];
    if (!user) return;
    user.files.push(file);
    if (!isAvatarFile(file)) user.media.push(file);
  });
  return Object.keys(byFolder)
    .map(function (id) { return byFolder[id]; })
    .filter(function (u) { return u.media.length > 0; })
    .map(function (u) {
      u.media.sort(function (a, b) { return a.createdTime < b.createdTime ? 1 : a.createdTime > b.createdTime ? -1 : 0; });
      return {
        name: u.name,
        avatarId: pickAvatar(u.files),
        count: u.media.length,
        lastUpload: u.media[0].createdTime,
        recent: u.media.slice(0, recentLimit).map(toItem),
      };
    })
    .sort(function (a, b) { return a.lastUpload < b.lastUpload ? 1 : a.lastUpload > b.lastUpload ? -1 : 0; });
}

var DEFAULT_RATIO = 1.25; // 4:5 portrait while Drive has not read the file's size yet

// One guest's album: newest first, profile photos left out.
// ratio = height / width as displayed (quarter-turn EXIF rotation swaps the sides),
// so the client can lay out the grid before any thumbnail loads.
function albumItems(files) {
  return files
    .filter(function (f) { return !isAvatarFile(f); })
    .sort(function (a, b) { return a.createdTime < b.createdTime ? 1 : a.createdTime > b.createdTime ? -1 : 0; })
    .map(toItem);
}
