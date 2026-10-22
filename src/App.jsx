import { Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Toasts, PageLoader } from './components/ui';
import { EditorProvider } from './components/learning/Editor';
import { lazy, Suspense } from 'react';

// Each page is downloaded the first time you open it (the notes editor and charts are large),
// so the app shell appears faster.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Learning = lazy(() => import('./pages/Learning'));
const LearningTech = lazy(() => import('./pages/LearningTech'));
const Settings = lazy(() => import('./pages/Settings'));
const RoughNotes = lazy(() => import('./pages/RoughNotes'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Fetch the other pages quietly once the first one is on screen, so switching tabs is instant.
if (typeof window !== 'undefined') {
  const preload = () => {
    import('./pages/Tasks'); import('./pages/Learning'); import('./pages/LearningTech');
    import('./pages/RoughNotes'); import('./pages/Settings'); import('./pages/Dashboard');
  };
  (window.requestIdleCallback || ((cb) => setTimeout(cb, 1500)))(preload);
}
export default function App() {
  return (
    <EditorProvider>
      <div className="app">
        <Sidebar />
        <main className="content">
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
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
