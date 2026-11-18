// Thin client for the Google Apps Script Web App.
// Requests are sent as text/plain so the browser does not need a CORS preflight,
// which Apps Script cannot answer. Apps Script replies with a redirect that fetch follows.
//
// Login: the secret key is checked by Apps Script (Code.gs) on EVERY request.
// The app only keeps the key in this browser after Apps Script has accepted it.
import { EXEC_URL } from './config';

const SECRET_KEY_STORE = 'progressa.secret';
export const UNAUTHORIZED_EVENT = 'progressa:unauthorized';

// Clean up the old Settings-page connection values.
try {
  window.localStorage.removeItem('wl.gasUrl');
  window.localStorage.removeItem('wl.gasKey');
} catch {
  /* storage blocked */
}

export function getApiUrl() {
  return EXEC_URL;
}

export function getSecretKey() {
  try {
    return window.localStorage.getItem(SECRET_KEY_STORE) || '';
  } catch {
    return '';
  }
}
export function setSecretKey(key) {
  try {
    if (key) window.localStorage.setItem(SECRET_KEY_STORE, key);
    else window.localStorage.removeItem(SECRET_KEY_STORE);
  } catch {
    /* storage blocked — login lasts until the tab is closed */
  }
}

async function call(payload, overrideKey) {
  let res;
  try {
    res = await fetch(EXEC_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: overrideKey ?? getSecretKey() })
    });
  } catch {
    throw new Error('Could not reach Google Apps Script. Check your internet connection and try again.');
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (/<html/i.test(text)) {
      throw new Error(
        'Apps Script returned a web page instead of data. Re-deploy as a Web app with access "Anyone" and use the /exec URL.'
      );
    }
    throw new Error('Unexpected response from Apps Script.');
  }
  if (!json.ok) {
    const err = new Error(json.error || 'Apps Script reported an error.');
    err.code = json.code || '';
    // Key changed or removed on the server → sign out everywhere in the app.
    if (err.code === 'UNAUTHORIZED' && overrideKey === undefined) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw err;
  }
  return json.data;
}

export const api = {
  /** Checks a secret key with Apps Script. Resolves only if the key is correct. */
  login: (key) => call({ action: 'login' }, key),
  ping: () => call({ action: 'ping' }),
  getAll: () => call({ action: 'getAll' }),
  list: (sheet) => call({ action: 'list', sheet }),
  create: (sheet, data) => call({ action: 'create', sheet, data }),
  update: (sheet, id, data) => call({ action: 'update', sheet, id, data }),
  remove: (sheet, id) => call({ action: 'delete', sheet, id }),
  /** ops: [{ action: 'create'|'update'|'delete', sheet, id?, data? }] — run in one request. */
  batch: (ops) => call({ action: 'batch', ops }),
  // Rough Notes (sticky notes) — one row per note in the "Notes" tab.
  listNotes: () => call({ action: 'list', sheet: 'Notes' }),
  createNote: (data) => call({ action: 'create', sheet: 'Notes', data }),
  updateNote: (id, data) => call({ action: 'update', sheet: 'Notes', id, data }),
  deleteNote: (id) => call({ action: 'delete', sheet: 'Notes', id })
};
