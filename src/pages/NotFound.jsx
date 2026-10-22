import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="page nf-page">
      <div className="clay nf-card">
        <span className="nf-code">404</span>
        <h1>Page not found</h1>
        <p className="muted">The page you're looking for doesn't exist or was moved.</p>
        <Link to="/" className="btn btn-primary"><Home size={16} /> Back to dashboard</Link>
      </div>
    </div>
  );
}
