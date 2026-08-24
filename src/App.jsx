import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import { ToastProvider } from './contexts/ToastContext';
import { PageLoader } from './components/ui';

import Login from './pages/Login';
import Sortie from './pages/Sortie';
import Entree from './pages/Entree';
import Stock from './pages/Stock';
import Stats from './pages/Stats';
import Admin from './pages/Admin';
import Commandes from './pages/Commandes';
import Articles from './pages/Articles';
import Utilisateurs from './pages/Utilisateurs';
import Magasins from './pages/Magasins';
import Inventaire from './pages/Inventaire';

// Route protégée : redirige vers /login si pas connecté
function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/sortie" replace /> : <Login />} />
      <Route path="/sortie" element={<Protected><Sortie /></Protected>} />
      <Route path="/entree" element={<Protected><Entree /></Protected>} />
      <Route path="/stock" element={<Protected><Stock /></Protected>} />
      <Route path="/stats" element={<Protected><Stats /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="/admin/commandes" element={<Protected><Commandes /></Protected>} />
      <Route path="/admin/articles" element={<Protected><Articles /></Protected>} />
      <Route path="/admin/utilisateurs" element={<Protected><Utilisateurs /></Protected>} />
      <Route path="/admin/magasins" element={<Protected><Magasins /></Protected>} />
      <Route path="/admin/inventaire" element={<Protected><Inventaire /></Protected>} />
      <Route path="*" element={<Navigate to="/sortie" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </SessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
