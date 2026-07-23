import { supabase } from '../lib/supabase';

// Entrée de stock pour un panier de consommables
// cart = [{ ref, nom, qty }]
// Pour chaque article : incrémente articles_conso.qty et logue dans mouvements (type='entree')
export async function validateEntree({ cart, service, magasin, userId }) {
  if (!cart || cart.length === 0) return { ok: false, error: 'Panier vide' };

  // 1. Récupération des articles concernés (pour validation + obtention des ids)
  const checks = [];
  for (const item of cart) {
    if (!item.qty || item.qty <= 0) {
      return { ok: false, error: `Quantité invalide pour ${item.nom}` };
    }
    const { data: art, error } = await supabase
      .from('articles_conso')
      .select('id, qty, nom')
      .eq('ref', item.ref)
      .eq('service_id', service)
      .eq('magasin_id', magasin)
      .maybeSingle();
    if (error) return { ok: false, error: 'Erreur lecture stock : ' + error.message };
    if (!art) return { ok: false, error: `Article ${item.ref} introuvable` };
    checks.push({ ...item, articleId: art.id, qtyDispo: art.qty });
  }

  // 2. Application : incrémenter les stocks + logger
  const mouvementsToLog = [];
  for (const item of checks) {
    const nouvelleQty = item.qtyDispo + item.qty;
    const { error } = await supabase.from('articles_conso').update({ qty: nouvelleQty }).eq('id', item.articleId);
    if (error) return { ok: false, error: 'Erreur mise à jour stock : ' + error.message };

    mouvementsToLog.push({
      type: 'entree',
      service_id: service,
      magasin_id: magasin,
      ref: item.ref,
      nom: item.nom,
      qty: item.qty, // positif pour une entrée
      user_id: userId,
      note: 'Retour technicien',
    });
  }

  // 3. Logger tous les mouvements
  if (mouvementsToLog.length) {
    const { error } = await supabase.from('mouvements').insert(mouvementsToLog);
    if (error) return { ok: false, error: 'Erreur log mouvements : ' + error.message };
  }

  return { ok: true, nbMouvements: mouvementsToLog.length };
}
