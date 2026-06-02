// Kit de composants UI réutilisables, style des prototypes

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
