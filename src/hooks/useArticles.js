import { supabase } from '../lib/supabase';

// ===== ARTICLES CONSO =====

export async function fetchConsos(service, magasin) {
  const { data, error } = await supabase
    .from('articles_conso')
    .select('*')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .order('nom');
  return { ok: !error, data: data || [], error: error?.message };
}

export async function createConso({ ref, nom, seuil, prix_ht, service, magasin }) {
  const { data, error } = await supabase
    .from('articles_conso')
    .insert({
      ref,
      nom,
      seuil: parseInt(seuil) || 0,
      prix_ht: parseFloat(prix_ht) || 0,
      qty: 0,
      service_id: service,
      magasin_id: magasin,
      actif: true,
    })
    .select()
    .single();
  return { ok: !error, data, error: error?.message };
}

export async function updateConso(id, { nom, seuil, prix_ht }) {
  const updates = {};
  if (nom !== undefined) updates.nom = nom;
  if (seuil !== undefined) updates.seuil = parseInt(seuil) || 0;
  if (prix_ht !== undefined) updates.prix_ht = parseFloat(prix_ht) || 0;
  const { error } = await supabase.from('articles_conso').update(updates).eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function toggleConsoActif(id, actif) {
  const { error } = await supabase.from('articles_conso').update({ actif }).eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function deleteConso(id) {
  const { error } = await supabase.from('articles_conso').delete().eq('id', id);
  return { ok: !error, error: error?.message };
}

// ===== TYPES CABLE =====

export async function fetchCables(service, magasin) {
  const { data, error } = await supabase
    .from('types_cable')
    .select('*')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .order('nom');
  return { ok: !error, data: data || [], error: error?.message };
}

export async function createCable({ ref_type, nom, categorie, seuil, prix_ht, service, magasin }) {
  const { data, error } = await supabase
    .from('types_cable')
    .insert({
      ref_type,
      nom,
      categorie,
      seuil: parseInt(seuil) || 0,
      prix_ht: parseFloat(prix_ht) || 0,
      service_id: service,
      magasin_id: magasin,
      actif: true,
    })
    .select()
    .single();
  return { ok: !error, data, error: error?.message };
}

export async function updateCable(id, { nom, categorie, seuil, prix_ht }) {
  const updates = {};
  if (nom !== undefined) updates.nom = nom;
  if (categorie !== undefined) updates.categorie = categorie;
  if (seuil !== undefined) updates.seuil = parseInt(seuil) || 0;
  if (prix_ht !== undefined) updates.prix_ht = parseFloat(prix_ht) || 0;
  const { error } = await supabase.from('types_cable').update(updates).eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function toggleCableActif(id, actif) {
  const { error } = await supabase.from('types_cable').update({ actif }).eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function deleteCable(id) {
  // Les tourets liés seront supprimés en cascade (FK on delete cascade)
  const { error } = await supabase.from('types_cable').delete().eq('id', id);
  return { ok: !error, error: error?.message };
}

// ===== TOURETS =====

export async function fetchTouretsForCable(typeCableId) {
  const { data, error } = await supabase
    .from('tourets')
    .select('*')
    .eq('type_cable_id', typeCableId)
    .order('ref_touret');
  return { ok: !error, data: data || [], error: error?.message };
}

export async function createTouret({ ref_touret, type_cable_id, initiale }) {
  const init = parseInt(initiale);
  if (!init || init <= 0) return { ok: false, error: 'Longueur invalide' };
  const { data, error } = await supabase
    .from('tourets')
    .insert({ ref_touret, type_cable_id, initiale: init, restante: init })
    .select()
    .single();
  return { ok: !error, data, error: error?.message };
}

export async function updateTouretRestante(id, restante, initiale) {
  const r = parseInt(restante);
  if (isNaN(r) || r < 0 || r > initiale) return { ok: false, error: 'Longueur invalide' };
  const { error } = await supabase.from('tourets').update({ restante: r }).eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function deleteTouret(id) {
  const { error } = await supabase.from('tourets').delete().eq('id', id);
  return { ok: !error, error: error?.message };
}
