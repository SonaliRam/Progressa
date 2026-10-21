// Thin client for the Google Apps Script Web App.
// Requests are sent as text/plain so the browser does not need a CORS preflight,
// which Apps Script cannot answer. Apps Script replies with a redirect that fetch follows.

const URL_KEY = 'wl.gasUrl';
const API_KEY_KEY = 'wl.gasKey';

function readLS(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function writeLS(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage blocked — the env value still works */
  }
}

export function getApiUrl() {
  return (readLS(URL_KEY) || import.meta.env.VITE_GAS_URL || '').trim();
}
export function getApiKey() {
  return (readLS(API_KEY_KEY) || import.meta.env.VITE_GAS_KEY || '').trim();
}
export function saveConnection(url, key) {
  writeLS(URL_KEY, (url || '').trim());
  writeLS(API_KEY_KEY, (key || '').trim());
}

export function looksLikeGasUrl(url) {
  return /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(String(url || '').trim());
}

async function call(payload, overrideUrl, overrideKey) {
  const url = (overrideUrl ?? getApiUrl()).trim();
  if (!url) throw new Error('Not connected: add your Apps Script Web App URL in Settings.');

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: overrideKey ?? getApiKey() })
    });
  } catch {
    throw new Error(
      'Could not reach Google Apps Script. Check the Web App URL and that access is set to "Anyone".'
    );
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
  if (!json.ok) throw new Error(json.error || 'Apps Script reported an error.');
  return json.data;
}

export const api = {
  ping: (url, key) => call({ action: 'ping' }, url, key),
  getAll: () => call({ action: 'getAll' }),
  create: (sheet, data) => call({ action: 'create', sheet, data }),
  update: (sheet, id, data) => call({ action: 'update', sheet, id, data }),
  remove: (sheet, id) => call({ action: 'delete', sheet, id })
};
