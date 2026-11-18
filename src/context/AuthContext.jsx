import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getSecretKey, setSecretKey, UNAUTHORIZED_EVENT } from '../lib/api';

const AuthContext = createContext(null);

/** Secret-key login. The key is verified by Apps Script before it is saved in this browser. */
export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => Boolean(getSecretKey()));

  const login = useCallback(async (key) => {
    const k = String(key || '').trim();
    if (!k) throw new Error('Enter your secret key.');
    await api.login(k); // throws on a wrong key
    setSecretKey(k);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    setSecretKey('');
    setAuthed(false);
  }, []);

  // Any request rejected by Apps Script (key changed on the server) signs you out.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  return <AuthContext.Provider value={{ authed, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
