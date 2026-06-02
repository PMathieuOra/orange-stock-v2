import { supabase } from '../lib/supabase';

// Génère le prochain numéro de commande via la fonction SQL
export async function genNumeroCommande() {
  const { data, error } = await supabase.rpc('generer_numero_commande');
  if (error) {
    // Fallback : génération côté client si la RPC échoue
    const year = new Date().getFullYear().toString().slice(-2);
    return `FM${year}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
  }
  return data;
}

// Récupère les articles disponibles pour un scope (pour les lignes de commande)
export async function fetchArticlesForScope(service, magasin, type) {
  if (type === 'cable') {
    const { data } = await supabase
      .from('types_cable')
      .select('ref_type, nom, categorie, prix_ht')
      .eq('service_id', service)
      .eq('magasin_id', magasin)
      .eq('actif', true)
      .order('nom');
    return (data || []).map((c) => ({ ref: c.ref_type, nom: c.nom, prix_ht: c.prix_ht || 0 }));
  }
  const { data } = await supabase
    .from('articles_conso')
    .select('ref, nom, prix_ht')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('actif', true)
    .order('nom');
  return (data || []).map((c) => ({ ...c, prix_ht: c.prix_ht || 0 }));
}

// Crée une commande + ses lignes
export async function createCommande({ numero, type, service, magasin, lignes, userId, dateCreation }) {
  const { data: cmd, error: e1 } = await supabase
    .from('commandes')
    .insert({
      numero,
      type,
      service_id: service,
      magasin_id: magasin,
      statut: 'en_cours',
      date_creation: dateCreation || new Date().toISOString().slice(0, 10),
      cree_par: userId,
    })
    .select()
    .single();
  if (e1) return { ok: false, error: e1.message };

  const lignesPayload = lignes.map((l) => ({
    commande_id: cmd.id,
    ref: l.ref,
    qty_commandee: l.qty_commandee,
    qty_recue: 0,
  }));
  const { error: e2 } = await supabase.from('commande_lignes').insert(lignesPayload);
  if (e2) return { ok: false, error: e2.message };

  return { ok: true, commande: cmd };
}

// Met à jour les lignes d'une commande (édition)
export async function updateCommandeLignes(commandeId, lignes) {
  // Supprime les anciennes lignes et réinsère (simple et robuste pour la démo)
  await supabase.from('commande_lignes').delete().eq('commande_id', commandeId);
  const payload = lignes.map((l) => ({
    commande_id: commandeId,
    ref: l.ref,
    qty_commandee: l.qty_commandee,
    qty_recue: l.qty_recue || 0,
  }));
  const { error } = await supabase.from('commande_lignes').insert(payload);
  return { ok: !error, error: error?.message };
}

// Réception : met à jour qty_recue, le statut, et logue dans mouvements + incrémente le stock conso
export async function receptionCommande(commande, receptions, userId) {
  // receptions = [{ ligneId, ref, qtyAjout }]
  // 1. Mettre à jour chaque ligne
  for (const r of receptions) {
    if (r.qtyAjout <= 0) continue;
    const ligne = commande.commande_lignes.find((l) => l.id === r.ligneId);
    if (!ligne) continue;
    const nouvelleQtyRecue = ligne.qty_recue + r.qtyAjout;
    await supabase
      .from('commande_lignes')
      .update({ qty_recue: nouvelleQtyRecue })
      .eq('id', r.ligneId);

    // 2. Logger le mouvement (entrée)
    await supabase.from('mouvements').insert({
      type: 'entree',
      service_id: commande.service_id,
      magasin_id: commande.magasin_id,
      ref: r.ref,
      nom: `Réception ${commande.numero}`,
      qty: r.qtyAjout,
      user_id: userId,
      commande_numero: commande.numero,
    });

    // 3. Incrémenter le stock (uniquement pour les consommables ;
    //    pour les câbles, la réception ajoute des tourets → géré séparément)
    if (commande.type === 'conso') {
      const { data: art } = await supabase
        .from('articles_conso')
        .select('id, qty')
        .eq('ref', r.ref)
        .eq('service_id', commande.service_id)
        .eq('magasin_id', commande.magasin_id)
        .maybeSingle();
      if (art) {
        await supabase
          .from('articles_conso')
          .update({ qty: art.qty + r.qtyAjout })
          .eq('id', art.id);
      }
    }
  }

  // 4. Recalculer le statut global
  const { data: lignesAJour } = await supabase
    .from('commande_lignes')
    .select('*')
    .eq('commande_id', commande.id);
  const toutRecu = (lignesAJour || []).every((l) => l.qty_recue >= l.qty_commandee);
  const newStatut = toutRecu ? 'recu_total' : 'en_cours';
  await supabase
    .from('commandes')
    .update({
      statut: newStatut,
      date_reception: toutRecu ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', commande.id);

  return { ok: true, statut: newStatut };
}

// Archive une commande
export async function archiveCommande(commandeId) {
  const { error } = await supabase
    .from('commandes')
    .update({ statut: 'archivee' })
    .eq('id', commandeId);
  return { ok: !error, error: error?.message };
}

// Supprime une commande
export async function deleteCommande(commandeId) {
  const { error } = await supabase.from('commandes').delete().eq('id', commandeId);
  return { ok: !error, error: error?.message };
}
