import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { Toasts, PageLoader } from './components/ui';
import { EditorProvider } from './components/learning/Editor';
import { DataProvider } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';

// Each page is downloaded the first time you open it (the notes editor and charts are large),
// so the app shell appears faster.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Learning = lazy(() => import('./pages/Learning'));
const LearningTech = lazy(() => import('./pages/LearningTech'));
const Settings = lazy(() => import('./pages/Settings'));
const RoughNotes = lazy(() => import('./pages/RoughNotes'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  const { authed } = useAuth();
  const location = useLocation();

  // Not logged in: only the login page exists. Any other URL goes to /login and comes back after login.
  if (!authed) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname + location.search }} />} />
      </Routes>
    );
  }

  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

function AppShell() {
  // Fetch the other pages quietly once the first one is on screen, so switching tabs is instant.
  useEffect(() => {
    const preload = () => {
      import('./pages/Tasks'); import('./pages/Learning'); import('./pages/LearningTech');
      import('./pages/RoughNotes'); import('./pages/Settings'); import('./pages/Dashboard');
    };
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 1500)))(preload);
  }, []);

  return (
    <EditorProvider>
      <div className="app">
        <Sidebar />
        <main className="content">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/learning" element={<Learning />} />
              <Route path="/learning/tech/:id" element={<LearningTech />} />
              <Route path="/rough-notes" element={<RoughNotes />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Toasts />
      </div>
    </EditorProvider>
  );
}
