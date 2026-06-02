import { useState } from 'react';
import Layout from '../components/Layout';
import { useStock } from '../hooks/useStock';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader, Empty, Badge } from '../components/ui';
import { fmtPrice } from '../lib/helpers';

export default function Stock() {
  const { items, loading, error } = useStock();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('all'); // 'all' | 'critical' | 'conso' | 'cable'

  const filtered = items.filter((it) => {
    if (tab === 'critical') return it.est_critique && it.actif;
    if (tab === 'conso') return it.type === 'conso';
    if (tab === 'cable') return it.type === 'cable';
    return true;
  });

  const criticalCount = items.filter((i) => i.est_critique && i.actif).length;

  // Valeur totale du stock affiché (admin uniquement)
  const totalValue = isAdmin
    ? filtered.reduce((s, it) => s + (it.qty * (it.prix_ht || 0)), 0)
    : 0;

  const tabs = [
    { id: 'all', label: 'Tous' },
    { id: 'critical', label: `⚠ Critiques (${criticalCount})` },
    { id: 'conso', label: '📦 Conso' },
    { id: 'cable', label: '🔌 Câbles' },
  ];

  return (
    <Layout brandTitle="Stock" brandSub="Inventaire">
      <div style={{ padding: '16px 20px', paddingBottom: isAdmin && totalValue > 0 ? 100 : 20 }}>
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
            {filtered.map((it) => {
              const lineValue = it.qty * (it.prix_ht || 0);
              return (
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
                      {isAdmin && it.prix_ht > 0 && ` · ${fmtPrice(it.prix_ht)}${it.type === 'cable' ? '/m' : ''}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: it.est_critique ? 'var(--red)' : 'var(--ink)' }}>
                      {it.qty}
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{it.type === 'cable' ? 'm' : 'u'}</span>
                    </div>
                    {isAdmin && lineValue > 0 && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginTop: 2 }}>
                        {fmtPrice(lineValue)}
                      </div>
                    )}
                    {it.est_critique && it.actif && <Badge color="red">Critique</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer admin : valeur totale du stock affiché */}
      {isAdmin && !loading && totalValue > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 40px)',
            maxWidth: 440,
            background: 'var(--ink)',
            color: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 30,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            💰 Valeur du stock affiché
          </span>
          <span className="mono" style={{ fontWeight: 800, fontSize: 16, color: 'var(--orange)' }}>
            {fmtPrice(totalValue)}
          </span>
        </div>
      )}
    </Layout>
  );
}
