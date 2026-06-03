import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ===== TEMPLATE =====

const TEMPLATE_HEADERS = ['ref', 'nom', 'seuil', 'qty', 'prix_ht'];
const TEMPLATE_EXAMPLES = [
  ['PRJ45-C6', 'Patch RJ45 Cat6 1m', 10, 42, 0.85],
  ['F-OM4-LC2', 'Jarretière fibre OM4 LC-LC 2m', 15, 12, 12.50],
  ['EMB-RJ45', 'Embout RJ45 Cat6 (lot 50)', 5, 4, 8.20],
];

// Génère un fichier Excel modèle et déclenche le téléchargement
export function downloadTemplate(format = 'xlsx') {
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
  // Largeurs de colonnes
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
