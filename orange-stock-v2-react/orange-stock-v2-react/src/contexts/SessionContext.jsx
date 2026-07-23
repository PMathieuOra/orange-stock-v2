import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SessionContext = createContext(null);
const SCOPE_KEY = 'orange_session_scope';

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
    let restored = null;
    try {
      const stored = sessionStorage.getItem(SCOPE_KEY);
      if (stored) restored = JSON.parse(stored);
    } catch (e) { /* ignore */ }

    const restoredServices = restored?.services
      ? restored.services
      : restored?.service ? [restored.service] : null;

    if (
      restoredServices && restoredServices.length > 0 &&
      restoredServices.every((s) => user.services.includes(s)) &&
      user.magasins.includes(restored.magasin)
    ) {
      setServices(restoredServices);
      setMagasin(restored.magasin);
    } else {
      setServices(user.services.length > 0 ? [user.services[0]] : []);
      setMagasin(user.magasins[0] || null);
    }
  }, [user]);

  const persist = useCallback((svcs, mag) => {
    try {
      sessionStorage.setItem(SCOPE_KEY, JSON.stringify({ services: svcs, magasin: mag }));
    } catch (e) { /* ignore */ }
  }, []);

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
