import { supabase } from '../lib/supabase';

// Liste les consommables actifs d'un magasin (tous services), dédupliqués par référence.
// Sert au sélecteur d'articles lors de la création d'un panier type.
export async function fetchConsosByMagasin(magasin) {
  const { data, error } = await supabase
    .from('articles_conso')
    .select('ref, nom')
    .eq('magasin_id', magasin)
    .eq('actif', true)
    .order('nom');
  if (error) return { ok: false, data: [], error: error.message };
  // Dédupliquer par ref (un même consommable peut exister sur plusieurs services)
  const seen = new Set();
  const uniq = [];
  (data || []).forEach((a) => {
    if (!seen.has(a.ref)) { seen.add(a.ref); uniq.push(a); }
  });
  return { ok: true, data: uniq };
}

// Liste les paniers types d'un magasin, avec leurs lignes
export async function fetchPaniersTypes(magasin) {
  const { data, error } = await supabase
    .from('paniers_types')
    .select('*, paniers_types_lignes(id, ref, nom)')
    .eq('magasin_id', magasin)
    .eq('actif', true)
    .order('nom');
  return { ok: !error, data: data || [], error: error?.message };
}

// Crée un panier type avec ses lignes (refs de consommables)
export async function createPanierType({ nom, magasin, lignes, userId }) {
  if (!nom || !nom.trim()) return { ok: false, error: 'Nom requis' };
  const { data: panier, error } = await supabase
    .from('paniers_types')
    .insert({ nom: nom.trim(), magasin_id: magasin, actif: true, cree_par: userId || null })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  if (lignes && lignes.length > 0) {
    const rows = lignes.map((l) => ({ panier_id: panier.id, ref: l.ref, nom: l.nom || null }));
    const { error: e2 } = await supabase.from('paniers_types_lignes').insert(rows);
    if (e2) return { ok: false, error: 'Panier créé mais ajout des articles échoué : ' + e2.message };
  }
  return { ok: true, panier };
}

// Met à jour un panier type : nom + remplace ses lignes
export async function updatePanierType(id, { nom, lignes }) {
  if (nom !== undefined) {
    const { error } = await supabase.from('paniers_types').update({ nom: nom.trim() }).eq('id', id);
    if (error) return { ok: false, error: error.message };
  }
  if (lignes !== undefined) {
    // Remplacer toutes les lignes
    await supabase.from('paniers_types_lignes').delete().eq('panier_id', id);
    if (lignes.length > 0) {
      const rows = lignes.map((l) => ({ panier_id: id, ref: l.ref, nom: l.nom || null }));
      const { error } = await supabase.from('paniers_types_lignes').insert(rows);
      if (error) return { ok: false, error: error.message };
    }
  }
  return { ok: true };
}

// Supprime un panier type (les lignes partent en cascade)
export async function deletePanierType(id) {
  const { error } = await supabase.from('paniers_types').delete().eq('id', id);
  return { ok: !error, error: error?.message };
}
