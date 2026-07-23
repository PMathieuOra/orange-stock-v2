import { supabase } from '../lib/supabase';

// Effectue le transfert d'un touret vers un autre périmètre (service+magasin)
// Cherche un type_cable correspondant en destination (par nom+categorie), le crée si absent
// Met à jour le touret pour qu'il pointe vers le bon type_cable
// Enregistre dans transferts_tourets pour traçabilité
export async function transferTouret({ touretId, destService, destMagasin, motif, userId }) {
  // 1. Charger le touret source
  const { data: touret, error: e1 } = await supabase
    .from('tourets')
    .select('id, ref_touret, restante, type_cable_id, types_cable(id, ref_type, nom, categorie, seuil, prix_ht, service_id, magasin_id)')
    .eq('id', touretId)
    .single();
  if (e1 || !touret) return { ok: false, error: 'Touret introuvable' };

  const sourceType = touret.types_cable;
  if (!sourceType) return { ok: false, error: 'Type de câble source introuvable' };

  // 2. Vérifier : on ne transfère pas vers le même périmètre
  if (sourceType.service_id === destService && sourceType.magasin_id === destMagasin) {
    return { ok: false, error: 'Le touret est déjà dans ce périmètre' };
  }

  // 3. Chercher un type_cable correspondant dans le périmètre de destination
  // (par nom + categorie, qui sont les clés métier)
  const { data: existing } = await supabase
    .from('types_cable')
    .select('id, ref_type')
    .eq('service_id', destService)
    .eq('magasin_id', destMagasin)
    .eq('nom', sourceType.nom)
    .eq('categorie', sourceType.categorie)
    .maybeSingle();

  let destTypeCableId;
  if (existing) {
    destTypeCableId = existing.id;
    // Mettre à jour l'EAN si manquant en destination
    if (!existing.ref_type && sourceType.ref_type) {
      await supabase
        .from('types_cable')
        .update({ ref_type: sourceType.ref_type })
        .eq('id', existing.id);
    }
  } else {
    // Créer le type en destination
    const { data: created, error: eCreate } = await supabase
      .from('types_cable')
      .insert({
        ref_type: sourceType.ref_type,
        nom: sourceType.nom,
        categorie: sourceType.categorie,
        seuil: sourceType.seuil,
        prix_ht: sourceType.prix_ht,
        service_id: destService,
        magasin_id: destMagasin,
        actif: true,
      })
      .select('id')
      .single();
    if (eCreate) return { ok: false, error: 'Erreur création type câble en destination : ' + eCreate.message };
    destTypeCableId = created.id;
  }

  // 4. Rattacher le touret au nouveau type
  const { error: eUpdate } = await supabase
    .from('tourets')
    .update({ type_cable_id: destTypeCableId })
    .eq('id', touretId);
  if (eUpdate) return { ok: false, error: 'Erreur transfert touret : ' + eUpdate.message };

  // 5. Enregistrer la trace
  await supabase
    .from('transferts_tourets')
    .insert({
      touret_id: touretId,
      ref_touret: touret.ref_touret,
      nom_cable: sourceType.nom,
      longueur_transferee: touret.restante,
      service_source: sourceType.service_id,
      magasin_source: sourceType.magasin_id,
      type_cable_source: sourceType.id,
      service_dest: destService,
      magasin_dest: destMagasin,
      type_cable_dest: destTypeCableId,
      motif: motif?.trim() || null,
      cree_par: userId,
    });

  return { ok: true };
}

// Liste l'historique des transferts d'un touret
export async function fetchTransfertsTouret(touretId) {
  const { data, error } = await supabase
    .from('transferts_tourets')
    .select('*')
    .eq('touret_id', touretId)
    .order('created_at', { ascending: false });
  return { ok: !error, data: data || [] };
}
