// Kit de composants UI réutilisables, style des prototypes
import { useState, useRef, useEffect } from 'react';

// Nom tronqué qui révèle le nom complet au survol (desktop) ET au tap (mobile).
// Au tap, le nom se déplie sur place ; re-tap le retronque.
export function TruncatedName({ children, style = {}, as = 'div', ...props }) {
  const [expanded, setExpanded] = useState(false);
  const text = typeof children === 'string' ? children : '';
  const Tag = as;

  const base = expanded
    ? { whiteSpace: 'normal', wordBreak: 'break-word' }
    : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  return (
    <Tag
      title={text}
      onClick={(e) => {
        // Ne pas déclencher l'action de la carte parente juste pour lire le nom
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
      style={{ cursor: 'pointer', ...base, ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}

// Affiche un aperçu photo au survol (PC) et au tap (mobile).
// `trigger` est l'élément déclencheur (icône, zone…). Si pas de photoUrl, rend juste le trigger sans interaction.
const PREVIEW_SIZE = 160; // taille de la bulle photo (px)

export function PhotoPreview({ photoUrl, trigger, alt = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { left, top } calculés à l'ouverture
  const wrapRef = useRef(null);

  // Calcule la position de la bulle près de l'icône, en restant dans l'écran
  function computePosition() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bubble = PREVIEW_SIZE + 12; // taille + cadre
    const margin = 8;
    // Vertical : au-dessus si assez de place, sinon en dessous
    const placeAbove = r.top > bubble + margin;
    const top = placeAbove ? r.top - bubble - margin : r.bottom + margin;
    // Horizontal : centré sur l'icône, borné aux bords de l'écran
    let left = r.left + r.width / 2 - bubble / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - bubble - margin));
    setPos({ left, top });
  }

  function show() { computePosition(); setOpen(true); }
  function hide() { setOpen(false); }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onScroll() { setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (!photoUrl) return trigger || null;

  return (
    <span
      ref={wrapRef}
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span
        onClick={(e) => { e.stopPropagation(); open ? hide() : show(); }}
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
      >
        {trigger}
      </span>
      {open && pos && (
        <div
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            zIndex: 200,
            background: 'white',
            padding: 6,
            borderRadius: 'var(--radius)',
            border: '1.5px solid var(--line)',
            boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.18))',
          }}
        >
          <img
            src={photoUrl}
            alt={alt}
            style={{ display: 'block', width: PREVIEW_SIZE, height: PREVIEW_SIZE, objectFit: 'cover', borderRadius: 6 }}
          />
        </div>
      )}
    </span>
  );
}

export function Button({ variant = 'primary', children, className = '', ...props }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '100px',
    padding: '12px 18px',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '1.5px solid transparent',
    whiteSpace: 'nowrap',
  };
  const variants = {
    primary: { background: 'var(--orange)', color: 'white', boxShadow: 'var(--shadow-orange)' },
    secondary: { background: 'var(--white)', color: 'var(--ink)', borderColor: 'var(--line)' },
    danger: { background: 'var(--red-light)', color: 'var(--red)' },
    ghost: { background: 'transparent', color: 'var(--ink-3)' },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} className={className} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', style = {}, ...props }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--white)',
        border: '1.5px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color = 'orange' }) {
  const colors = {
    orange: { bg: 'var(--orange-light)', fg: 'var(--orange-dark)' },
    blue: { bg: 'var(--blue-light)', fg: 'var(--blue)' },
    green: { bg: 'var(--green-light)', fg: 'var(--green)' },
    purple: { bg: 'var(--purple-light)', fg: 'var(--purple)' },
    red: { bg: 'var(--red-light)', fg: 'var(--red)' },
    gray: { bg: 'var(--line-2)', fg: 'var(--ink-4)' },
  };
  const c = colors[color] || colors.orange;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: '100px',
        background: c.bg,
        color: c.fg,
      }}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 18 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: '2.5px solid rgba(255,121,0,0.2)',
        borderTopColor: 'var(--orange)',
        borderRadius: '100px',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

export function Empty({ icon = '📭', text = 'Rien à afficher', sub = '' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-4)' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink-3)', marginBottom: '6px' }}>{text}</div>
      {sub && <div style={{ fontSize: '13px' }}>{sub}</div>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <Spinner size={32} />
    </div>
  );
}

export function Denied({ title = 'Accès réservé aux admins', sub = 'Cette page nécessite des droits administrateur.' }) {
  return (
    <div
      style={{
        margin: '60px 20px',
        padding: '40px 24px',
        background: 'linear-gradient(135deg, #FFFBF6 0%, #FFF5EB 100%)',
        border: '1.5px dashed #FFD9B0',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          background: 'var(--white)',
          borderRadius: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 32,
          boxShadow: 'var(--shadow)',
        }}
      >
        🔒
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-3)', maxWidth: 320, margin: '0 auto' }}>{sub}</div>
    </div>
  );
}
