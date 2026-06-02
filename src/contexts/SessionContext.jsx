import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SessionContext = createContext(null);

const SCOPE_KEY = 'orange_session_scope';

export function SessionProvider({ children }) {
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [magasin, setMagasin] = useState(null);

  // Restore or init scope when user changes
  useEffect(() => {
    if (!user) {
      setService(null);
      setMagasin(null);
      return;
    }
    let restored = null;
    try {
      const stored = sessionStorage.getItem(SCOPE_KEY);
      if (stored) restored = JSON.parse(stored);
    } catch (e) {
      /* ignore */
    }
    // Validate restored scope is still allowed
    if (
      restored &&
      user.services.includes(restored.service) &&
      user.magasins.includes(restored.magasin)
    ) {
      setService(restored.service);
      setMagasin(restored.magasin);
    } else {
      setService(user.services[0] || null);
      setMagasin(user.magasins[0] || null);
    }
  }, [user]);

  const persist = useCallback((svc, mag) => {
    try {
      sessionStorage.setItem(SCOPE_KEY, JSON.stringify({ service: svc, magasin: mag }));
    } catch (e) {
      /* ignore */
    }
  }, []);

  const changeService = useCallback(
    (svc) => {
      setService(svc);
      persist(svc, magasin);
    },
    [magasin, persist]
  );

  const changeMagasin = useCallback(
    (mag) => {
      setMagasin(mag);
      persist(service, mag);
    },
    [service, persist]
  );

  // Set both at once (used by login setup)
  const setScope = useCallback(
    (svc, mag) => {
      setService(svc);
      setMagasin(mag);
      persist(svc, mag);
    },
    [persist]
  );

  return (
    <SessionContext.Provider
      value={{ service, magasin, changeService, changeMagasin, setScope }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
