import { supabase } from '../lib/supabase';

// Liste tous les magasins avec leurs services
export async function fetchMagasins() {
  const { data, error } = await supabase
    .from('magasins')
    .select('*, magasins_services(service_id)')
    .order('nom');
  return { ok: !error, data: data || [], error: error?.message };
}

// Stats d'un magasin (nb users, articles, commandes)
export async function fetchMagasinStats(magasinId) {
  const [users, conso, cables, commandes, tourets] = await Promise.all([
    supabase.from('users_magasins').select('user_id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    supabase.from('articles_conso').select('id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    supabase.from('types_cable').select('id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    supabase.from('commandes').select('id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    // Tourets : à travers types_cable
    supabase.from('types_cable').select('id, tourets(id)').eq('magasin_id', magasinId),
  ]);

  const touretsCount = (tourets.data || []).reduce((sum, t) => sum + (t.tourets?.length || 0), 0);

  return {
    nbUsers: users.count || 0,
    nbConso: conso.count || 0,
    nbCables: cables.count || 0,
    nbCommandes: commandes.count || 0,
    nbTourets: touretsCount,
  };
}

// Génère un slug d'id depuis le nom (ex : "Saint-Quentin" → "saint_quentin")
export function slugify(nom) {
  return nom
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Crée un magasin
export async function createMagasin({ id, nom, services, icon = '🏪' }) {
  if (!id || !nom) return { ok: false, error: 'Identifiant et nom requis' };

  console.log('[createMagasin] Tentative insert magasin:', { id, nom, icon });
  const { data: magasin, error } = await supabase
    .from('magasins')
    .insert({ id, nom: nom.trim(), icon, actif: true })
    .select()
    .single();

  if (error) {
    console.error('[createMagasin] Erreur insert magasin:', error);
    return { ok: false, error: `Impossible de créer le magasin : ${error.message} (code: ${error.code || 'N/A'})` };
  }

  console.log('[createMagasin] Magasin créé:', magasin);

  // Liaison services
  if (services && services.length > 0) {
    const links = services.map((s) => ({ magasin_id: id, service_id: s }));
    console.log('[createMagasin] Insert magasins_services:', links);
    const { error: linkErr } = await supabase.from('magasins_services').insert(links);
    if (linkErr) {
      console.error('[createMagasin] Erreur insert liaison services:', linkErr);
      return { ok: false, error: `Magasin créé mais liaison services échouée : ${linkErr.message}` };
    }
  }

  return { ok: true, magasin };
}

// Met à jour un magasin
export async function updateMagasin(magasinId, { nom, services, icon }) {
  const updates = {};
  if (nom !== undefined) updates.nom = nom.trim();
  if (icon !== undefined) updates.icon = icon;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('magasins')
      .update(updates)
      .eq('id', magasinId);
    if (error) return { ok: false, error: error.message };
  }

  if (services !== undefined) {
    await supabase.from('magasins_services').delete().eq('magasin_id', magasinId);
    if (services.length) {
      const links = services.map((s) => ({ magasin_id: magasinId, service_id: s }));
      const { error } = await supabase.from('magasins_services').insert(links);
      if (error) return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

// Active/désactive
export async function toggleMagasinActif(magasinId, actif) {
  const { error } = await supabase.from('magasins').update({ actif }).eq('id', magasinId);
  return { ok: !error, error: error?.message };
}

// Supprime un magasin (avec vérification d'usage)
export async function deleteMagasin(magasinId) {
  // Vérifier l'usage
  const [conso, cables, users, cmds] = await Promise.all([
    supabase.from('articles_conso').select('id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    supabase.from('types_cable').select('id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    supabase.from('users_magasins').select('user_id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
    supabase.from('commandes').select('id', { count: 'exact', head: true }).eq('magasin_id', magasinId),
  ]);

  const blockers = [];
  if (conso.count > 0) blockers.push(`${conso.count} consommable(s)`);
  if (cables.count > 0) blockers.push(`${cables.count} type(s) de câble`);
  if (users.count > 0) blockers.push(`${users.count} utilisateur(s)`);
  if (cmds.count > 0) blockers.push(`${cmds.count} commande(s)`);

  if (blockers.length > 0) {
    return {
      ok: false,
      error: `Magasin utilisé : ${blockers.join(', ')}. Supprimez ou déplacez ces éléments d'abord, ou désactivez le magasin.`,
    };
  }

  const { error } = await supabase.from('magasins').delete().eq('id', magasinId);
  return { ok: !error, error: error?.message };
}
