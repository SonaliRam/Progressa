import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(key);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card clay" onSubmit={submit}>
        <div className="brand login-brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div className="brand-text">
            <strong>Progressaa</strong>
            <span>Rise Every Day.</span>
          </div>
        </div>

        <h1 className="login-title">Welcome Back</h1>
        <p className="login-sub">Enter your secret key to open your tracker.</p>

        <label className="login-label" htmlFor="secret-key">
          <KeyRound size={15} /> Secret key
        </label>
        <div className="login-input-wrap">
          <input
            id="secret-key"
            className="input"
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Your secret key"
            autoComplete="current-password"
            autoFocus
            spellCheck={false}
          />
          <button
            type="button"
            className="login-eye"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide key' : 'Show key'}
            title={show ? 'Hide key' : 'Show key'}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="btn btn-primary login-btn" disabled={busy || !key.trim()}>
          {busy ? <Spinner size={16} /> : <LogIn size={16} />} {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
