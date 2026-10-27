import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { BASE } from './api.js';
import { AuthProvider, useAuth } from './auth.jsx';
import { Loading, ToastProvider } from './ui.jsx';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Messages from './pages/Messages.jsx';
import Contacts from './pages/Contacts.jsx';
import Templates from './pages/Templates.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';
import './styles.css';

function RequireLogin({ children }) {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

// The pages with the editors (and their libraries) load when first opened.
const lazyPage = (load) => () => load().then((m) => ({ Component: m.default }));

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireLogin><Layout /></RequireLogin>,
    hydrateFallbackElement: <Loading />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'messages', element: <Messages /> },
      { path: 'messages/:id', lazy: lazyPage(() => import('./pages/Message.jsx')) },
      { path: 'updates', lazy: lazyPage(() => import('./pages/Updates.jsx')) },
      { path: 'contacts', element: <Contacts /> },
      { path: 'contacts/import', lazy: lazyPage(() => import('./pages/Import.jsx')) },
      { path: 'templates', element: <Templates /> },
      { path: 'templates/:id', lazy: lazyPage(() => import('./pages/TemplateEditor.jsx')) },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: BASE || '/' });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
