import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';

// Génère l'identifiant via la fonction SQL
export async function genIdentifiant(prenom, initiale) {
  const { data, error } = await supabase.rpc('generer_identifiant', {
    p_prenom: prenom,
    p_initiale: initiale,
  });
  if (error) {
    // Fallback côté client
    const base = (prenom + '_' + initiale)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '');
    return base;
  }
  return data;
}

// Liste tous les users avec leurs services, magasins et équipe
export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*, users_services(service_id), users_magasins(magasin_id), equipes(id, nom, couleur)')
    .order('prenom');
  return { ok: !error, data: data || [], error: error?.message };
}

// Avatar colors disponibles (rotation pour les nouveaux users)
const AVATAR_COLORS = ['c-orange', 'c-blue', 'c-green', 'c-purple', 'c-pink', 'c-teal', 'c-indigo', 'c-rose'];

function pickAvatarColor(existingUsers) {
  // Compter les usages de chaque couleur
  const counts = {};
  AVATAR_COLORS.forEach((c) => (counts[c] = 0));
  existingUsers.forEach((u) => {
    if (counts[u.avatar_couleur] !== undefined) counts[u.avatar_couleur]++;
  });
  // Prendre la moins utilisée
  let minColor = AVATAR_COLORS[0];
  let minCount = counts[minColor];
  AVATAR_COLORS.forEach((c) => {
    if (counts[c] < minCount) {
      minCount = counts[c];
      minColor = c;
    }
  });
  return minColor;
}

// Crée un utilisateur
export async function createUser({ prenom, initiale, role, services, magasins, equipeId, allUsers = [] }) {
  if (!prenom || !prenom.trim()) return { ok: false, error: 'Prénom requis' };
  if (!initiale || !initiale.trim()) return { ok: false, error: 'Initiale du nom requise' };
  if (!services || !services.length) return { ok: false, error: 'Au moins un service requis' };
  if (!magasins || !magasins.length) return { ok: false, error: 'Au moins un magasin requis' };

  const identifiant = await genIdentifiant(prenom.trim(), initiale.trim());
  if (!identifiant) return { ok: false, error: 'Impossible de générer un identifiant' };

  // Hash du MDP initial "0000"
  const passwordHash = bcrypt.hashSync('0000', 10);
  const avatarColor = pickAvatarColor(allUsers);

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      identifiant,
      prenom: prenom.trim(),
      nom_initiale: initiale.trim().toUpperCase(),
      password_hash: passwordHash,
      role: role || 'user',
      must_change_pwd: true,
      actif: true,
      avatar_couleur: avatarColor,
      equipe_id: equipeId || null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  // Liaisons services
  if (services.length > 0) {
    const svcLinks = services.map((s) => ({ user_id: user.id, service_id: s }));
    await supabase.from('users_services').insert(svcLinks);
  }
  // Liaisons magasins
  if (magasins.length > 0) {
    const magLinks = magasins.map((m) => ({ user_id: user.id, magasin_id: m }));
    await supabase.from('users_magasins').insert(magLinks);
  }

  return { ok: true, user, identifiant };
}

// Met à jour un utilisateur (sauf identifiant et password)
export async function updateUser(userId, { prenom, initiale, role, services, magasins, equipeId }) {
  const updates = {};
  if (prenom !== undefined) updates.prenom = prenom.trim();
  if (initiale !== undefined) updates.nom_initiale = initiale.trim().toUpperCase();
  if (role !== undefined) updates.role = role;
  if (equipeId !== undefined) updates.equipe_id = equipeId || null;

  if (Object.keys(updates).length) {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) return { ok: false, error: error.message };
  }

  // Liaisons services : remplacer en totalité
  if (services !== undefined) {
    await supabase.from('users_services').delete().eq('user_id', userId);
    if (services.length) {
      const links = services.map((s) => ({ user_id: userId, service_id: s }));
      await supabase.from('users_services').insert(links);
    }
  }
  // Liaisons magasins : idem
  if (magasins !== undefined) {
    await supabase.from('users_magasins').delete().eq('user_id', userId);
    if (magasins.length) {
      const links = magasins.map((m) => ({ user_id: userId, magasin_id: m }));
      await supabase.from('users_magasins').insert(links);
    }
  }

  return { ok: true };
}

// Active/désactive un utilisateur
export async function toggleUserActif(userId, actif) {
  const { error } = await supabase.from('users').update({ actif }).eq('id', userId);
  return { ok: !error, error: error?.message };
}

// Réinitialise le mot de passe à "0000" et force le changement
export async function resetPassword(userId) {
  const hash = bcrypt.hashSync('0000', 10);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: hash, must_change_pwd: true })
    .eq('id', userId);
  return { ok: !error, error: error?.message };
}

// Supprime un utilisateur (cascade sur users_services et users_magasins)
export async function deleteUser(userId) {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  return { ok: !error, error: error?.message };
}
