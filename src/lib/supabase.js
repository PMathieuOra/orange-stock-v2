import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '⚠️ Variables Supabase manquantes. Copiez .env.example en .env et remplissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');

// Référentiels statiques (miroir de la table services)
export const SERVICES_REF = [
  { id: 'boucle_locale', nom: 'Boucle Locale', icon: '🔌', couleur: '#2563EB' },
  { id: 'structurant', nom: 'Réseaux Structurant', icon: '🌐', couleur: '#FF7900' },
  { id: 'client', nom: 'Client', icon: '👥', couleur: '#7C3AED' },
];

export function getServiceInfo(id) {
  return SERVICES_REF.find((s) => s.id === id) || { id, nom: id, icon: '🏷️', couleur: '#9A9A9A' };
}
