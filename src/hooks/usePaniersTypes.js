import { supabase } from '../lib/supabase';
import { fetchConsos } from './useArticles';

// Liste les consommables actifs d'un couple (service, magasin) pour le sélecteur.
export async function fetchConsosForScope(service, magasin) {
  const res = await fetchConsos(service, magasin);
  if (!res.ok) return { ok: false, data: [], error: res.error };
  const list = (res.data || []).filter((a) => a.actif !== false)
    .map((a) => ({ ref: a.ref, nom: a.nom }));
  return { ok: true, data: list };
}

// Liste les paniers types d'un couple (service, magasin), avec leurs lignes
export async function fetchPaniersTypes(service, magasin) {
  const { data, error } = await supabase
    .from('paniers_types')
    .select('*, paniers_types_lignes(id, ref, nom)')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('actif', true)
    .order('nom');
  return { ok: !error, data: data || [], error: error?.message };
}

// Crée un panier type pour un couple (service, magasin)
export async function createPanierType({ nom, service, magasin, lignes, userId }) {
  if (!nom || !nom.trim()) return { ok: false, error: 'Nom requis' };
  const { data: panier, error } = await supabase
    .from('paniers_types')
    .insert({ nom: nom.trim(), service_id: service, magasin_id: magasin, actif: true, cree_par: userId || null })
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
