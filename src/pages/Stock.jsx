import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStock } from '../hooks/useStock';
import { PageLoader, Empty, Badge } from '../components/ui';
import { gradientColor } from '../lib/helpers';

export default function Stock() {
  const { items, loading, error } = useStock();
  const [tab, setTab] = useState('all'); // 'all' | 'critical' | 'conso' | 'fibre' | 'cuivre'

  const norm = (s) => String(s || '').toLowerCase().trim();

  const filtered = useMemo(() => items.filter((it) => {
    const cat = norm(it.categorie);
    if (tab === 'critical') return it.est_critique && it.actif;
    if (tab === 'conso') return it.type === 'conso';
    if (tab === 'fibre') return it.type === 'cable' && cat === 'fibre';
    if (tab === 'cuivre') return it.type === 'cable' && cat === 'cuivre';
    return true;
  }), [items, tab]);

  const counts = useMemo(() => ({
    all: items.length,
    critical: items.filter((i) => i.est_critique && i.actif).length,
    conso: items.filter((i) => i.type === 'conso').length,
    fibre: items.filter((i) => i.type === 'cable' && norm(i.categorie) === 'fibre').length,
    cuivre: items.filter((i) => i.type === 'cable' && norm(i.categorie) === 'cuivre').length,
  }), [items]);

  const tabs = [
    { id: 'all', label: 'Tous', count: counts.all, color: 'var(--ink)' },
    { id: 'critical', label: '⚠ Critiques', count: counts.critical, color: 'var(--red)' },
    { id: 'conso', label: '📦 Conso', count: counts.conso, color: 'var(--orange)' },
    { id: 'fibre', label: '🟢 Fibre', count: counts.fibre, color: 'var(--green)' },
    { id: 'cuivre', label: '🟠 Cuivre', count: counts.cuivre, color: '#D97706' },
  ];

  return (
    <Layout brandTitle="Stock" brandSub="Inventaire">
      <div style={{ padding: '16px 20px', maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Inventaire</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>État du stock par périmètre.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }} className="no-scrollbar">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: active ? t.color : 'white',
                  color: active ? 'white' : 'var(--ink-3)',
                  border: `1.5px solid ${active ? t.color : 'var(--line)'}`,
                  borderRadius: '100px',
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
                  color: active ? 'white' : 'var(--ink-4)',
                  padding: '1px 7px',
                  borderRadius: '100px',
                  fontSize: 11,
                  fontWeight: 800,
                }}>{t.count}</span>
              </button>
            );
          })}
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 10,
          }}>
            {filtered.map((it) => <StockItem key={`${it.type}-${it.ref || it.id}`} item={it} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ===== Item carte (conso ou câble) =====
function StockItem({ item }) {
  if (item.type === 'cable') return <CableItem item={item} />;
  return <ConsoItem item={item} />;
}

function ConsoItem({ item }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      background: 'white',
      border: '1.5px solid var(--line)',
      borderRadius: 'var(--radius)',
      opacity: item.actif ? 1 : 0.5,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
          <span className="mono">{item.ref}</span> · seuil {item.seuil}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: item.est_critique ? 'var(--red)' : 'var(--ink)' }}>
          {item.qty}<span style={{ fontSize: 11, color: 'var(--ink-4)' }}>u</span>
        </div>
        {item.est_critique && item.actif && <Badge color="red">Critique</Badge>}
      </div>
    </div>
  );
}

function CableItem({ item }) {
  const totalInitial = (item.tourets || []).reduce((s, t) => s + t.initiale, 0);
  const totalRestant = (item.tourets || []).reduce((s, t) => s + t.restante, 0);
  const pctGlobal = totalInitial > 0 ? (totalRestant / totalInitial) * 100 : 0;
  const tourets = (item.tourets || []).slice().sort((a, b) => b.initiale - a.initiale);

  return (
    <div style={{
      padding: '14px 16px',
      background: 'white',
      border: '1.5px solid var(--line)',
      borderRadius: 'var(--radius)',
      opacity: item.actif ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
            <span className="mono">{item.ref || '—'}</span>
            {' · '}{tourets.length} touret{tourets.length > 1 ? 's' : ''}
            {' · seuil '}{item.seuil}m
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: item.est_critique ? 'var(--red)' : 'var(--ink)' }}>
            {totalRestant}<span style={{ fontSize: 11, color: 'var(--ink-4)' }}>m</span>
          </div>
          {item.est_critique && item.actif && <Badge color="red">Critique</Badge>}
        </div>
      </div>

      {/* Diagramme de tourets */}
      {tourets.length > 0 && (
        <TouretsBar tourets={tourets} totalInitial={totalInitial} pctGlobal={pctGlobal} />
      )}
    </div>
  );
}

// ===== Barre de tourets segmentée =====
function TouretsBar({ tourets, totalInitial, pctGlobal }) {
  // Chaque segment = un touret.
  // Largeur du segment dans la barre = initiale / totalInitial
  // Taux de remplissage du segment = restante / initiale (couleur dégradée)
  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 2,
        height: 24,
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--line-2)',
      }}>
        {tourets.map((t) => {
          const flexBasis = (t.initiale / totalInitial) * 100;
          const pct = t.initiale > 0 ? (t.restante / t.initiale) * 100 : 0;
          const color = gradientColor(pct);
          return (
            <div
              key={t.id}
              title={`${t.ref_touret} : ${t.restante}m / ${t.initiale}m (${pct.toFixed(0)}%)`}
              style={{
                flex: `0 0 ${flexBasis}%`,
                position: 'relative',
                background: 'rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: color,
                transition: 'width 0.3s',
              }} />
              {/* Petite étiquette si le segment est assez large */}
              {flexBasis > 15 && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: pct > 30 ? 'white' : 'var(--ink)',
                  textShadow: pct > 30 ? '0 0 2px rgba(0,0,0,0.5)' : 'none',
                  pointerEvents: 'none',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {t.restante}m
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Légende sous la barre */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>
        <span>Remplissage global</span>
        <span className="mono" style={{ color: gradientColor(pctGlobal), fontWeight: 800 }}>{pctGlobal.toFixed(0)}%</span>
      </div>
    </div>
  );
}
