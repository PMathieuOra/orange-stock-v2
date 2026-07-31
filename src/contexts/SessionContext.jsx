import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SessionContext = createContext(null);

// Clé de stockage du dernier scope PAR utilisateur (persistant entre sessions)
function scopeKey(userId) {
  return `orange_scope_${userId || 'anon'}`;
}

// Lit le dernier scope enregistré pour un utilisateur donné
export function readStoredScope(userId) {
  try {
    const stored = localStorage.getItem(scopeKey(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const services = parsed?.services ? parsed.services : parsed?.service ? [parsed.service] : null;
    if (!services || services.length === 0 || !parsed.magasin) return null;
    return { services, magasin: parsed.magasin };
  } catch (e) {
    return null;
  }
}

export function SessionProvider({ children }) {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [magasin, setMagasin] = useState(null);

  useEffect(() => {
    if (!user) {
      setServices([]);
      setMagasin(null);
      return;
    }
    // Restaurer le dernier scope de CET utilisateur, validé contre ses droits actuels
    const restored = readStoredScope(user.id);
    if (
      restored &&
      restored.services.every((s) => user.services.includes(s)) &&
      user.magasins.includes(restored.magasin)
    ) {
      setServices(restored.services);
      setMagasin(restored.magasin);
    } else {
      setServices(user.services.length > 0 ? [user.services[0]] : []);
      setMagasin(user.magasins[0] || null);
    }
  }, [user]);

  const persist = useCallback((svcs, mag) => {
    if (!user) return;
    try {
      localStorage.setItem(scopeKey(user.id), JSON.stringify({ services: svcs, magasin: mag }));
    } catch (e) { /* ignore */ }
  }, [user]);

  const changeService = useCallback((svc) => {
    const next = svc ? [svc] : [];
    setServices(next);
    persist(next, magasin);
  }, [magasin, persist]);

  const toggleService = useCallback((svc) => {
    setServices((current) => {
      let next;
      if (current.includes(svc)) {
        next = current.filter((s) => s !== svc);
        if (next.length === 0) return current;
      } else {
        next = [...current, svc];
      }
      persist(next, magasin);
      return next;
    });
  }, [magasin, persist]);

  const changeMagasin = useCallback((mag) => {
    setMagasin(mag);
    persist(services, mag);
  }, [services, persist]);

  const setScope = useCallback((svc, mag) => {
    const svcs = Array.isArray(svc) ? svc : svc ? [svc] : [];
    setServices(svcs);
    setMagasin(mag);
    persist(svcs, mag);
  }, [persist]);

  const service = services[0] || null;
  const isMultiService = services.length > 1;

  return (
    <SessionContext.Provider value={{ service, services, magasin, isMultiService, changeService, toggleService, changeMagasin, setScope }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
