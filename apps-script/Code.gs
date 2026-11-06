/**
 * MTU 2026 – afstemnings-API til Google Sheets (Google Apps Script).
 *
 * Denne fil indeholder INGEN hemmeligheder og ingen MTU-tekster. Den delte nøgle gemmes i
 * Projektindstillinger → Scriptegenskaber som API_SECRET. Se README.md for opsætning.
 *
 * Hver stemme gemmes som én række i fanen "Stemmer":
 *   Tidspunkt | Stemme-ID | Styrker | Forbedringer
 * hvor styrker/forbedringer er kommaseparerede spørgsmåls-ID'er (q01–q28).
 */

const SHEET_NAME = 'Stemmer';
const HEADERS = ['Tidspunkt', 'Stemme-ID', 'Styrker', 'Forbedringer'];
const PICKS = 3;
const QUESTION_COUNT = 28;
const VALID_IDS = Array.from({ length: QUESTION_COUNT }, (_, i) => 'q' + String(i + 1).padStart(2, '0'));
const VOTE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kør én gang fra editoren for at godkende adgang og oprette fanen "Stemmer". */
function opsaetning() {
  const sheet = getSheet_();
  const configured = !!PropertiesService.getScriptProperties().getProperty('API_SECRET');
  console.log('Fanen "' + sheet.getName() + '" er klar. API_SECRET er ' + (configured ? 'sat.' : 'IKKE sat endnu – se README.'));
}

function doPost(e) {
  try {
    const req = parseRequest_(e);
    if (!req) return json_({ ok: false, error: 'bad_request' });

    const secret = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    if (!secret || secret.length < 16) return json_({ ok: false, error: 'not_configured' });
    if (!safeEquals_(String(req.secret || ''), secret)) return json_({ ok: false, error: 'unauthorized' });

    if (req.action === 'vote') return json_(handleVote_(req));
    if (req.action === 'results') return json_(handleResults_());
    return json_({ ok: false, error: 'bad_request' });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'server_error' });
  }
}

// Simpelt sundhedstjek, når URL'en åbnes i en browser. Afslører ingen data.
function doGet() {
  const configured = !!PropertiesService.getScriptProperties().getProperty('API_SECRET');
  return json_({ ok: true, service: 'mtu-afstemning', configured: configured });
}

function handleVote_(req) {
  const voteId = String(req.voteId || '');
  const strengths = req.strengths;
  const improvements = req.improvements;
  if (!VOTE_ID_RE.test(voteId) || !validPicks_(strengths) || !validPicks_(improvements)) {
    return { ok: false, error: 'invalid_vote' };
  }
  if (strengths.some(function (id) { return improvements.indexOf(id) !== -1; })) {
    return { ok: false, error: 'invalid_vote' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    const sheet = getSheet_();
    const last = sheet.getLastRow();
    if (last > 1) {
      const ids = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (let r = 0; r < ids.length; r++) {
        // Samme stemme-id er allerede gemt (fx genforsøg efter netværksfejl) – gem ikke igen
        if (String(ids[r][0]) === voteId) return { ok: true, duplicate: true };
      }
    }
    sheet.appendRow([new Date(), voteId, strengths.join(','), improvements.join(',')]);
    SpreadsheetApp.flush();
    return { ok: true, duplicate: false };
  } finally {
    lock.releaseLock();
  }
}

function handleResults_() {
  const strengths = {};
  const improvements = {};
  VALID_IDS.forEach(function (id) { strengths[id] = 0; improvements[id] = 0; });
  let total = 0;

  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last > 1) {
    const rows = sheet.getRange(2, 2, last - 1, 3).getValues();
    rows.forEach(function (row) {
      const s = String(row[1]).split(',');
      const i = String(row[2]).split(',');
      // Rækker, der er redigeret manuelt til noget ugyldigt, tælles ikke med
      if (!VOTE_ID_RE.test(String(row[0])) || !validPicks_(s) || !validPicks_(i)) return;
      total++;
      s.forEach(function (id) { strengths[id]++; });
      i.forEach(function (id) { improvements[id]++; });
    });
  }
  return { ok: true, total: total, strengths: strengths, improvements: improvements };
}

function validPicks_(list) {
  if (!Array.isArray(list) || list.length !== PICKS) return false;
  const seen = {};
  for (let k = 0; k < list.length; k++) {
    const id = list[k];
    if (typeof id !== 'string' || VALID_IDS.indexOf(id) === -1 || seen[id]) return false;
    seen[id] = true;
  }
  return true;
}

function parseRequest_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 10000) return null;
  try {
    const req = JSON.parse(e.postData.contents);
    return req && typeof req === 'object' && !Array.isArray(req) ? req : null;
  } catch (err) {
    return null;
  }
}

function getSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Intet regneark fundet. Opret scriptet via Udvidelser → Apps Script i dit Google Sheet, eller sæt SPREADSHEET_ID.');
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Sammenligning i konstant tid, så nøglen ikke kan gættes via svartider
function safeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let k = 0; k < a.length; k++) diff |= a.charCodeAt(k) ^ b.charCodeAt(k);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
