/**
 * Progressaa — Google Apps Script backend (Web App)
 * Sheets: Task, Learning, Notes  (created automatically)
 *
 * SECRET KEY LOGIN
 *  - Every request from the app must carry the secret key, otherwise nothing is read or written.
 *  - Set your key ONCE in: Project Settings (gear icon) → Script Properties → Add property
 *        Property: SECRET_KEY      Value: Sonali
 *    Script Properties survive when you paste a new Code.gs, so you never have to set it again.
 *  - If no Script Property is set, SECRET_KEY_FALLBACK below is used.
 *
 * KEEP THE SAME /exec URL
 *  - After changing this file: Deploy → Manage deployments → ✏️ Edit → Version: "New version" → Deploy.
 *    The /exec URL stays the same. Only "Deploy → New deployment" creates a new URL.
 */

const SECRET_KEY_FALLBACK = 'Sonali';
const SPREADSHEET_ID = '1bdt6aVBR5Hc4nDZyZsLMIXmS47Zk1fE9QxgKQHEDD7I'; // used only if the script is not bound to the sheet
const API_VERSION = 3;

const MAX_FAILED_LOGINS = 10; // wrong keys allowed per 10 minutes before the API locks for 10 minutes
const LOCK_SECONDS = 600;

/* ------------------------------------------------------------------ */
/* Sheet schemas: [field key used by the app, column header in sheet]   */
/* Existing columns are matched loosely ("Parent ID" = "parentId"),     */
/* missing columns are added on the right, extra columns are left alone */
/* ------------------------------------------------------------------ */
const SCHEMAS = {
  Task: [
    ['id', 'ID'], ['title', 'Title'], ['description', 'Description'],
    ['startDate', 'Start Date'], ['endDate', 'End Date'], ['status', 'Status'],
    ['priority', 'Priority'], ['notes', 'Notes'], ['dailyLog', 'Daily Log'],
    ['createdAt', 'Created At'], ['updatedAt', 'Updated At'], ['completedAt', 'Completed At']
  ],
  Learning: [
    ['id', 'ID'], ['type', 'Type'], ['parentId', 'Parent ID'], ['order', 'Order'],
    ['title', 'Title'], ['status', 'Status'], ['color', 'Color'], ['url', 'URL'],
    ['resourceKind', 'Resource Kind'], ['notes', 'Notes'], ['takeaways', 'Takeaways'],
    ['evidence', 'Evidence'], ['createdAt', 'Created At'], ['updatedAt', 'Updated At'],
    ['completedAt', 'Completed At']
  ],
  Notes: [
    ['id', 'ID'], ['title', 'Title'], ['date', 'Date'], ['color', 'Color'],
    ['content', 'Content'], ['pinned', 'Pinned'], ['createdAt', 'Created At'], ['updatedAt', 'Updated At']
  ]
};

// Old hours-based Learning columns — read only, so the app can import them as topics.
const LEGACY_LEARNING = [
  ['date', 'Date'], ['category', 'Category'], ['topic', 'Topic'],
  ['hours', 'Hours'], ['progress', 'Progress (%)'], ['skillLevel', 'Skill Level']
];

const DATE_ONLY_FIELDS = { startDate: 1, endDate: 1, date: 1 };
const READ_ONLY_FIELDS = { id: 1, createdAt: 1, updatedAt: 1, completedAt: 1 };

/* ============================ ENTRY POINTS ============================ */

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return reply({ ok: false, error: 'Bad request: body is not JSON.' });
  }
  try {
    const auth = checkKey(req.key);
    if (auth) return reply(auth);
    return reply({ ok: true, data: route(req) });
  } catch (err) {
    return reply({ ok: false, error: String((err && err.message) || err) });
  }
}

// Opening the /exec URL in a browser shows only this — no data without the key.
function doGet() {
  return reply({ ok: true, data: { app: 'Progressaa API', version: API_VERSION, note: 'POST with your secret key.' } });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ================================ AUTH ================================ */

function getSecret() {
  const prop = PropertiesService.getScriptProperties().getProperty('SECRET_KEY');
  return String(prop || SECRET_KEY_FALLBACK || '').trim();
}

/** Returns an error reply object when the key is wrong, or null when it is correct. */
function checkKey(key) {
  const secret = getSecret();
  if (!secret) {
    return { ok: false, code: 'UNAUTHORIZED', error: 'No SECRET_KEY set in Script Properties.' };
  }
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('failedLogins') || 0);
  if (fails >= MAX_FAILED_LOGINS) {
    return { ok: false, code: 'LOCKED', error: 'Too many wrong keys. Try again in 10 minutes.' };
  }
  if (String(key || '').trim() !== secret) {
    cache.put('failedLogins', String(fails + 1), LOCK_SECONDS);
    return { ok: false, code: 'UNAUTHORIZED', error: 'Wrong secret key.' };
  }
  return null;
}

/* =============================== ROUTER =============================== */

function route(req) {
  const action = req.action;
  if (action === 'login' || action === 'ping') return { ok: true, version: API_VERSION };
  if (action === 'getAll') return withLock(getAll);
  if (action === 'list') return withLock(function () { return listRows(sheetName(req.sheet)); });
  if (action === 'create') return withLock(function () { return createRow(sheetName(req.sheet), req.data || {}); });
  if (action === 'update') return withLock(function () { return updateRow(sheetName(req.sheet), req.id, req.data || {}); });
  if (action === 'delete') return withLock(function () { return deleteRow(sheetName(req.sheet), req.id); });
  if (action === 'batch') return withLock(function () { return runBatch(req.ops || []); });
  throw new Error('Unknown action: ' + action);
}

function sheetName(name) {
  if (!SCHEMAS[name]) throw new Error('Unknown sheet: ' + name);
  return name;
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getAll() {
  return {
    Task: listRows('Task'),
    Learning: listRows('Learning'),
    Notes: listRows('Notes'),
    meta: { version: API_VERSION, syncedAt: new Date().toISOString() }
  };
}

function runBatch(ops) {
  return ops.map(function (op) {
    const name = sheetName(op.sheet);
    if (op.action === 'create') return createRow(name, op.data || {});
    if (op.action === 'update') return updateRow(name, op.id, op.data || {});
    if (op.action === 'delete') return deleteRow(name, op.id);
    throw new Error('Unknown batch action: ' + op.action);
  });
}

/* ============================ SHEET HELPERS ============================ */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
}

const norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };

/** Gets the sheet, creates it / adds missing columns, and returns { sheet, cols, width }. */
const _ctx = {};
function ctx(name) {
  if (_ctx[name]) return _ctx[name];
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (headers.length === 1 && !headers[0]) headers = [];

  const cols = {}; // field key -> 1-based column
  const find = function (key, label) {
    for (let i = 0; i < headers.length; i++) {
      const h = norm(headers[i]);
      if (h && (h === norm(key) || h === norm(label))) return i + 1;
    }
    return 0;
  };

  const missing = [];
  SCHEMAS[name].forEach(function (pair) {
    const c = find(pair[0], pair[1]);
    if (c) cols[pair[0]] = c;
    else missing.push(pair);
  });
  if (missing.length) {
    const start = headers.length + 1;
    sheet.getRange(1, start, 1, missing.length).setValues([missing.map(function (p) { return p[1]; })]);
    missing.forEach(function (p, i) { cols[p[0]] = start + i; });
    styleHeader(sheet);
  }

  const legacy = {};
  if (name === 'Learning') {
    LEGACY_LEARNING.forEach(function (pair) {
      const c = find(pair[0], pair[1]);
      if (c) legacy[pair[0]] = c;
    });
  }

  _ctx[name] = { sheet: sheet, cols: cols, legacy: legacy, width: sheet.getLastColumn(), tz: ss.getSpreadsheetTimeZone() };
  if (missing.length) textColumns(_ctx[name]);
  return _ctx[name];
}

/** Keeps managed columns as plain text so Sheets never turns "2026-10-21" into a date. */
function textColumns(c) {
  Object.keys(c.cols).forEach(function (k) {
    if (k !== 'order') c.sheet.getRange(1, c.cols[k], c.sheet.getMaxRows(), 1).setNumberFormat('@');
  });
}

function styleHeader(sheet) {
  const r = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  r.setBackground('#F78383').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function cellToString(v, key, tz) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return DATE_ONLY_FIELDS[key] ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
  }
  return String(v);
}

function rowToObject(name, c, row) {
  const obj = {};
  Object.keys(c.cols).forEach(function (k) {
    obj[k] = cellToString(row[c.cols[k] - 1], k, c.tz);
  });
  if (name === 'Learning') {
    obj.order = Number(obj.order) || 0;
    if (!obj.type) {
      const legacy = {};
      Object.keys(c.legacy).forEach(function (k) { legacy[k] = cellToString(row[c.legacy[k] - 1], k, c.tz); });
      obj.legacy = legacy;
    }
  }
  if (name === 'Notes') obj.pinned = obj.pinned === true || String(obj.pinned).toUpperCase() === 'TRUE';
  return obj;
}

function isBlankRow(row) {
  for (let i = 0; i < row.length; i++) if (row[i] !== '' && row[i] !== null) return false;
  return true;
}

function newId() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

/** All rows; rows typed straight into the sheet get an ID here. */
function listRows(name) {
  const c = ctx(name);
  const last = c.sheet.getLastRow();
  if (last < 2) return [];
  const range = c.sheet.getRange(2, 1, last - 1, c.width);
  const values = range.getValues();
  const idCol = c.cols.id - 1;
  const out = [];
  values.forEach(function (row, i) {
    if (isBlankRow(row)) return;
    if (!row[idCol]) {
      row[idCol] = newId();
      c.sheet.getRange(i + 2, idCol + 1).setValue(row[idCol]);
    }
    out.push(rowToObject(name, c, row));
  });
  return out;
}

function findRowIndex(c, id) {
  if (!id) return 0;
  const last = c.sheet.getLastRow();
  if (last < 2) return 0;
  const hit = c.sheet.getRange(2, c.cols.id, last - 1, 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function toCell(key, value) {
  if (key === 'order') return Number(value) || 0;
  if (key === 'pinned') return value ? 'TRUE' : 'FALSE';
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function applyData(c, row, data) {
  Object.keys(data).forEach(function (k) {
    if (READ_ONLY_FIELDS[k] || !c.cols[k]) return;
    row[c.cols[k] - 1] = toCell(k, data[k]);
  });
}

function setCompletedAt(c, row, data, now) {
  if (!c.cols.completedAt || !('status' in data)) return;
  const i = c.cols.completedAt - 1;
  if (data.status === 'Completed') { if (!row[i]) row[i] = now; }
  else row[i] = '';
}

function createRow(name, data) {
  const c = ctx(name);
  const now = new Date().toISOString();
  const row = new Array(c.width).fill('');
  applyData(c, row, data);
  row[c.cols.id - 1] = newId();
  if (c.cols.createdAt) row[c.cols.createdAt - 1] = now;
  if (c.cols.updatedAt) row[c.cols.updatedAt - 1] = now;
  setCompletedAt(c, row, data, now);
  const r = c.sheet.getLastRow() + 1;
  const range = c.sheet.getRange(r, 1, 1, c.width);
  range.setNumberFormat('@');
  range.setValues([row]);
  return rowToObject(name, c, row);
}

function updateRow(name, id, data) {
  const c = ctx(name);
  const r = findRowIndex(c, id);
  if (!r) throw new Error('Row not found: ' + id);
  const range = c.sheet.getRange(r, 1, 1, c.width);
  const row = range.getValues()[0];
  const now = new Date().toISOString();
  applyData(c, row, data);
  if (c.cols.updatedAt) row[c.cols.updatedAt - 1] = now;
  setCompletedAt(c, row, data, now);
  range.setValues([row]);
  return rowToObject(name, c, row);
}

function deleteRow(name, id) {
  const c = ctx(name);
  const r = findRowIndex(c, id);
  if (!r) return { id: id, deleted: false };
  c.sheet.deleteRow(r);
  return { id: id, deleted: true };
}

/* ============================== SETUP ================================ */

/** Run once from the editor (choose "setup" → Run) to create/repair the sheets. */
function setup() {
  Object.keys(SCHEMAS).forEach(function (name) {
    const c = ctx(name);
    styleHeader(c.sheet);
    textColumns(c);
  });
  if (!PropertiesService.getScriptProperties().getProperty('SECRET_KEY')) {
    Logger.log('Tip: add SECRET_KEY in Project Settings → Script Properties. Using SECRET_KEY_FALLBACK for now.');
  }
  Logger.log('Sheets ready: ' + Object.keys(SCHEMAS).join(', '));
}

/** Run from the editor if you locked yourself out with wrong keys. */
function clearLoginLock() {
  CacheService.getScriptCache().remove('failedLogins');
}
