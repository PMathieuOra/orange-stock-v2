import { useState } from 'react';
import Layout from '../components/Layout';
import { useStock } from '../hooks/useStock';
import { PageLoader, Empty, Badge } from '../components/ui';

export default function Stock() {
  const { items, loading, error } = useStock();
  const [tab, setTab] = useState('all'); // 'all' | 'critical' | 'conso' | 'cable'

  const filtered = items.filter((it) => {
    if (tab === 'critical') return it.est_critique && it.actif;
    if (tab === 'conso') return it.type === 'conso';
    if (tab === 'cable') return it.type === 'cable';
    return true;
  });

  const criticalCount = items.filter((i) => i.est_critique && i.actif).length;

  const tabs = [
    { id: 'all', label: 'Tous' },
    { id: 'critical', label: `⚠ Critiques (${criticalCount})` },
    { id: 'conso', label: '📦 Conso' },
    { id: 'cable', label: '🔌 Câbles' },
  ];

  return (
    <Layout brandTitle="Stock" brandSub="Inventaire">
      <div style={{ padding: '16px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Inventaire</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>État du stock par périmètre.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }} className="no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? 'var(--ink)' : 'white',
                color: tab === t.id ? 'white' : 'var(--ink-3)',
                border: '1.5px solid ' + (tab === t.id ? 'var(--ink)' : 'var(--line)'),
                borderRadius: '100px',
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: 16, background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontWeight: 600, marginBottom: 16 }}>
            Erreur : {error}
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <Empty icon="📦" text="Aucun article" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((it) => (
              <div
                key={`${it.type}-${it.ref}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: 'white',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  opacity: it.actif ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{it.nom}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                    <span className="mono">{it.ref}</span> · seuil {it.seuil}
                    {it.type === 'cable' && ` · ${it.nb_tourets} touret(s)`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: it.est_critique ? 'var(--red)' : 'var(--ink)' }}>
                    {it.qty}
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{it.type === 'cable' ? 'm' : 'u'}</span>
                  </div>
                  {it.est_critique && it.actif && <Badge color="red">Critique</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
