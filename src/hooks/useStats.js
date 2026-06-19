import { supabase } from '../lib/supabase';

// Calcul des bornes de période selon la sélection
export function periodRange(period) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'week':
      // Du lundi de cette semaine
      const day = start.getDay() || 7; // 1=lundi, 7=dimanche
      start.setDate(start.getDate() - (day - 1));
      break;
    case 'month':
      start.setDate(1);
      break;
    case 'quarter':
      const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
      break;
    case 'year':
      start.setMonth(0, 1);
      break;
    default:
      start.setDate(1);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

// Récupère les KPIs principaux pour un scope et une période
export async function fetchStatsKPIs({ service, magasin, period }) {
  const { start, end } = periodRange(period);

  // 1. Valeur du stock (tout)
  const { data: stock } = await supabase
    .from('v_stock_consolide')
    .select('qty, prix_ht, actif, est_critique')
    .eq('service_id', service)
    .eq('magasin_id', magasin);

  const stockActif = (stock || []).filter((s) => s.actif);
  const stockValue = stockActif.reduce((s, it) => s + it.qty * (it.prix_ht || 0), 0);
  const nbCritique = stockActif.filter((s) => s.est_critique).length;
  const nbRupture = stockActif.filter((s) => s.qty === 0).length;

  // 2. Mouvements sur la période
  const { data: mouvs } = await supabase
    .from('mouvements')
    .select('type, qty, ref, nom')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .gte('created_at', start)
    .lte('created_at', end);

  // Pour les sorties, on a besoin des prix actuels des articles concernés
  const sorties = (mouvs || []).filter((m) => m.type === 'sortie');
  const refsToFetch = [...new Set(sorties.map((m) => m.ref))];
  let prixByRef = {};
  if (refsToFetch.length > 0) {
    const [conso, cables] = await Promise.all([
      supabase
        .from('articles_conso')
        .select('ref, prix_ht')
        .eq('service_id', service)
        .eq('magasin_id', magasin)
        .in('ref', refsToFetch),
      supabase
        .from('types_cable')
        .select('ref_type, prix_ht')
        .eq('service_id', service)
        .eq('magasin_id', magasin)
        .in('ref_type', refsToFetch),
    ]);
    (conso.data || []).forEach((a) => (prixByRef[a.ref] = a.prix_ht || 0));
    (cables.data || []).forEach((c) => (prixByRef[c.ref_type] = c.prix_ht || 0));
  }
  const coutSorties = sorties.reduce((s, m) => s + Math.abs(m.qty) * (prixByRef[m.ref] || 0), 0);

  // 3. Coût des commandes créées sur la période
  const { data: commandes } = await supabase
    .from('commandes')
    .select('id, type, commande_lignes(ref, qty_commandee)')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .gte('date_creation', start.slice(0, 10))
    .lte('date_creation', end.slice(0, 10));

  let coutCommandes = 0;
  for (const cmd of commandes || []) {
    const refs = (cmd.commande_lignes || []).map((l) => l.ref);
    if (!refs.length) continue;
    const table = cmd.type === 'cable' ? 'types_cable' : 'articles_conso';
    const refCol = cmd.type === 'cable' ? 'ref_type' : 'ref';
    const { data: arts } = await supabase
      .from(table)
      .select(`${refCol}, prix_ht`)
      .eq('service_id', service)
      .eq('magasin_id', magasin)
      .in(refCol, refs);
    const prixCmd = {};
    (arts || []).forEach((a) => (prixCmd[a[refCol]] = a.prix_ht || 0));
    for (const l of cmd.commande_lignes || []) {
      coutCommandes += l.qty_commandee * (prixCmd[l.ref] || 0);
    }
  }

  return {
    stockValue,
    coutSorties,
    coutCommandes,
    nbCritique,
    nbRupture,
    nbMouvements: (mouvs || []).length,
    nbCommandes: (commandes || []).length,
  };
}

// Récupère le top des techniciens et articles sur la période
export async function fetchTops({ service, magasin, period, limit = 5 }) {
  const { start, end } = periodRange(period);

  const { data: mouvs } = await supabase
    .from('mouvements')
    .select('ref, nom, qty, user_id, users(prenom, nom_initiale, avatar_couleur)')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('type', 'sortie')
    .gte('created_at', start)
    .lte('created_at', end);

  // Top articles : agrégés par ref
  // value principal = nombre de sorties (1 mouvement = 1 sortie)
  // qty totale = somme des quantités (pour info)
  const articlesMap = {};
  (mouvs || []).forEach((m) => {
    if (!articlesMap[m.ref]) articlesMap[m.ref] = { ref: m.ref, nom: m.nom, sorties: 0, qtyTotale: 0 };
    articlesMap[m.ref].sorties += 1;
    articlesMap[m.ref].qtyTotale += Math.abs(m.qty);
  });
  const topArticles = Object.values(articlesMap)
    .sort((a, b) => b.sorties - a.sorties)
    .slice(0, limit);

  // Top techniciens : agrégés par user_id
  const techMap = {};
  (mouvs || []).forEach((m) => {
    if (!m.user_id || !m.users) return;
    if (!techMap[m.user_id]) {
      techMap[m.user_id] = {
        user_id: m.user_id,
        prenom: m.users.prenom,
        nom_initiale: m.users.nom_initiale,
        avatar_couleur: m.users.avatar_couleur,
        sorties: 0,
        unites: 0,
      };
    }
    techMap[m.user_id].sorties++;
    techMap[m.user_id].unites += Math.abs(m.qty);
  });
  const topTechniciens = Object.values(techMap)
    .sort((a, b) => b.sorties - a.sorties)
    .slice(0, limit);

  return { topArticles, topTechniciens };
}

// Récupère les données pour le graphique d'évolution sur 12 mois
export async function fetchEvolution({ service, magasin, months = 12 }) {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - (months - 1), 1);
  start.setHours(0, 0, 0, 0);

  const { data: mouvs } = await supabase
    .from('mouvements')
    .select('type, qty, created_at')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .in('type', ['sortie', 'entree'])
    .gte('created_at', start.toISOString());

  // Init des buckets pour chaque mois
  const buckets = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - (months - 1 - i), 1);
    buckets.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
      year: d.getFullYear(),
      sorties: 0,
      entrees: 0,
    });
  }

  (mouvs || []).forEach((m) => {
    const key = m.created_at.slice(0, 7);
    const bucket = buckets.find((b) => b.key === key);
    if (!bucket) return;
    // Compter le NOMBRE de mouvements (1 sortie de 200m = 1 mouvement, pas 200)
    if (m.type === 'sortie') bucket.sorties += 1;
    else if (m.type === 'entree') bucket.entrees += 1;
  });

  return buckets;
}

// Récupère la liste des articles en rupture (qty=0)
export async function fetchRuptures({ service, magasin }) {
  const { data } = await supabase
    .from('v_stock_consolide')
    .select('*')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('actif', true)
    .eq('qty', 0)
    .order('nom');
  return data || [];
}

// Récupère l'évolution des commandes (nombre + coût total) sur la période
// Granularité : week/month => par jour, quarter/year => par mois
export async function fetchCommandesEvolution({ service, magasin, period }) {
  const { start, end } = periodRange(period);
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Détermine la granularité
  const useMonthly = period === 'quarter' || period === 'year';

  // Récupérer les commandes du périmètre dans la période
  const { data: commandes } = await supabase
    .from('commandes')
    .select('id, date_creation, type, commande_lignes(ref, qty_commandee)')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .gte('date_creation', start)
    .lte('date_creation', end)
    .order('date_creation');

  if (!commandes || commandes.length === 0) {
    return { buckets: buildBuckets(startDate, endDate, useMonthly), totalCout: 0, totalNb: 0, moyCout: 0 };
  }

  // Récupérer les prix des articles concernés (conso + câbles)
  const consoRefs = [];
  const cableRefs = [];
  commandes.forEach((c) => {
    (c.commande_lignes || []).forEach((l) => {
      if (c.type === 'cable') cableRefs.push(l.ref);
      else consoRefs.push(l.ref);
    });
  });

  const [{ data: consos }, { data: cables }] = await Promise.all([
    consoRefs.length > 0
      ? supabase.from('articles_conso').select('ref, prix_ht').eq('service_id', service).eq('magasin_id', magasin).in('ref', consoRefs)
      : Promise.resolve({ data: [] }),
    cableRefs.length > 0
      ? supabase.from('types_cable').select('ref_type, prix_ht').eq('service_id', service).eq('magasin_id', magasin).in('ref_type', cableRefs)
      : Promise.resolve({ data: [] }),
  ]);

  const consoPrix = {};
  (consos || []).forEach((c) => { consoPrix[c.ref] = c.prix_ht || 0; });
  const cablePrix = {};
  (cables || []).forEach((c) => { cablePrix[c.ref_type] = c.prix_ht || 0; });

  // Calculer le coût de chaque commande
  function coutCommande(cmd) {
    return (cmd.commande_lignes || []).reduce((s, l) => {
      const prix = cmd.type === 'cable' ? (cablePrix[l.ref] || 0) : (consoPrix[l.ref] || 0);
      return s + prix * l.qty_commandee;
    }, 0);
  }

  // Initialiser les buckets
  const buckets = buildBuckets(startDate, endDate, useMonthly);

  // Remplir les buckets
  let totalCout = 0;
  commandes.forEach((c) => {
    const cout = coutCommande(c);
    totalCout += cout;
    const d = new Date(c.date_creation);
    const key = bucketKey(d, useMonthly);
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) {
      bucket.nb += 1;
      bucket.cout += cout;
    }
  });

  const totalNb = commandes.length;
  const moyCout = totalNb > 0 ? totalCout / totalNb : 0;

  return { buckets, totalCout, totalNb, moyCout };
}

// Construit les buckets sur la période donnée
function buildBuckets(startDate, endDate, monthly) {
  const buckets = [];
  if (monthly) {
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur <= last) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      buckets.push({
        key: `${yyyy}-${mm}`,
        label: cur.toLocaleDateString('fr-FR', { month: 'short' }),
        year: yyyy,
        nb: 0,
        cout: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    while (cur <= last) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      buckets.push({
        key: `${yyyy}-${mm}-${dd}`,
        label: cur.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        year: yyyy,
        nb: 0,
        cout: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
  }
  return buckets;
}

function bucketKey(d, monthly) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  if (monthly) return `${yyyy}-${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
