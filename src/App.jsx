import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Toasts } from './components/ui';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Learning from './pages/Learning';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toasts />
    </div>
  );
}
