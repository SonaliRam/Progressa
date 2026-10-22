import { useEffect, useState } from 'react';
import { APPRAISAL_DATE, COUNTDOWN_START } from './constants';

// Countdown settings are edited on the Settings page and kept in this browser.
const KEY = 'wl.countdown';
const EVENT = 'wl-countdown-change';

export const COUNTDOWN_DEFAULTS = {
  label: 'Appraisal countdown',
  targetDate: APPRAISAL_DATE,
  startDate: COUNTDOWN_START
};

export function getCountdownSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return { ...COUNTDOWN_DEFAULTS, ...saved };
  } catch {
    return { ...COUNTDOWN_DEFAULTS };
  }
}

export function saveCountdownSettings(next) {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — defaults still work */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCountdownSettings() {
  const [s, setS] = useState(getCountdownSettings);
  useEffect(() => {
    const on = () => setS(getCountdownSettings());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return s;
}
