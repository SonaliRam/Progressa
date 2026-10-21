import { Link } from 'react-router-dom';
import { Plug } from 'lucide-react';

export default function ConnectCard() {
  return (
    <section className="connect-card clay">
      <div className="connect-icon">
        <Plug size={26} />
      </div>
      <div className="grow">
        <h3>Connect your Google Sheet</h3>
        <p>
          Deploy the Apps Script as a Web App, then paste its <code>/exec</code> URL in Settings. Your tasks, learning
          logs and charts will load straight from the <b>Task</b> and <b>Learning</b> tabs.
        </p>
      </div>
      <Link to="/settings" className="btn btn-primary">
        Open Settings
      </Link>
    </section>
  );
}
