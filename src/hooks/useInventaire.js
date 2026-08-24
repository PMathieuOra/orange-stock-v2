import { supabase } from '../lib/supabase';

// Calcule la semaine ISO actuelle (ex: "2026-W26") + lundi
export function getCurrentWeek() {
  const now = new Date();
  // Lundi de la semaine courante
  const dayOfWeek = now.getDay() || 7; // 1=lundi ... 7=dimanche
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // Numéro de semaine ISO
  const target = new Date(monday.valueOf());
  const thursday = new Date(target.valueOf());
  thursday.setDate(target.getDate() + 3);
  const firstJan = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = 1 + Math.round(((thursday - firstJan) / 86400000 - 3 + ((firstJan.getDay() + 6) % 7)) / 7);

  return {
    semaine_iso: `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
    date_debut: monday.toISOString().slice(0, 10),
    lundi: monday,
  };
}

// Récupère ou crée l'inventaire de la semaine courante pour le scope
// Si nouvelle semaine : tire 5 conso au hasard pondérés par usage (30 derniers jours)
export async function getOrCreateWeeklyInventory({ service, magasin, userId, nbItems = 5 }) {
  const { semaine_iso, date_debut } = getCurrentWeek();

  // 1. Vérifier si l'inventaire de la semaine existe déjà
  const { data: existing } = await supabase
    .from('inventaires_hebdo')
    .select('*')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('semaine_iso', semaine_iso)
    .maybeSingle();

  if (existing) {
    // Charger les checks
    return loadInventoryWithChecks(existing.id);
  }

  // 2. Tirage : récupérer tous les conso actifs avec leur usage (sorties des 30 derniers jours)
  const date30 = new Date();
  date30.setDate(date30.getDate() - 30);
  const date30Iso = date30.toISOString();

  const { data: articles } = await supabase
    .from('articles_conso')
    .select('id, ref, nom, qty, seuil')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('actif', true);

  if (!articles || articles.length === 0) {
    return { ok: false, error: 'Aucun article actif dans ce périmètre.' };
  }

  // Récupérer les mouvements de sortie sur 30 jours pour calculer le poids
  const { data: mouvs } = await supabase
    .from('mouvements')
    .select('ref, qty')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .eq('type', 'sortie')
    .gte('created_at', date30Iso);

  // Compteur d'usage par ref
  const usageByRef = {};
  (mouvs || []).forEach((m) => {
    usageByRef[m.ref] = (usageByRef[m.ref] || 0) + 1;
  });

  // Calculer le poids de chaque article (usage + 1 pour éviter les zéros)
  const weighted = articles.map((a) => ({
    ...a,
    weight: (usageByRef[a.ref] || 0) + 1,
  }));

  // Tirage pondéré sans remise
  const picked = weightedRandomSample(weighted, Math.min(nbItems, weighted.length));

  // 3. Créer l'inventaire
  const { data: inv, error: errInv } = await supabase
    .from('inventaires_hebdo')
    .insert({
      service_id: service,
      magasin_id: magasin,
      semaine_iso,
      date_debut,
      cree_par: userId,
    })
    .select()
    .single();

  if (errInv) return { ok: false, error: errInv.message };

  // 4. Créer les checks pour les items tirés
  const checksPayload = picked.map((a) => ({
    inventaire_id: inv.id,
    article_id: a.id,
    qty_theorique: a.qty,
  }));

  const { error: errChecks } = await supabase
    .from('inventaire_checks')
    .insert(checksPayload);

  if (errChecks) return { ok: false, error: errChecks.message };

  return loadInventoryWithChecks(inv.id);
}

// Charge l'inventaire + ses checks avec infos articles
async function loadInventoryWithChecks(inventaireId) {
  const { data: inv, error: errInv } = await supabase
    .from('inventaires_hebdo')
    .select('*')
    .eq('id', inventaireId)
    .single();
  if (errInv) return { ok: false, error: errInv.message };

  const { data: checks } = await supabase
    .from('inventaire_checks')
    .select('*')
    .eq('inventaire_id', inventaireId);

  if (!checks || checks.length === 0) {
    return { ok: true, inventaire: inv, checks: [] };
  }

  // Récupérer les infos des articles
  const articleIds = checks.map((c) => c.article_id);
  const { data: articles } = await supabase
    .from('articles_conso')
    .select('id, ref, nom, qty, seuil, emplacement')
    .in('id', articleIds);

  const articleMap = {};
  (articles || []).forEach((a) => { articleMap[a.id] = a; });

  const enrichedChecks = checks.map((c) => ({
    ...c,
    article: articleMap[c.article_id] || null,
  }));

  return { ok: true, inventaire: inv, checks: enrichedChecks };
}

// Tirage aléatoire pondéré sans remise
function weightedRandomSample(items, n) {
  const result = [];
  const pool = items.map((it) => ({ ...it }));
  for (let i = 0; i < n && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) { idx = j; break; }
    }
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

// Valide un check d'inventaire (saisie de la quantité comptée)
// Si écart : crée automatiquement une régularisation
export async function validateInventoryCheck({ checkId, qtyComptee, userId, regulariser = true }) {
  // 1. Charger le check
  const { data: check, error: e0 } = await supabase
    .from('inventaire_checks')
    .select('*, inventaires_hebdo(service_id, magasin_id)')
    .eq('id', checkId)
    .single();
  if (e0 || !check) return { ok: false, error: 'Check introuvable' };

  const qty = parseInt(qtyComptee);
  if (isNaN(qty) || qty < 0) return { ok: false, error: 'Quantité invalide' };

  const ecart = qty - check.qty_theorique;

  // 2. Mettre à jour le check
  const { error: e1 } = await supabase
    .from('inventaire_checks')
    .update({
      qty_comptee: qty,
      ecart,
      controle_par: userId,
      controle_at: new Date().toISOString(),
    })
    .eq('id', checkId);
  if (e1) return { ok: false, error: e1.message };

  // 3. Si écart et regulariser demandé : appliquer la régul
  if (ecart !== 0 && regulariser) {
    // Charger l'article pour son ref/nom actuels
    const { data: article } = await supabase
      .from('articles_conso')
      .select('id, ref, nom, qty')
      .eq('id', check.article_id)
      .single();

    if (article) {
      // Mettre à jour le stock
      await supabase
        .from('articles_conso')
        .update({ qty })
        .eq('id', check.article_id);

      // Enregistrer la régul
      await supabase
        .from('regularisations')
        .insert({
          service_id: check.inventaires_hebdo.service_id,
          magasin_id: check.inventaires_hebdo.magasin_id,
          article_id: check.article_id,
          ref: article.ref,
          nom: article.nom,
          qty_avant: check.qty_theorique,
          qty_apres: qty,
          ecart,
          motif: 'Inventaire hebdomadaire',
          source: 'inventaire',
          inventaire_id: check.inventaire_id,
          cree_par: userId,
        });
    }
  }

  return { ok: true, ecart };
}

// Crée une régularisation manuelle (depuis l'onglet régul)
export async function createRegularisation({ articleId, qtyApres, motif, userId, service, magasin }) {
  // 1. Charger l'article
  const { data: article, error: e0 } = await supabase
    .from('articles_conso')
    .select('id, ref, nom, qty')
    .eq('id', articleId)
    .single();
  if (e0 || !article) return { ok: false, error: 'Article introuvable' };

  const qty = parseInt(qtyApres);
  if (isNaN(qty) || qty < 0) return { ok: false, error: 'Quantité invalide' };
  if (qty === article.qty) return { ok: false, error: 'Aucun changement' };

  const ecart = qty - article.qty;

  // 2. Mettre à jour le stock
  const { error: e1 } = await supabase
    .from('articles_conso')
    .update({ qty })
    .eq('id', articleId);
  if (e1) return { ok: false, error: e1.message };

  // 3. Enregistrer la régul
  const { error: e2 } = await supabase
    .from('regularisations')
    .insert({
      service_id: service,
      magasin_id: magasin,
      article_id: articleId,
      ref: article.ref,
      nom: article.nom,
      qty_avant: article.qty,
      qty_apres: qty,
      ecart,
      motif: motif?.trim() || null,
      source: 'manual',
      cree_par: userId,
    });
  if (e2) return { ok: false, error: e2.message };

  return { ok: true, ecart };
}

// Liste les régularisations du scope, triées par date desc
export async function fetchRegularisations({ service, magasin, limit = 50 }) {
  // 1. Récupérer les régul
  const { data, error } = await supabase
    .from('regularisations')
    .select('*')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, data: [], error: error.message };
  if (!data || data.length === 0) return { ok: true, data: [] };

  // 2. Récupérer les utilisateurs concernés (pour le nom)
  const userIds = [...new Set(data.map((r) => r.cree_par).filter(Boolean))];
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, prenom, nom_initiale')
      .in('id', userIds);
    const userMap = {};
    (users || []).forEach((u) => { userMap[u.id] = u; });
    data.forEach((r) => { r.users = userMap[r.cree_par] || null; });
  }

  return { ok: true, data };
}

// Stats des régularisations (calculées côté React car pas de vue SQL)
export async function fetchRegulStats({ service, magasin }) {
  // 1. Récupérer toutes les régul du scope
  const { data: regs } = await supabase
    .from('regularisations')
    .select('cree_par, ecart, created_at')
    .eq('service_id', service)
    .eq('magasin_id', magasin);

  if (!regs || regs.length === 0) return [];

  // 2. Agréger par utilisateur
  const byUser = {};
  regs.forEach((r) => {
    if (!r.cree_par) return;
    if (!byUser[r.cree_par]) {
      byUser[r.cree_par] = {
        user_id: r.cree_par,
        nb_regul: 0,
        total_ecart_abs: 0,
        total_ajout: 0,
        total_retrait: 0,
        derniere_regul: r.created_at,
      };
    }
    const u = byUser[r.cree_par];
    u.nb_regul += 1;
    u.total_ecart_abs += Math.abs(r.ecart);
    if (r.ecart > 0) u.total_ajout += r.ecart;
    else u.total_retrait += Math.abs(r.ecart);
    if (new Date(r.created_at) > new Date(u.derniere_regul)) {
      u.derniere_regul = r.created_at;
    }
  });

  // 3. Récupérer les noms des utilisateurs
  const userIds = Object.keys(byUser);
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, prenom, nom_initiale')
      .in('id', userIds);
    (users || []).forEach((u) => {
      if (byUser[u.id]) {
        byUser[u.id].prenom = u.prenom;
        byUser[u.id].nom_initiale = u.nom_initiale;
      }
    });
  }

  // 4. Trier par nb_regul desc
  return Object.values(byUser).sort((a, b) => b.nb_regul - a.nb_regul);
}

// Tendances des régularisations : nombre par mois + top articles (par nombre de régul)
// Périmètre : service + magasin actifs. Ne concerne que les consommables (seuls régularisés).
export async function fetchRegulTrends({ service, magasin, monthsBack = 12, topN = 10 }) {
  const { data: regs, error } = await supabase
    .from('regularisations')
    .select('ref, nom, ecart, created_at')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, byMonth: [], topArticles: [], total: 0, error: error.message };
  if (!regs || regs.length === 0) return { ok: true, byMonth: [], topArticles: [], total: 0 };

  // --- 1. Regroupement par mois (les monthsBack derniers mois, y compris ceux à 0) ---
  const now = new Date();
  const monthKeys = [];
  const monthLabels = {};
  const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
    monthLabels[key] = `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  }
  const countByMonth = {};
  monthKeys.forEach((k) => { countByMonth[k] = 0; });

  regs.forEach((r) => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in countByMonth) countByMonth[key] += 1;
  });

  const byMonth = monthKeys.map((k) => ({ key: k, label: monthLabels[k], count: countByMonth[k] }));

  // --- 2. Top articles par NOMBRE de régul (regroupé par ref+nom) ---
  const byArticle = {};
  regs.forEach((r) => {
    const key = `${r.ref}|${r.nom}`;
    if (!byArticle[key]) {
      byArticle[key] = { ref: r.ref, nom: r.nom, nb_regul: 0, total_ajout: 0, total_retrait: 0 };
    }
    const a = byArticle[key];
    a.nb_regul += 1;
    if (r.ecart > 0) a.total_ajout += r.ecart;
    else a.total_retrait += Math.abs(r.ecart);
  });

  const topArticles = Object.values(byArticle)
    .sort((a, b) => b.nb_regul - a.nb_regul)
    .slice(0, topN);

  return { ok: true, byMonth, topArticles, total: regs.length };
}
