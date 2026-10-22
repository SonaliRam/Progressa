import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Toasts } from './components/ui';
import { EditorProvider } from './components/learning/Editor';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Learning from './pages/Learning';
import LearningTech from './pages/LearningTech';
import Settings from './pages/Settings';
import RoughNotes from './pages/RoughNotes';
export default function App() {
  return (
    <EditorProvider>
      <div className="app">
        <Sidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/learning/tech/:id" element={<LearningTech />} />
            <Route path="/rough-notes" element={<RoughNotes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Toasts />
      </div>
    </EditorProvider>
  );
}
