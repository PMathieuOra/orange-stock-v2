// Petits helpers réutilisables

export function initials(prenom, nomInitiale = '') {
  if (!prenom) return '?';
  const p = prenom.trim()[0] || '';
  const n = (nomInitiale || '').trim()[0] || '';
  return (p + n).toUpperCase() || p.toUpperCase();
}

export function displayName(user) {
  if (!user) return '';
  const ni = user.nom_initiale ? ` ${user.nom_initiale}.` : '';
  return `${user.prenom}${ni}`;
}

// Normalise une saisie d'identifiant au login : "Mathieu P" -> "mathieu_p"
export function normalizeIdentifiant(input) {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

export function fmtRelative(iso) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return fmtDate(d);
}

export function touretStatus(t) {
  if (t.restante === 0) return 'vide';
  if (t.restante === t.initiale) return 'neuf';
  return 'entame';
}

// Classe la quantité par rapport au seuil
export function stockLevel(qty, seuil) {
  if (qty <= seuil) return 'critical';
  if (qty <= seuil * 1.5) return 'low';
  return 'ok';
}
