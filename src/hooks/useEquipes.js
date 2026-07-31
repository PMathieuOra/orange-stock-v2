import { supabase } from '../lib/supabase';

// Palette de couleurs pour les équipes
export const EQUIPE_COULEURS = [
  '#FF7900', '#2563EB', '#00A86B', '#7C3AED',
  '#DC2626', '#D97706', '#0891B2', '#DB2777',
];

// Liste toutes les équipes avec le nombre de membres
export async function fetchEquipes() {
  const { data: equipes, error } = await supabase
    .from('equipes')
    .select('*')
    .order('nom');
  if (error) return { ok: false, data: [], error: error.message };

  // Compter les membres de chaque équipe
  const { data: users } = await supabase
    .from('users')
    .select('equipe_id')
    .not('equipe_id', 'is', null);

  const counts = {};
  (users || []).forEach((u) => {
    if (u.equipe_id) counts[u.equipe_id] = (counts[u.equipe_id] || 0) + 1;
  });

  const enriched = (equipes || []).map((e) => ({ ...e, nbMembres: counts[e.id] || 0 }));
  return { ok: true, data: enriched };
}

// Crée une équipe
export async function createEquipe({ nom, couleur }) {
  if (!nom || !nom.trim()) return { ok: false, error: 'Nom requis' };
  const { data, error } = await supabase
    .from('equipes')
    .insert({ nom: nom.trim(), couleur: couleur || '#FF7900', actif: true })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, equipe: data };
}

// Met à jour une équipe
export async function updateEquipe(id, { nom, couleur }) {
  const updates = {};
  if (nom !== undefined) updates.nom = nom.trim();
  if (couleur !== undefined) updates.couleur = couleur;
  const { error } = await supabase.from('equipes').update(updates).eq('id', id);
  return { ok: !error, error: error?.message };
}

// Supprime une équipe (les users rattachés passent à "sans équipe" via ON DELETE SET NULL)
export async function deleteEquipe(id) {
  const { error } = await supabase.from('equipes').delete().eq('id', id);
  return { ok: !error, error: error?.message };
}

// Affecte un utilisateur à une équipe (ou le retire si equipeId = null)
export async function setUserEquipe(userId, equipeId) {
  const { error } = await supabase
    .from('users')
    .update({ equipe_id: equipeId || null })
    .eq('id', userId);
  return { ok: !error, error: error?.message };
}

// Liste les membres d'une équipe
export async function fetchMembresEquipe(equipeId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, prenom, nom_initiale, role, actif, avatar_couleur')
    .eq('equipe_id', equipeId)
    .order('prenom');
  return { ok: !error, data: data || [] };
}
