import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Denied } from '../components/ui';

const CARDS = [
  { to: '/admin/commandes', icon: '📋', title: 'Commandes', sub: 'Suivi et réception', color: 'var(--blue)' },
  { to: '/admin/articles', icon: '📦', title: 'Articles', sub: 'Catalogue et tourets', color: 'var(--orange)' },
  { to: '/admin/utilisateurs', icon: '👥', title: 'Utilisateurs', sub: 'Comptes et droits', color: 'var(--purple)' },
  { to: '/admin/magasins', icon: '🏪', title: 'Magasins', sub: 'Sites de stockage', color: 'var(--green)' },
];

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <Layout brandTitle="Admin" brandSub="Administration">
        <Denied />
      </Layout>
    );
  }

  return (
    <Layout brandTitle="Admin" brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Administration</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 20 }}>Gérez votre application.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {CARDS.map((c) => (
            <button
              key={c.to}
              onClick={() => navigate(c.to)}
              style={{
                background: 'white',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius)',
                  background: c.color + '18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{c.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600 }}>{c.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
