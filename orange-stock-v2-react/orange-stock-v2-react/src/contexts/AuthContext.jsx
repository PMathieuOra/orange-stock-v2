import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { normalizeIdentifiant } from '../lib/helpers';

const AuthContext = createContext(null);

const STORAGE_KEY = 'orange_session_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch (e) {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const persist = useCallback((u) => {
    setUser(u);
    try {
      if (u) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Login : returns { ok, user, error, mustChangePwd }
  const login = useCallback(async (identifiantInput, password) => {
    const ident = normalizeIdentifiant(identifiantInput);
    if (!ident) return { ok: false, error: 'Identifiant requis' };

    // Fetch user with their services and magasins
    const { data, error } = await supabase
      .from('users')
      .select(
        `*, users_services ( service_id ), users_magasins ( magasin_id )`
      )
      .eq('identifiant', ident)
      .maybeSingle();

    if (error) return { ok: false, error: 'Erreur de connexion à la base' };
    if (!data) return { ok: false, error: 'Identifiant ou mot de passe incorrect' };
    if (!data.actif) return { ok: false, error: 'Compte désactivé. Contactez un administrateur.' };

    // Verify password
    let valid = false;
    try {
      // If hash looks like a placeholder, accept "0000" as initial password
      if (data.password_hash.includes('PLACEHOLDER')) {
        valid = password === '0000';
      } else {
        valid = bcrypt.compareSync(password, data.password_hash);
      }
    } catch (e) {
      valid = false;
    }
    if (!valid) return { ok: false, error: 'Identifiant ou mot de passe incorrect' };

    const services = (data.users_services || []).map((s) => s.service_id);
    const magasins = (data.users_magasins || []).map((m) => m.magasin_id);

    const sessionUser = {
      id: data.id,
      identifiant: data.identifiant,
      prenom: data.prenom,
      nom_initiale: data.nom_initiale,
      role: data.role,
      avatar_couleur: data.avatar_couleur,
      services,
      magasins,
    };

    return {
      ok: true,
      user: sessionUser,
      mustChangePwd: data.must_change_pwd,
    };
  }, []);

  // Change password (after forced first-login)
  const changePassword = useCallback(async (userId, newPassword) => {
    const hash = bcrypt.hashSync(newPassword, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash, must_change_pwd: false })
      .eq('id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  // Finalize login (after setup step)
  const completeLogin = useCallback(
    (sessionUser) => {
      persist(sessionUser);
    },
    [persist]
  );

  const logout = useCallback(() => {
    persist(null);
    try {
      sessionStorage.removeItem('orange_session_scope');
    } catch (e) {
      /* ignore */
    }
  }, [persist]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, changePassword, completeLogin, logout, isAdmin: user?.role === 'admin' }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
