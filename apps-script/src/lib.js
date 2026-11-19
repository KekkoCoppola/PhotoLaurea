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

// Drive metadata for a new upload. The profile photo carries appProperties.photolaurea = 'avatar'
// so the gallery can leave it out and the profile can find it.
function uploadMeta(kind, original, date) {
  if (kind === 'avatar') {
    return { name: buildAvatarFileName(date), appProperties: { photolaurea: 'avatar' } };
  }
  return { name: buildDriveFileName(original, date) };
}

function isValidCode(given, expected) {
  var e = String(expected == null ? '' : expected).trim().toUpperCase();
  if (!e) return false;
  return String(given == null ? '' : given).trim().toUpperCase() === e;
}
