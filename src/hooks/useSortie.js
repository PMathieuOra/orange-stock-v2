import { supabase } from '../lib/supabase';

// Récupère les tourets disponibles pour un câble (avec restante > 0)
// On utilise l'ID du câble (toujours présent) plutôt que ref_type (qui peut être NULL)
export async function fetchTouretsForRef(cableId, service, magasin) {
  const { data: tc, error } = await supabase
    .from('types_cable')
    .select('id, nom, prix_ht, ref_type, tourets(id, ref_touret, initiale, restante)')
    .eq('id', cableId)
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .maybeSingle();
  if (error || !tc) return { ok: false, error: error?.message || 'Câble introuvable' };
  // Filtrer les tourets avec du stock
  const tourets = (tc.tourets || []).filter((t) => t.restante > 0);
  return { ok: true, nom: tc.nom, ref_type: tc.ref_type, prix_ht: tc.prix_ht || 0, tourets };
}

// Sortie de stock pour un panier
// cart = [
//   { ref, nom, type: 'conso', qty },
//   { ref, nom, type: 'cable', qty, touretId, touretRef }  // touret choisi par l'user
// ]
export async function validateSortie({ cart, service, magasin, userId, note = '' }) {
  if (!cart || cart.length === 0) return { ok: false, error: 'Panier vide' };

  // 1. Vérification préalable
  const checks = [];
  for (const item of cart) {
    if (item.type === 'conso') {
      const { data: art, error } = await supabase
        .from('articles_conso')
        .select('id, qty, nom')
        .eq('ref', item.ref)
        .eq('service_id', service)
        .eq('magasin_id', magasin)
        .maybeSingle();
      if (error) return { ok: false, error: 'Erreur lecture stock : ' + error.message };
      if (!art) return { ok: false, error: `Article ${item.ref} introuvable` };
      if (art.qty < item.qty) return { ok: false, error: `Stock insuffisant pour ${art.nom} (${art.qty} disponible, ${item.qty} demandé)` };
      checks.push({ ...item, articleId: art.id, qtyDispo: art.qty });
    } else {
      // Câble : on a un touret spécifique
      if (!item.touretId) return { ok: false, error: `Aucun touret sélectionné pour ${item.nom}` };
      const { data: t, error } = await supabase
        .from('tourets')
        .select('id, ref_touret, restante, initiale, type_cable_id')
        .eq('id', item.touretId)
        .maybeSingle();
      if (error || !t) return { ok: false, error: `Touret ${item.touretRef || item.touretId} introuvable` };
      if (t.restante < item.qty) return { ok: false, error: `Stock insuffisant sur le touret ${t.ref_touret} (${t.restante}m disponibles, ${item.qty}m demandés)` };
      checks.push({ ...item, touretData: t });
    }
  }

  // 2. Application
  const mouvementsToLog = [];
  for (const item of checks) {
    if (item.type === 'conso') {
      const nouvelleQty = item.qtyDispo - item.qty;
      const { error } = await supabase.from('articles_conso').update({ qty: nouvelleQty }).eq('id', item.articleId);
      if (error) return { ok: false, error: 'Erreur mise à jour stock : ' + error.message };
      mouvementsToLog.push({
        type: 'sortie',
        service_id: service,
        magasin_id: magasin,
        ref: item.ref,
        nom: item.nom,
        qty: -item.qty,
        user_id: userId,
        note,
      });
    } else {
      // Câble : décrémenter le touret choisi
      const t = item.touretData;
      const nouvelleRestante = t.restante - item.qty;
      const { error } = await supabase.from('tourets').update({ restante: nouvelleRestante }).eq('id', t.id);
      if (error) return { ok: false, error: 'Erreur touret : ' + error.message };

      const noteEnrichie = note
        ? `${note} | Touret ${t.ref_touret} : ${t.restante}m → ${nouvelleRestante}m`
        : `Touret ${t.ref_touret} : ${t.restante}m → ${nouvelleRestante}m`;
      mouvementsToLog.push({
        type: 'sortie',
        service_id: service,
        magasin_id: magasin,
        ref: item.ref,
        nom: item.nom,
        qty: -item.qty,
        user_id: userId,
        note: noteEnrichie,
      });
    }
  }

  // 3. Logger tous les mouvements
  if (mouvementsToLog.length) {
    const { error } = await supabase.from('mouvements').insert(mouvementsToLog);
    if (error) return { ok: false, error: 'Erreur log mouvements : ' + error.message };
  }

  return { ok: true, nbMouvements: mouvementsToLog.length };
}
