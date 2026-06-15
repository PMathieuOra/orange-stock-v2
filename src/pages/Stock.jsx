import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStock } from '../hooks/useStock';
import { PageLoader, Empty, Badge } from '../components/ui';

export default function Stock() {
  const { items, loading, error } = useStock();
  const [tab, setTab] = useState('all'); // 'all' | 'critical' | 'conso' | 'fibre' | 'cuivre'
  const [search, setSearch] = useState('');

  const norm = (s) => String(s || '').toLowerCase().trim();

  const filtered = useMemo(() => items.filter((it) => {
    const cat = norm(it.categorie);
    // Filtre catégorie
    if (tab === 'critical' && !(it.est_critique && it.actif)) return false;
    if (tab === 'conso' && it.type !== 'conso') return false;
    if (tab === 'fibre' && (it.type !== 'cable' || cat !== 'fibre')) return false;
    if (tab === 'cuivre' && (it.type !== 'cable' || cat !== 'cuivre')) return false;
    // Filtre recherche : ref + nom + tourets (pour les câbles)
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const refStr = String(it.ref || '');
    const nomStr = String(it.nom || '');
    if ((refStr + ' ' + nomStr).toLowerCase().includes(q)) return true;
    // Pour les câbles, chercher aussi dans les noms de tourets
    if (it.type === 'cable' && Array.isArray(it.tourets)) {
      return it.tourets.some((t) => String(t.ref_touret || '').toLowerCase().includes(q));
    }
    return false;
  }), [items, tab, search]);

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

        <input
          placeholder="🔍 Rechercher par référence, nom ou n° de touret..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', border: '1.5px solid var(--line)', borderRadius: '100px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 12 }}
        />
        {search && (
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 8 }}>
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </div>
        )}

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
// Palette de couleurs pour distinguer les tourets
const TOURET_COLORS = [
  '#FF7900', // orange (Orange brand)
  '#2563EB', // bleu
  '#00A86B', // vert
  '#7C3AED', // violet
  '#E63946', // rouge
  '#F59E0B', // amber
  '#0EA5E9', // sky
  '#EC4899', // pink
  '#10B981', // emerald
  '#8B5CF6', // violet-light
];

function TouretsBar({ tourets, totalInitial, pctGlobal }) {
  const [hovered, setHovered] = useState(null);

  // Largeur basée sur le restant (et non l'initial)
  const totalRestant = tourets.reduce((s, t) => s + t.restante, 0);
  // Si tout est à 0, on évite la division par zéro
  const safeTotal = totalRestant || 1;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        gap: 3,
        height: 28,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--line-2)',
        padding: 2,
      }}>
        {tourets.map((t, idx) => {
          const flexBasis = (t.restante / safeTotal) * 100;
          const color = TOURET_COLORS[idx % TOURET_COLORS.length];
          const isHovered = hovered === t.id;
          // Touret vide : on l'affiche très fin et grisé
          const isEmpty = t.restante <= 0;
          if (isEmpty) return null; // on ne montre pas les tourets vides
          return (
            <div
              key={t.id}
              onMouseEnter={() => setHovered(t.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: `0 0 ${flexBasis}%`,
                position: 'relative',
                background: `linear-gradient(180deg, ${color}, ${color}dd)`,
                overflow: 'hidden',
                borderRadius: 4,
                cursor: 'pointer',
                transform: isHovered ? 'scaleY(1.18)' : 'scaleY(1)',
                transformOrigin: 'center',
                transition: 'transform 0.18s cubic-bezier(0.2,0,0,1), filter 0.18s',
                boxShadow: isHovered ? `0 4px 12px ${color}55` : 'none',
                filter: isHovered ? 'brightness(1.08)' : 'brightness(1)',
                zIndex: isHovered ? 2 : 1,
              }}
            >
              {/* Étiquette si le segment est assez large */}
              {flexBasis > 8 && (
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
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '-0.02em',
                }}>
                  {t.restante}m
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip floating */}
      {hovered && (() => {
        const t = tourets.find((x) => x.id === hovered);
        if (!t) return null;
        const idx = tourets.indexOf(t);
        const color = TOURET_COLORS[idx % TOURET_COLORS.length];
        const pct = t.initiale > 0 ? (t.restante / t.initiale) * 100 : 0;
        return (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ink)',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 10,
            pointerEvents: 'none',
            animation: 'tooltip-in 0.18s cubic-bezier(0.2,0,0,1)',
            borderLeft: `3px solid ${color}`,
          }}>
            <div className="mono" style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color }}>
              🎰 {t.ref_touret}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Restant</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{t.restante}m</div>
              </div>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Initial</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800, opacity: 0.8 }}>{t.initiale}m</div>
              </div>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consommé</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{(100 - pct).toFixed(0)}%</div>
              </div>
            </div>
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--ink)',
            }} />
          </div>
        );
      })()}

      {/* Légende sous la barre */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>
        <span>{tourets.filter((t) => t.restante > 0).length} touret{tourets.filter((t) => t.restante > 0).length > 1 ? 's' : ''} actif{tourets.filter((t) => t.restante > 0).length > 1 ? 's' : ''}</span>
        <span className="mono" style={{ fontWeight: 800 }}>{totalRestant}m au total</span>
      </div>
    </div>
  );
}
