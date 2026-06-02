import { supabase } from '../lib/supabase';

// Sortie de stock pour un panier
// cart = [{ ref, nom, type, qty }]
// Pour les conso : décrémente articles_conso.qty
// Pour les câbles : décrémente les tourets (entamés en priorité, puis neufs)
// Logue chaque mouvement dans mouvements
export async function validateSortie({ cart, service, magasin, userId, note = '' }) {
  if (!cart || cart.length === 0) return { ok: false, error: 'Panier vide' };

  // 1. Vérification préalable : on a bien le stock pour tout
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
      // Câble : récupérer le type + ses tourets
      const { data: tc, error: e1 } = await supabase
        .from('types_cable')
        .select('id, nom, tourets(id, ref_touret, initiale, restante)')
        .eq('ref_type', item.ref)
        .eq('service_id', service)
        .eq('magasin_id', magasin)
        .maybeSingle();
      if (e1) return { ok: false, error: 'Erreur lecture câbles : ' + e1.message };
      if (!tc) return { ok: false, error: `Câble ${item.ref} introuvable` };
      const totalDispo = (tc.tourets || []).reduce((s, t) => s + t.restante, 0);
      if (totalDispo < item.qty) return { ok: false, error: `Stock insuffisant pour ${tc.nom} (${totalDispo}m disponible, ${item.qty}m demandé)` };
      checks.push({ ...item, typeCableId: tc.id, tourets: tc.tourets || [], qtyDispo: totalDispo });
    }
  }

  // 2. Application : décrémenter le stock + logger
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
      // Câble : décrémenter les tourets dans l'ordre : entamés (restante > 0 et < initiale) d'abord, puis neufs
      let reste = item.qty;
      const sortedTourets = [...item.tourets].sort((a, b) => {
        const aEntame = a.restante > 0 && a.restante < a.initiale;
        const bEntame = b.restante > 0 && b.restante < b.initiale;
        if (aEntame && !bEntame) return -1;
        if (!aEntame && bEntame) return 1;
        // Sinon, plus petit restant d'abord (vider les bobines presque finies)
        return a.restante - b.restante;
      });

      const touretUpdates = [];
      for (const t of sortedTourets) {
        if (reste <= 0) break;
        if (t.restante <= 0) continue;
        const prise = Math.min(t.restante, reste);
        touretUpdates.push({ id: t.id, ref_touret: t.ref_touret, nouvelleRestante: t.restante - prise, prise });
        reste -= prise;
      }
      // Appliquer
      for (const u of touretUpdates) {
        const { error } = await supabase.from('tourets').update({ restante: u.nouvelleRestante }).eq('id', u.id);
        if (error) return { ok: false, error: 'Erreur touret : ' + error.message };
      }
      // Note enrichie : liste des tourets utilisés
      const noteEnrichie = note
        ? `${note} | Tourets : ${touretUpdates.map((u) => `${u.ref_touret}(-${u.prise}m)`).join(', ')}`
        : `Tourets : ${touretUpdates.map((u) => `${u.ref_touret}(-${u.prise}m)`).join(', ')}`;
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

  // 3. Logger tous les mouvements d'un coup
  if (mouvementsToLog.length) {
    const { error } = await supabase.from('mouvements').insert(mouvementsToLog);
    if (error) return { ok: false, error: 'Erreur log mouvements : ' + error.message };
  }

  return { ok: true, nbMouvements: mouvementsToLog.length };
}
