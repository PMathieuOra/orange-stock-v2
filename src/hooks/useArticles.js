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

export async function createConso({ ref, nom, seuil, prix_ht, emplacement, photo_url, service, magasin }) {
  const { data, error } = await supabase
    .from('articles_conso')
    .insert({
      ref,
      nom,
      seuil: parseInt(seuil) || 0,
      prix_ht: parseFloat(prix_ht) || 0,
      emplacement: emplacement?.trim() || null,
      photo_url: photo_url || null,
      qty: 0,
      service_id: service,
      magasin_id: magasin,
      actif: true,
    })
    .select()
    .single();
  return { ok: !error, data, error: error?.message };
}

export async function updateConso(id, { ref, nom, seuil, prix_ht, emplacement, photo_url, qty, userId, oldQty }) {
  const updates = {};
  if (ref !== undefined) updates.ref = ref;
  if (nom !== undefined) updates.nom = nom;
  if (seuil !== undefined) updates.seuil = parseInt(seuil) || 0;
  if (prix_ht !== undefined) updates.prix_ht = parseFloat(prix_ht) || 0;
  if (emplacement !== undefined) updates.emplacement = emplacement?.trim() || null;
  if (photo_url !== undefined) updates.photo_url = photo_url || null;
  if (qty !== undefined) updates.qty = Math.max(0, parseInt(qty) || 0);

  const { error } = await supabase.from('articles_conso').update(updates).eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Si la quantité a changé, logguer un mouvement d'ajustement
  if (qty !== undefined && oldQty !== undefined && updates.qty !== oldQty) {
    const diff = updates.qty - oldQty;
    // Récupérer les infos de l'article pour logguer correctement
    const { data: article } = await supabase
      .from('articles_conso')
      .select('ref, nom, service_id, magasin_id')
      .eq('id', id)
      .single();
    if (article) {
      await supabase.from('mouvements').insert({
        type: 'ajustement',
        service_id: article.service_id,
        magasin_id: article.magasin_id,
        ref: article.ref,
        nom: article.nom,
        qty: diff,
        user_id: userId || null,
        note: `Ajustement manuel : ${oldQty} → ${updates.qty}`,
      });
    }
  }

  return { ok: true };
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

export async function updateCable(id, { ref_type, nom, categorie, seuil, prix_ht }) {
  const updates = {};
  if (ref_type !== undefined) updates.ref_type = ref_type || null;  // vide = null
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

export async function createTouret({ ref_touret, type_cable_id, initiale, emplacement }) {
  const init = parseInt(initiale);
  if (!init || init <= 0) return { ok: false, error: 'Longueur invalide' };
  const { data, error } = await supabase
    .from('tourets')
    .insert({
      ref_touret,
      type_cable_id,
      initiale: init,
      restante: init,
      emplacement: emplacement?.trim() || null,
    })
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

// Met à jour uniquement l'emplacement d'un touret
export async function updateTouretEmplacement(id, emplacement) {
  const { error } = await supabase
    .from('tourets')
    .update({ emplacement: emplacement?.trim() || null })
    .eq('id', id);
  return { ok: !error, error: error?.message };
}

export async function deleteTouret(id) {
  const { error } = await supabase.from('tourets').delete().eq('id', id);
  return { ok: !error, error: error?.message };
}

// Récupère la liste des emplacements distincts utilisés dans un scope (pour autocomplete)
export async function fetchEmplacementsSuggestions(service, magasin) {
  const set = new Set();
  // Conso
  const { data: c } = await supabase
    .from('articles_conso')
    .select('emplacement')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .not('emplacement', 'is', null);
  (c || []).forEach((x) => { if (x.emplacement) set.add(x.emplacement); });
  // Tourets (joints au type_cable pour filtrer par scope)
  const { data: t } = await supabase
    .from('tourets')
    .select('emplacement, types_cable!inner(service_id, magasin_id)')
    .eq('types_cable.service_id', service)
    .eq('types_cable.magasin_id', magasin)
    .not('emplacement', 'is', null);
  (t || []).forEach((x) => { if (x.emplacement) set.add(x.emplacement); });
  return Array.from(set).sort();
}

// Récupère tous les tourets d'un périmètre, groupés par type_cable_id (pour l'export)
export async function fetchAllTouretsForScope(service, magasin) {
  const { data, error } = await supabase
    .from('tourets')
    .select('id, ref_touret, initiale, restante, emplacement, type_cable_id, types_cable!inner(service_id, magasin_id)')
    .eq('types_cable.service_id', service)
    .eq('types_cable.magasin_id', magasin)
    .order('ref_touret');
  if (error) return { ok: false, byCable: {}, error: error.message };
  const byCable = {};
  (data || []).forEach((t) => {
    if (!byCable[t.type_cable_id]) byCable[t.type_cable_id] = [];
    byCable[t.type_cable_id].push({
      ref_touret: t.ref_touret,
      initiale: t.initiale,
      restante: t.restante,
      emplacement: t.emplacement,
    });
  });
  return { ok: true, byCable };
}

// ===== PHOTOS DE CONSOMMABLES (Supabase Storage) =====
const PHOTO_BUCKET = 'consommables';

// Redimensionne une image (max 1000px) et la compresse en JPEG avant upload,
// pour éviter de stocker des photos de plusieurs Mo prises au téléphone.
function compressImage(file, maxSize = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width); width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height); height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compression échouée')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload une photo pour un consommable, renvoie l'URL publique
export async function uploadConsoPhoto(file, { service, magasin, ref }) {
  try {
    const blob = await compressImage(file);
    const safeRef = String(ref || 'item').replace(/[^a-zA-Z0-9_-]/g, '');
    const path = `${service}/${magasin}/${safeRef}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) return { ok: false, error: error.message };
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl, path };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Supprime une photo du storage à partir de son URL publique
export async function deleteConsoPhoto(photoUrl) {
  if (!photoUrl) return { ok: true };
  try {
    // Extraire le chemin après le nom du bucket dans l'URL publique
    const marker = `/${PHOTO_BUCKET}/`;
    const idx = photoUrl.indexOf(marker);
    if (idx === -1) return { ok: true }; // URL non reconnue, on ignore
    const path = photoUrl.slice(idx + marker.length);
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { ok: !error, error: error?.message };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
