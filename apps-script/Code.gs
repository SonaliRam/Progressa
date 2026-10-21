/**
 * ================================================================
 *  Work & Learn — Google Apps Script backend
 *  Database: Google Sheet "Sonali Work and Learning"
 *  Tabs:     "Task"  and  "Learning"
 *            Learning = one row per category / technology / topic / resource
 * ================================================================
 *
 *  SETUP (see SETUP.md for screenshots-free, step-by-step guide)
 *   1. Open the Google Sheet → Extensions → Apps Script.
 *   2. Replace everything in Code.gs with this file and Save.
 *   3. Run the `setup` function once (authorise when asked).
 *      It creates the column headers in both tabs.
 *   4. Deploy → New deployment → type "Web app"
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Copy the Web app URL (ends with /exec).
 *   5. Paste that URL into the app (Settings page) or into .env
 *      as VITE_GAS_URL.
 *
 *  Every time you change this code, use
 *  Deploy → Manage deployments → Edit (pencil) → Version: New version
 *  so the same /exec URL serves the new code.
 * ================================================================
 */

// The spreadsheet you shared. Works whether the script is bound to it or standalone.
const SPREADSHEET_ID = '1bdt6aVBR5Hc4nDZyZsLMIXmS47Zk1fE9QxgKQHEDD7I';

// OPTIONAL: set a secret (e.g. 'my-long-random-key') and enter the same key
// in the app's Settings page. Leave '' to disable the check.
const API_KEY = '';

// Bump when the data format changes; the app checks it before saving learning data.
const API_VERSION = 2;

// [appField, Sheet column header]
const SCHEMAS = {
  Task: [
    ['id', 'ID'],
    ['title', 'Title'],
    ['description', 'Description'],
    ['startDate', 'Start Date'],
    ['endDate', 'End Date'],
    ['status', 'Status'],
    ['priority', 'Priority'],
    ['notes', 'Notes'],
    ['dailyLog', 'Daily Log'],
    ['createdAt', 'Created At'],
    ['updatedAt', 'Updated At'],
    ['completedAt', 'Completed At']
  ],
  // One row per item. Type = category | technology | topic | resource.
  // Parent ID links: technology -> category, topic -> technology,
  // resource -> technology (macro resource) or topic (micro resource).
  Learning: [
    ['id', 'ID'],
    ['type', 'Type'],
    ['parentId', 'Parent ID'],
    ['order', 'Order'],
    ['title', 'Title'],
    ['status', 'Status'],
    ['color', 'Color'],
    ['url', 'URL'],
    ['resourceKind', 'Resource Kind'],
    ['notes', 'Notes'],
    ['takeaways', 'Key Takeaways'],
    ['evidence', 'Practical Evidence'],
    ['createdAt', 'Created At'],
    ['updatedAt', 'Updated At'],
    ['completedAt', 'Completed At']
  ]
};

// Columns from the old hours-based learning log. They are never written, only read so the
// app can offer to import old rows as topics.
const LEGACY_COLUMNS = {
  Learning: [
    ['category', 'Category'],
    ['topic', 'Topic'],
    ['date', 'Date'],
    ['progress', 'Progress (%)'],
    ['skillLevel', 'Skill Level']
  ]
};

const DATE_FIELDS = ['startDate', 'endDate', 'date'];          // stored as yyyy-MM-dd text
const TEXT_FIELDS = ['id', 'parentId', 'startDate', 'endDate', 'date', 'dailyLog', 'url', 'createdAt', 'updatedAt', 'completedAt'];
const NUMBER_FIELDS = ['order'];
const JSON_FIELDS = ['dailyLog'];
const READ_ONLY_FIELDS = ['id', 'createdAt', 'updatedAt', 'completedAt'];

const TASK_STATUSES = ['In Progress', 'Completed', 'Blocked'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const LEARNING_TYPES = ['category', 'technology', 'topic', 'resource'];
const TOPIC_STATUSES = ['Not Started', 'Learning', 'Practicing', 'Completed'];
const RESOURCE_KINDS = ['GitHub', 'Document', 'Link', 'Video', 'Course'];

/* ---------------------------------------------------------------- */
/*  Entry points                                                     */
/* ---------------------------------------------------------------- */

function doGet(e) {
  const params = (e && e.parameter) || {};
  return handle_(Object.assign({ action: 'getAll' }, params));
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Request body is not valid JSON.' });
  }
  return handle_(body);
}

/** Run once from the editor to create headers and authorise the script. */
function setup() {
  Object.keys(SCHEMAS).forEach(function (name) {
    const sh = getSheet_(name);
    ensureHeaders_(sh, name, true);
  });
  Logger.log('Headers ready in tabs: ' + Object.keys(SCHEMAS).join(', '));
}

/* ---------------------------------------------------------------- */
/*  Router                                                           */
/* ---------------------------------------------------------------- */

function handle_(req) {
  try {
    if (API_KEY && req.key !== API_KEY) {
      throw new Error('Unauthorized: the API key does not match.');
    }
    const action = String(req.action || '');

    if (action === 'ping') {
      return json_({ ok: true, data: { pong: true, version: API_VERSION, sheets: Object.keys(SCHEMAS), time: new Date().toISOString() } });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    Object.keys(ROW_CACHE_).forEach(function (k) { ROW_CACHE_[k] = null; });
    try {
      let data;
      switch (action) {
        case 'getAll':
          data = { Task: readAll_('Task'), Learning: readAll_('Learning'), meta: { version: API_VERSION } };
          break;
        case 'list':
          data = readAll_(sheetName_(req.sheet));
          break;
        case 'create':
          data = create_(sheetName_(req.sheet), req.data || {});
          break;
        case 'update':
          data = update_(sheetName_(req.sheet), req.id, req.data || {});
          break;
        case 'delete':
          data = remove_(sheetName_(req.sheet), req.id);
          break;
        case 'batch':
          // Several changes in one request (reordering, deleting a category with everything in it…)
          data = (req.ops || []).map(function (op) {
            const name = sheetName_(op.sheet);
            if (op.action === 'create') return create_(name, op.data || {});
            if (op.action === 'update') return update_(name, op.id, op.data || {});
            if (op.action === 'delete') return remove_(name, op.id, true);
            throw new Error('Unknown batch action: "' + op.action + '"');
          });
          break;
        default:
          throw new Error('Unknown action: "' + action + '"');
      }
      SpreadsheetApp.flush();
      return json_({ ok: true, data: data });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------------------------------------------------------------- */
/*  CRUD                                                             */
/* ---------------------------------------------------------------- */

function readAll_(name) {
  const sh = getSheet_(name);
  const headers = ensureHeaders_(sh, name, false);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const idCol = headers.indexOf(headerFor_(name, 'id'));
  const out = [];

  values.forEach(function (row, i) {
    const isEmpty = row.every(function (c) { return c === '' || c === null; });
    if (isEmpty) return;
    // Rows typed straight into the sheet get an ID so the app can edit them.
    if (!row[idCol]) {
      row[idCol] = Utilities.getUuid();
      sh.getRange(i + 2, idCol + 1).setValue(row[idCol]);
    }
    out.push(rowToObject_(name, headers, row));
  });
  return out;
}

function create_(name, input) {
  const sh = getSheet_(name);
  const headers = ensureHeaders_(sh, name, false);
  const now = new Date().toISOString();
  const record = clean_(name, input);

  record.id = Utilities.getUuid();
  record.createdAt = now;
  record.updatedAt = now;
  validate_(name, record);
  if (tracksCompletion_(name, record)) {
    record.completedAt = record.status === 'Completed' ? now : '';
  }

  const rowIndex = sh.getLastRow() + 1;
  writeRow_(sh, rowIndex, name, headers, objectToRow_(name, headers, record));
  if (ROW_CACHE_[name]) ROW_CACHE_[name][record.id] = rowIndex;
  return record;
}

function update_(name, id, patch) {
  if (!id) throw new Error('Missing record id.');
  const sh = getSheet_(name);
  const headers = ensureHeaders_(sh, name, false);
  const rowIndex = findRow_(sh, headers, name, id);
  if (rowIndex < 0) throw new Error('Record not found (it may have been deleted in the sheet).');

  const currentRow = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const current = rowToObject_(name, headers, currentRow);
  const changes = clean_(name, patch);
  const merged = Object.assign({}, current, changes);
  const now = new Date().toISOString();

  merged.id = current.id;
  merged.createdAt = current.createdAt;
  merged.updatedAt = now;
  validate_(name, merged);
  if (tracksCompletion_(name, merged)) {
    merged.completedAt = merged.status === 'Completed' ? current.completedAt || now : '';
  }

  // Start from the existing row so any extra columns you added yourself are kept.
  writeRow_(sh, rowIndex, name, headers, objectToRow_(name, headers, merged, currentRow));
  return merged;
}

function remove_(name, id, lenient) {
  if (!id) throw new Error('Missing record id.');
  const sh = getSheet_(name);
  const headers = ensureHeaders_(sh, name, false);
  const rowIndex = findRow_(sh, headers, name, id);
  if (rowIndex < 0) {
    if (lenient) return { id: id, missing: true };
    throw new Error('Record not found (it may already be deleted).');
  }
  sh.deleteRow(rowIndex);
  ROW_CACHE_[name] = null; // rows below moved up
  return { id: id };
}

function tracksCompletion_(name, r) {
  return name === 'Task' || (name === 'Learning' && r.type === 'topic');
}

/* ---------------------------------------------------------------- */
/*  Helpers                                                          */
/* ---------------------------------------------------------------- */

function sheetName_(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'task' || s === 'tasks') return 'Task';
  if (s === 'learning' || s === 'learnings') return 'Learning';
  throw new Error('Unknown sheet "' + raw + '". Use "Task" or "Learning".');
}

let SS_CACHE_ = null;
function getSheet_(name) {
  if (!SS_CACHE_) SS_CACHE_ = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ss = SS_CACHE_;
  let sh = ss.getSheetByName(name);
  if (!sh) {
    // Tolerate case / spacing differences in tab names, e.g. "task " or "Tasks".
    const match = ss.getSheets().filter(function (s) {
      const t = s.getName().trim().toLowerCase();
      return t === name.toLowerCase() || t === name.toLowerCase() + 's';
    })[0];
    sh = match || ss.insertSheet(name);
  }
  return sh;
}

function headerFor_(name, key) {
  const pair = SCHEMAS[name].filter(function (p) { return p[0] === key; })[0];
  return pair ? pair[1] : null;
}

/** Makes sure row 1 has every header. Existing columns/order are preserved. */
function ensureHeaders_(sh, name, force) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  let headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  if (headers.every(function (h) { return !h; })) headers = [];

  let changed = false;
  SCHEMAS[name].forEach(function (pair) {
    if (headers.indexOf(pair[1]) === -1) { headers.push(pair[1]); changed = true; }
  });

  if (changed || force) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#F78383').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    SCHEMAS[name].forEach(function (pair) {
      if (TEXT_FIELDS.indexOf(pair[0]) !== -1) {
        sh.getRange(2, headers.indexOf(pair[1]) + 1, rows, 1).setNumberFormat('@');
      }
    });
  }
  return headers;
}

// id -> row number, built once per request (kept fresh by create/delete) so batches stay fast.
const ROW_CACHE_ = {};
function findRow_(sh, headers, name, id) {
  if (!ROW_CACHE_[name]) {
    const map = {};
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      const col = headers.indexOf(headerFor_(name, 'id')) + 1;
      sh.getRange(2, col, lastRow - 1, 1).getValues().forEach(function (r, i) {
        if (r[0] !== '' && r[0] !== null) map[String(r[0])] = i + 2;
      });
    }
    ROW_CACHE_[name] = map;
  }
  const row = ROW_CACHE_[name][String(id)];
  return row ? row : -1;
}

let TZ_CACHE_ = null;
function tz_() {
  if (!TZ_CACHE_) TZ_CACHE_ = (SS_CACHE_ || (SS_CACHE_ = SpreadsheetApp.openById(SPREADSHEET_ID))).getSpreadsheetTimeZone();
  return TZ_CACHE_;
}

function rowToObject_(name, headers, row) {
  const tz = tz_();
  const obj = {};
  SCHEMAS[name].forEach(function (pair) {
    const key = pair[0];
    const idx = headers.indexOf(pair[1]);
    let v = idx >= 0 ? row[idx] : '';
    if (v instanceof Date) {
      v = DATE_FIELDS.indexOf(key) !== -1 ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
    }
    if (DATE_FIELDS.indexOf(key) !== -1) v = normaliseDate_(v);
    if (NUMBER_FIELDS.indexOf(key) !== -1) v = v === '' || v === null ? 0 : Number(v) || 0;
    // Undo the apostrophe added to stop text being read as a formula.
    if (typeof v === 'string' && /^'[=+]/.test(v)) v = v.slice(1);
    if (JSON_FIELDS.indexOf(key) !== -1) {
      try { v = v ? JSON.parse(v) : {}; } catch (e) { v = {}; }
    }
    obj[key] = v === null || v === undefined ? '' : v;
  });
  // Old hours-based learning rows (no Type yet): pass their old columns along for importing.
  if (name === 'Learning' && !obj.type && LEGACY_COLUMNS.Learning) {
    const legacy = {};
    LEGACY_COLUMNS.Learning.forEach(function (pair) {
      const idx = headers.indexOf(pair[1]);
      if (idx < 0) return;
      let v = row[idx];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      legacy[pair[0]] = v === null || v === undefined ? '' : v;
    });
    obj.legacy = legacy;
  }
  return obj;
}

/**
 * Writes one row. App columns (except numbers) are set to plain text first, so values such
 * as "12/10" or "1-2" in a title or note are saved exactly as typed instead of becoming dates.
 */
function writeRow_(sh, rowIndex, name, headers, values) {
  if (rowIndex > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), rowIndex - sh.getMaxRows());
  const range = sh.getRange(rowIndex, 1, 1, headers.length);
  const formats = range.getNumberFormats()[0];
  SCHEMAS[name].forEach(function (pair) {
    const idx = headers.indexOf(pair[1]);
    if (idx >= 0 && NUMBER_FIELDS.indexOf(pair[0]) === -1) formats[idx] = '@';
  });
  range.setNumberFormats([formats]);
  range.setValues([values]);
}

function objectToRow_(name, headers, obj, baseRow) {
  const row = headers.map(function (h, i) { return baseRow && baseRow[i] !== undefined ? baseRow[i] : ''; });
  SCHEMAS[name].forEach(function (pair) {
    const idx = headers.indexOf(pair[1]);
    if (idx < 0) return;
    let v = obj[pair[0]];
    if (v === undefined || v === null) v = '';
    if (JSON_FIELDS.indexOf(pair[0]) !== -1 && typeof v !== 'string') v = JSON.stringify(v || {});
    if (NUMBER_FIELDS.indexOf(pair[0]) !== -1) v = v === '' ? 0 : Number(v) || 0;
    // Prevent text from being interpreted as a formula.
    if (typeof v === 'string' && /^[=+]/.test(v)) v = "'" + v;
    row[idx] = v;
  });
  return row;
}

/** Keeps only known, writable fields and trims strings. */
function clean_(name, input) {
  const out = {};
  SCHEMAS[name].forEach(function (pair) {
    const key = pair[0];
    if (READ_ONLY_FIELDS.indexOf(key) !== -1) return;
    if (!Object.prototype.hasOwnProperty.call(input, key)) return;
    let v = input[key];
    if (typeof v === 'string') v = v.trim();
    if (DATE_FIELDS.indexOf(key) !== -1) v = normaliseDate_(v);
    if (NUMBER_FIELDS.indexOf(key) !== -1) v = Number(v) || 0;
    if (JSON_FIELDS.indexOf(key) !== -1 && typeof v === 'string') {
      try { v = v ? JSON.parse(v) : {}; } catch (e) { v = {}; }
    }
    out[key] = v;
  });
  return out;
}

function validate_(name, r) {
  if (name === 'Task') {
    if (!r.title) throw new Error('Task title is required.');
    if (!r.startDate) throw new Error('Task start date is required (yyyy-MM-dd).');
    if (!r.endDate || r.endDate < r.startDate) r.endDate = r.startDate;
    if (TASK_STATUSES.indexOf(r.status) === -1) r.status = 'In Progress';
    if (PRIORITIES.indexOf(r.priority) === -1) r.priority = 'Medium';
  } else {
    if (LEARNING_TYPES.indexOf(r.type) === -1) throw new Error('Learning item type must be one of: ' + LEARNING_TYPES.join(', ') + '.');
    if (!r.title && r.type === 'resource' && r.url) r.title = r.url;
    if (!r.title) throw new Error('A ' + r.type + ' needs a title.');
    if (r.type === 'category') r.parentId = '';
    else if (!r.parentId) throw new Error('A ' + r.type + ' needs a parent (Parent ID).');
    r.order = Number(r.order) || 0;
    if (r.type === 'topic') {
      if (TOPIC_STATUSES.indexOf(r.status) === -1) r.status = 'Not Started';
    } else {
      r.status = '';
    }
    if (r.type === 'resource') {
      if (RESOURCE_KINDS.indexOf(r.resourceKind) === -1) r.resourceKind = 'Link';
    } else {
      r.resourceKind = '';
    }
  }
}

function normaliseDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  // Accept dd/mm/yyyy typed manually in the sheet.
  const d = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (d) return d[3] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[1]).slice(-2);
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
