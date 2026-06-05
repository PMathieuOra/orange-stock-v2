import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ===== TEMPLATE CONSO =====

const TEMPLATE_HEADERS = ['ref', 'nom', 'seuil', 'qty', 'prix_ht'];
const TEMPLATE_EXAMPLES = [
  ['PRJ45-C6', 'Patch RJ45 Cat6 1m', 10, 42, 0.85],
  ['F-OM4-LC2', 'Jarretière fibre OM4 LC-LC 2m', 15, 12, 12.50],
  ['EMB-RJ45', 'Embout RJ45 Cat6 (lot 50)', 5, 4, 8.20],
];

// ===== TEMPLATE CABLES =====

const CABLE_TEMPLATE_HEADERS = ['ref_touret', 'nom_type', 'categorie', 'longueur', 'ref_type', 'seuil', 'prix_ht'];
const CABLE_TEMPLATE_EXAMPLES = [
  ['AC-2024-001', 'L1041 12FO', 'fibre', 1000, '3760024112345', 500, 1.20],
  ['AC-2024-002', 'L1041 12FO', 'fibre', 850, '', 500, 1.20],
  ['AC-2024-003', 'L1041 12FO', 'fibre', 1000, '', 500, 1.20],
  ['AC-CU-101', '88 56 6', 'cuivre', 305, '', 200, 0.45],
];

// Génère un fichier Excel modèle pour les conso et déclenche le téléchargement
export function downloadConsoTemplate(format = 'xlsx') {
  if (format === 'csv') {
    const csv = [
      TEMPLATE_HEADERS.join(','),
      ...TEMPLATE_EXAMPLES.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, 'modele-import-conso.csv');
    return;
  }

  // Excel
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  ws['!cols'] = [{ wch: 18 }, { wch: 38 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consommables');

  // Feuille d'aide
  const help = XLSX.utils.aoa_to_sheet([
    ['MODE D\'EMPLOI'],
    [],
    ['Colonne', 'Description', 'Obligatoire'],
    ['ref', 'Référence unique de l\'article (ex: PRJ45-C6)', 'Oui'],
    ['nom', 'Nom complet affiché dans l\'app', 'Oui'],
    ['seuil', 'Seuil d\'alerte critique (entier ≥ 0)', 'Oui'],
    ['qty', 'Quantité initiale en stock (entier ≥ 0)', 'Oui'],
    ['prix_ht', 'Prix unitaire HT en euros (ex: 8.50). 0 si inconnu', 'Non'],
    [],
    ['Conseils :'],
    ['- Les lignes avec une ref déjà existante seront ignorées'],
    ['- Le service et le magasin de destination sont définis par les pastilles dans l\'app au moment de l\'import'],
    ['- Vous pouvez supprimer les lignes d\'exemple avant d\'importer'],
    ['- Pour le prix : utilisez le point comme séparateur décimal (8.50 et non 8,50)'],
  ]);
  help['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, help, 'Aide');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, 'modele-import-conso.xlsx');
}

// Alias pour rétro-compat (le code existant utilise downloadTemplate)
export const downloadTemplate = downloadConsoTemplate;

// Génère un fichier Excel modèle pour les câbles + tourets
export function downloadCableTemplate(format = 'xlsx') {
  if (format === 'csv') {
    const csv = [
      CABLE_TEMPLATE_HEADERS.join(','),
      ...CABLE_TEMPLATE_EXAMPLES.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, 'modele-import-cables.csv');
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet([CABLE_TEMPLATE_HEADERS, ...CABLE_TEMPLATE_EXAMPLES]);
  ws['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tourets');

  // Feuille d'aide
  const help = XLSX.utils.aoa_to_sheet([
    ['MODE D\'EMPLOI — Import câbles & tourets'],
    [],
    ['1 ligne = 1 touret. Le type de câble est déduit automatiquement.'],
    ['Plusieurs tourets du même type (même nom_type + categorie) sont rattachés au même type.'],
    ['L\'EAN (ref_type) est optionnel : si absent, vous pourrez l\'ajouter plus tard.'],
    [],
    ['Colonne', 'Description', 'Obligatoire'],
    ['ref_touret', 'Nom unique du touret physique (ex: AC-2024-001)', 'Oui'],
    ['nom_type', 'Typologie du câble (ex: "L1041 12FO" ou "88 56 6")', 'Oui'],
    ['categorie', '"fibre" ou "cuivre" uniquement', 'Oui'],
    ['longueur', 'Longueur initiale du touret en mètres', 'Oui'],
    ['ref_type', 'EAN du produit pour les commandes (peut être vide)', 'Non'],
    ['seuil', 'Seuil d\'alerte du type de câble en mètres (somme des tourets)', 'Non (0)'],
    ['prix_ht', 'Prix au mètre HT en euros (ex: 1.20)', 'Non (0)'],
    [],
    ['Conseils :'],
    ['- Les tourets avec une ref_touret déjà existante seront ignorés'],
    ['- Si une typologie (nom_type + categorie) existe déjà, les tourets y sont rattachés'],
    ['- L\'EAN peut être vide ; il pourra être renseigné plus tard dans la fiche article'],
    ['- Le service et le magasin sont définis par les pastilles dans l\'app'],
    ['- Pour les valeurs décimales (prix), utilisez le point (1.20 et non 1,20)'],
    ['- Si la catégorie est mal saisie, la ligne sera ignorée'],
  ]);
  help['!cols'] = [{ wch: 14 }, { wch: 60 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, help, 'Aide');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, 'modele-import-cables.xlsx');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== PARSING =====

// Lit un fichier Excel ou CSV et renvoie un tableau d'objets {ref, nom, seuil, qty}
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const isCSV = ext === 'csv';

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, {
      type: 'array',
      cellDates: false,
      // Pour CSV, indiquer l'encoding
      ...(isCSV ? { raw: true } : {}),
    });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    if (rows.length === 0) {
      return { ok: false, error: 'Fichier vide' };
    }

    // Détecter la ligne d'entête : chercher une ligne contenant 'ref' et 'nom'
    // On accepte plusieurs variantes de noms pour chaque colonne (insensible casse/accents/espaces).
    const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').trim();

    const COL_ALIASES = {
      ref:     ['ref', 'reference', 'reference', 'code'],
      nom:     ['nom', 'libelle', 'designation', 'description', 'name'],
      seuil:   ['seuil', 'seuilalerte', 'alerte', 'min', 'minimum', 'stockmin'],
      qty:     ['qty', 'quantite', 'qte', 'quantity', 'stock'],
      prix_ht: ['prix_ht', 'prixht', 'prix', 'prixunitaire', 'tarif', 'pu', 'puht', 'cout', 'price'],
    };

    function findCol(row, aliases) {
      for (let i = 0; i < row.length; i++) {
        if (aliases.includes(normalize(row[i]))) return i;
      }
      return -1;
    }

    let headerIdx = -1;
    let headerMap = null;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = (rows[i] || []).map((c) => String(c).trim());
      const refIdx = findCol(row, COL_ALIASES.ref);
      const nomIdx = findCol(row, COL_ALIASES.nom);
      if (refIdx >= 0 && nomIdx >= 0) {
        headerIdx = i;
        headerMap = {
          ref: refIdx,
          nom: nomIdx,
          seuil: findCol(row, COL_ALIASES.seuil),
          qty: findCol(row, COL_ALIASES.qty),
          prix_ht: findCol(row, COL_ALIASES.prix_ht), // -1 si absente = OK
        };
        break;
      }
    }

    if (headerIdx === -1) {
      return {
        ok: false,
        error: 'Entête introuvable. Le fichier doit contenir une ligne avec les colonnes : ref, nom, seuil, qty',
      };
    }

    const items = [];
    const errors = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const ref = String(row[headerMap.ref] ?? '').trim();
      const nom = String(row[headerMap.nom] ?? '').trim();
      const seuilRaw = headerMap.seuil >= 0 ? row[headerMap.seuil] : 0;
      const qtyRaw = headerMap.qty >= 0 ? row[headerMap.qty] : 0;
      const prixRaw = headerMap.prix_ht >= 0 ? row[headerMap.prix_ht] : '';

      // Ligne entièrement vide → skip silencieux
      if (!ref && !nom) continue;

      // Validation
      if (!ref) {
        errors.push(`Ligne ${i + 1} : référence vide`);
        continue;
      }
      if (!nom) {
        errors.push(`Ligne ${i + 1} (${ref}) : nom vide`);
        continue;
      }
      // Parser seuil et qty avec tolérance (vide → 0)
      let seuil = 0;
      if (seuilRaw !== '' && seuilRaw !== null && seuilRaw !== undefined) {
        seuil = parseInt(seuilRaw);
        if (isNaN(seuil) || seuil < 0) {
          errors.push(`Ligne ${i + 1} (${ref}) : seuil invalide`);
          continue;
        }
      }
      let qty = 0;
      if (qtyRaw !== '' && qtyRaw !== null && qtyRaw !== undefined) {
        qty = parseInt(qtyRaw);
        if (isNaN(qty) || qty < 0) {
          errors.push(`Ligne ${i + 1} (${ref}) : qty invalide`);
          continue;
        }
      }

      // Prix : accepter virgule ou point, vide = 0
      let prix_ht = 0;
      if (prixRaw !== '' && prixRaw !== null && prixRaw !== undefined) {
        const prixStr = String(prixRaw).replace(',', '.').replace(/[^\d.-]/g, '');
        const p = parseFloat(prixStr);
        if (!isNaN(p) && p >= 0) prix_ht = p;
      }

      items.push({ ref, nom, seuil, qty, prix_ht });
    }

    return { ok: true, items, errors };
  } catch (e) {
    return { ok: false, error: 'Erreur de lecture du fichier : ' + e.message };
  }
}

// ===== IMPORT =====

// Importe les items dans la base, en sautant les doublons.
// Renvoie un rapport détaillé.
export async function importConsos({ items, service, magasin }) {
  if (!items || items.length === 0) return { ok: false, error: 'Aucun article à importer' };

  // 0. Dédupliquer les items dans le fichier lui-même (garder la première occurrence)
  const seenRefs = new Set();
  const dedupedItems = [];
  const dupesInFile = [];
  for (const it of items) {
    if (seenRefs.has(it.ref)) {
      dupesInFile.push(it.ref);
    } else {
      seenRefs.add(it.ref);
      dedupedItems.push(it);
    }
  }

  // 1. Récupérer toutes les refs existantes pour ce scope
  const refsToCheck = dedupedItems.map((i) => i.ref);
  const { data: existing, error: e1 } = await supabase
    .from('articles_conso')
    .select('ref')
    .eq('service_id', service)
    .eq('magasin_id', magasin)
    .in('ref', refsToCheck);

  if (e1) return { ok: false, error: 'Erreur lecture base : ' + e1.message };

  const existingRefs = new Set((existing || []).map((r) => r.ref));

  // 2. Filtrer ce qui est à insérer
  const toInsert = [];
  const skipped = [...dupesInFile]; // les doublons du fichier sont aussi des "skipped"
  for (const it of dedupedItems) {
    if (existingRefs.has(it.ref)) {
      skipped.push(it.ref);
    } else {
      toInsert.push({
        ref: it.ref,
        nom: it.nom,
        seuil: it.seuil,
        qty: it.qty,
        prix_ht: it.prix_ht || 0,
        service_id: service,
        magasin_id: magasin,
        actif: true,
      });
    }
  }

  // 3. Insérer (par batches de 100 pour gérer les gros imports)
  let inserted = 0;
  const insertErrors = [];
  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('articles_conso').insert(batch);
    if (error) {
      // Si le batch entier échoue (souvent un conflit caché), insertion ligne par ligne pour identifier
      let batchOk = 0;
      for (const row of batch) {
        const { error: rowErr } = await supabase.from('articles_conso').insert([row]);
        if (rowErr) {
          // Conflit silencieux : ajouter à skipped
          if (rowErr.code === '23505' || rowErr.message?.includes('duplicate')) {
            skipped.push(row.ref);
          } else {
            insertErrors.push(`${row.ref} : ${rowErr.message}`);
          }
        } else {
          batchOk++;
        }
      }
      inserted += batchOk;
    } else {
      inserted += batch.length;
    }
  }

  return {
    ok: true,
    inserted,
    skipped,
    insertErrors,
    total: items.length,
  };
}

// ===== PARSING CABLES =====

// Lit un fichier Excel ou CSV pour les câbles et renvoie un tableau de tourets
export async function parseCableFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const isCSV = ext === 'csv';

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, {
      type: 'array',
      cellDates: false,
      ...(isCSV ? { raw: true } : {}),
    });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

    if (rows.length === 0) {
      return { ok: false, error: 'Fichier vide' };
    }

    // Détecter la ligne d'entête (insensible casse/accents/espaces)
    const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').trim();

    const COL_ALIASES = {
      ref_touret: ['ref_touret', 'reftouret', 'reftouret', 'touret', 'reftour', 'numerotouret', 'numtouret', 'ntouret'],
      ref_type: ['ref_type', 'reftype', 'reftype', 'refcable', 'ref_cable', 'codecable', 'codetype', 'code'],
      nom_type: ['nom_type', 'nomtype', 'nomcable', 'nom_cable', 'designation', 'libelle', 'nom'],
      categorie: ['categorie', 'category', 'cat', 'type'],
      longueur: ['longueur', 'longinitial', 'longueurinitiale', 'initiale', 'length', 'metre', 'metres', 'm'],
      seuil: ['seuil', 'seuilalerte', 'alerte', 'min', 'minimum'],
      prix_ht: ['prix_ht', 'prixht', 'prix', 'prixunitaire', 'prixmetre', 'tarif', 'pu', 'puht', 'cout'],
    };

    function findCol(row, aliases) {
      for (let i = 0; i < row.length; i++) {
        if (aliases.includes(normalize(row[i]))) return i;
      }
      return -1;
    }

    let headerIdx = -1;
    let headerMap = null;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = (rows[i] || []).map((c) => String(c).trim());
      const refTouretIdx = findCol(row, COL_ALIASES.ref_touret);
      const nomTypeIdx = findCol(row, COL_ALIASES.nom_type);
      if (refTouretIdx >= 0 && nomTypeIdx >= 0) {
        headerIdx = i;
        headerMap = {
          ref_touret: refTouretIdx,
          ref_type: findCol(row, COL_ALIASES.ref_type), // -1 si absente = OK
          nom_type: nomTypeIdx,
          categorie: findCol(row, COL_ALIASES.categorie),
          longueur: findCol(row, COL_ALIASES.longueur),
          seuil: findCol(row, COL_ALIASES.seuil),
          prix_ht: findCol(row, COL_ALIASES.prix_ht),
        };
        break;
      }
    }

    if (headerIdx === -1) {
      return {
        ok: false,
        error: 'Entête introuvable. Le fichier doit contenir au minimum les colonnes : ref_touret, nom_type',
      };
    }

    const items = [];
    const errors = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const ref_touret = String(row[headerMap.ref_touret] ?? '').trim();
      const ref_type = headerMap.ref_type >= 0 ? String(row[headerMap.ref_type] ?? '').trim() : '';
      const nom_type = String(row[headerMap.nom_type] ?? '').trim();
      const categorieRaw = String(row[headerMap.categorie] ?? '').trim().toLowerCase();
      const longueurRaw = headerMap.longueur >= 0 ? row[headerMap.longueur] : '';
      const seuilRaw = headerMap.seuil >= 0 ? row[headerMap.seuil] : 0;
      const prixRaw = headerMap.prix_ht >= 0 ? row[headerMap.prix_ht] : '';

      // Ligne entièrement vide → skip silencieux
      if (!ref_touret && !nom_type) continue;

      // Validation : ref_touret + nom_type obligatoires
      if (!ref_touret) {
        errors.push(`Ligne ${i + 1} : ref_touret vide`);
        continue;
      }
      if (!nom_type) {
        errors.push(`Ligne ${i + 1} (${ref_touret}) : nom_type vide`);
        continue;
      }
      // Catégorie
      let categorie = null;
      const catNorm = categorieRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (catNorm === 'fibre' || catNorm === 'fibres' || catNorm === 'fo') categorie = 'fibre';
      else if (catNorm === 'cuivre' || catNorm === 'cu') categorie = 'cuivre';
      else {
        errors.push(`Ligne ${i + 1} (${ref_touret}) : catégorie invalide ("${categorieRaw}", attendu : fibre ou cuivre)`);
        continue;
      }
      // Longueur
      const longueur = parseInt(longueurRaw);
      if (isNaN(longueur) || longueur <= 0) {
        errors.push(`Ligne ${i + 1} (${ref_touret}) : longueur invalide`);
        continue;
      }
      // Seuil
      let seuil = 0;
      if (seuilRaw !== '' && seuilRaw !== null && seuilRaw !== undefined) {
        seuil = parseInt(seuilRaw);
        if (isNaN(seuil) || seuil < 0) seuil = 0;
      }
      // Prix
      let prix_ht = 0;
      if (prixRaw !== '' && prixRaw !== null && prixRaw !== undefined) {
        const prixStr = String(prixRaw).replace(',', '.').replace(/[^\d.-]/g, '');
        const p = parseFloat(prixStr);
        if (!isNaN(p) && p >= 0) prix_ht = p;
      }

      // ref_type: null si vide (pas de string vide en base)
      const refTypeValue = ref_type || null;

      items.push({ ref_touret, ref_type: refTypeValue, nom_type, categorie, longueur, seuil, prix_ht });
    }

    return { ok: true, items, errors };
  } catch (e) {
    return { ok: false, error: 'Erreur de lecture du fichier : ' + e.message };
  }
}

// ===== IMPORT CABLES =====

// Importe les câbles + tourets dans la base
// 1. Pour chaque ref_type unique : créer le type_cable s'il n'existe pas
// 2. Pour chaque ref_touret : créer le touret s'il n'existe pas
export async function importCables({ items, service, magasin }) {
  if (!items || items.length === 0) return { ok: false, error: 'Aucun touret à importer' };

  // 0. Dédupliquer les ref_touret dans le fichier (garder la 1ère)
  const seenTourets = new Set();
  const dedupedItems = [];
  const dupesInFile = [];
  for (const it of items) {
    if (seenTourets.has(it.ref_touret)) {
      dupesInFile.push(it.ref_touret);
    } else {
      seenTourets.add(it.ref_touret);
      dedupedItems.push(it);
    }
  }

  // 1. Identifier les types de câbles uniques (clé : nom_type + categorie)
  // L'EAN (ref_type) est ajouté au type uniquement si fourni au moins une fois
  const typesByKey = {};
  const typeKey = (nom, cat) => `${nom}|||${cat}`;

  for (const it of dedupedItems) {
    const key = typeKey(it.nom_type, it.categorie);
    if (!typesByKey[key]) {
      typesByKey[key] = {
        key,
        nom: it.nom_type,
        categorie: it.categorie,
        ref_type: it.ref_type || null,
        seuil: it.seuil,
        prix_ht: it.prix_ht,
      };
    } else if (it.ref_type && !typesByKey[key].ref_type) {
      // Si une autre ligne du même type a renseigné l'EAN, on le prend
      typesByKey[key].ref_type = it.ref_type;
    }
  }
  const uniqueKeys = Object.keys(typesByKey);

  // 2. Récupérer les types existants dans ce scope
  // Recherche par (nom, categorie) car ref_type peut être null
  const { data: existingTypes, error: e1 } = await supabase
    .from('types_cable')
    .select('id, ref_type, nom, categorie')
    .eq('service_id', service)
    .eq('magasin_id', magasin);

  if (e1) return { ok: false, error: 'Erreur lecture types câble : ' + e1.message };

  // Map des types existants par clé (nom|||categorie)
  const typeIdByKey = {};
  const existingByKey = {};
  (existingTypes || []).forEach((t) => {
    const key = typeKey(t.nom, t.categorie);
    typeIdByKey[key] = t.id;
    existingByKey[key] = t;
  });

  // 3. Créer les types manquants (et mettre à jour ceux qui n'avaient pas d'EAN)
  const typesToCreate = uniqueKeys
    .filter((k) => !typeIdByKey[k])
    .map((k) => {
      const t = typesByKey[k];
      return {
        ref_type: t.ref_type,  // peut être null
        nom: t.nom,
        categorie: t.categorie,
        seuil: t.seuil,
        prix_ht: t.prix_ht,
        service_id: service,
        magasin_id: magasin,
        actif: true,
      };
    });

  let typesCreated = 0;
  if (typesToCreate.length > 0) {
    const { data: created, error: e2 } = await supabase
      .from('types_cable')
      .insert(typesToCreate)
      .select('id, nom, categorie');
    if (e2) return { ok: false, error: 'Erreur création types câble : ' + e2.message };
    (created || []).forEach((t) => { typeIdByKey[typeKey(t.nom, t.categorie)] = t.id; });
    typesCreated = created?.length || 0;
  }

  // 3 bis. Mettre à jour les EAN manquants des types existants
  // (si le fichier renseigne un EAN pour un type qui n'en avait pas)
  let typesUpdated = 0;
  for (const k of uniqueKeys) {
    const existingType = existingByKey[k];
    const fileType = typesByKey[k];
    if (existingType && !existingType.ref_type && fileType.ref_type) {
      await supabase
        .from('types_cable')
        .update({ ref_type: fileType.ref_type })
        .eq('id', existingType.id);
      typesUpdated++;
    }
  }

  // 4. Récupérer les tourets existants pour skip
  const touretRefsToCheck = dedupedItems.map((i) => i.ref_touret);
  const { data: existingTourets, error: e3 } = await supabase
    .from('tourets')
    .select('ref_touret')
    .in('ref_touret', touretRefsToCheck);

  if (e3) return { ok: false, error: 'Erreur lecture tourets : ' + e3.message };

  const existingTouretRefs = new Set((existingTourets || []).map((t) => t.ref_touret));

  // 5. Préparer les tourets à insérer
  const touretsToInsert = [];
  const skipped = [...dupesInFile];
  for (const it of dedupedItems) {
    if (existingTouretRefs.has(it.ref_touret)) {
      skipped.push(it.ref_touret);
    } else {
      const typeCableId = typeIdByKey[typeKey(it.nom_type, it.categorie)];
      if (!typeCableId) {
        skipped.push(it.ref_touret);
        continue;
      }
      touretsToInsert.push({
        ref_touret: it.ref_touret,
        type_cable_id: typeCableId,
        initiale: it.longueur,
        restante: it.longueur,
      });
    }
  }

  // 6. Insérer les tourets par batches
  let touretsInserted = 0;
  const insertErrors = [];
  const BATCH = 100;
  for (let i = 0; i < touretsToInsert.length; i += BATCH) {
    const batch = touretsToInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('tourets').insert(batch);
    if (error) {
      // Fallback ligne par ligne
      for (const row of batch) {
        const { error: rowErr } = await supabase.from('tourets').insert([row]);
        if (rowErr) {
          if (rowErr.code === '23505' || rowErr.message?.includes('duplicate')) {
            skipped.push(row.ref_touret);
          } else {
            insertErrors.push(`${row.ref_touret} : ${rowErr.message}`);
          }
        } else {
          touretsInserted++;
        }
      }
    } else {
      touretsInserted += batch.length;
    }
  }

  return {
    ok: true,
    typesCreated,
    typesUpdated,
    touretsInserted,
    skipped,
    insertErrors,
    total: items.length,
  };
}
