import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { initials, displayName } from '../lib/helpers';
import SessionSelectors from './SessionSelectors';

const NAV_ITEMS = [
  { to: '/sortie', label: 'Sortie', icon: 'cart' },
  { to: '/entree', label: 'Entrée', icon: 'inbox' },
  { to: '/stock', label: 'Stock', icon: 'box' },
  { to: '/stats', label: 'Stats', icon: 'chart', adminOnly: true },
  { to: '/admin', label: 'Admin', icon: 'gear', adminOnly: true },
];

function Icon({ name, size = 22 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (name) {
    case 'cart':
      return (
        <svg {...props}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    case 'inbox':
      return (
        <svg {...props}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          <polyline points="12 7 12 14" />
          <polyline points="9 10 12 7 15 10" transform="rotate(180 12 8.5)" />
        </svg>
      );
    case 'box':
      return (
        <svg {...props}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Layout({ children, brandTitle = "Stock", brandSub = "Orange", allowMultiService = false }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      {/* HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.95)',
          borderBottom: '1px solid var(--line)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(8px)',
          gap: '16px',
        }}
        className="app-header"
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: 'var(--orange)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 8,
              flexShrink: 0,
            }}
          >
            <span style={{ width: 18, height: 3, background: 'white' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>{brandTitle}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {brandSub}
            </span>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="topbar-nav" style={{ display: 'none', alignItems: 'center', gap: 4, flex: 1, margin: '0 16px' }}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="nav-link"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: '100px',
                color: isActive ? 'var(--orange-dark)' : 'var(--ink-3)',
                background: isActive ? 'var(--orange-light)' : 'transparent',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              })}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Session selectors + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="header-selectors" style={{ display: 'none' }}>
            <SessionSelectors allowMultiService={allowMultiService} />
          </div>
          <button
            onClick={() => {
              if (confirm('Se déconnecter ?')) {
                logout();
                navigate('/login');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px 6px 6px',
              background: 'var(--orange-light)',
              borderRadius: '100px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--orange-dark)',
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
            }}
            title="Se déconnecter"
          >
            <span
              className={user?.avatar_couleur || 'c-orange'}
              style={{
                width: 24,
                height: 24,
                borderRadius: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                color: 'white',
              }}
            >
              {initials(user?.prenom, user?.nom_initiale)}
            </span>
            <span className="user-name-label">{displayName(user)}</span>
            {isAdmin && (
              <span
                style={{
                  background: 'var(--ink)',
                  color: 'white',
                  padding: '1px 7px',
                  borderRadius: '100px',
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Admin
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile session selectors bar */}
      <div
        className="mobile-selectors"
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '10px 20px 0',
        }}
      >
        <SessionSelectors allowMultiService={allowMultiService} />
      </div>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</main>

      {/* BOTTOM NAV (mobile) */}
      <nav
        className="nav-bottom"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0',
          zIndex: 40,
        }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 14px',
              color: isActive ? 'var(--orange)' : 'var(--ink-4)',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              textDecoration: 'none',
            })}
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 1200px) {
          .app-header { padding: 14px 32px !important; }
          .topbar-nav { display: flex !important; }
          .header-selectors { display: block !important; }
          .mobile-selectors { display: none !important; }
          .nav-bottom { display: none !important; }
        }
        @media (max-width: 1199px) {
          .user-name-label { display: none; }
        }
      `}</style>
    </div>
  );
}
