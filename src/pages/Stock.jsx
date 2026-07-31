import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStock, usePendingOrders } from '../hooks/useStock';
import { useSession } from '../contexts/SessionContext';
import { PageLoader, Empty, Badge } from '../components/ui';
import { fmtDate, fmtRelative } from '../lib/helpers';
import { getServiceInfo } from '../lib/supabase';

export default function Stock() {
  const { items, loading, error } = useStock();
  const { pendingItems, loading: pendingLoading } = usePendingOrders();
  const { isMultiService } = useSession();
  const [tab, setTab] = useState('all'); // 'all' | 'critical' | 'pending' | 'conso' | 'fibre' | 'cuivre'
  const [search, setSearch] = useState('');
  const [criticalModalOpen, setCriticalModalOpen] = useState(false);

  const norm = (s) => String(s || '').toLowerCase().trim();

  const filtered = useMemo(() => items.filter((it) => {
    const cat = norm(it.categorie);
    // Filtre catégorie
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

  // Filtrage des articles attendus (pour le tab "pending")
  const filteredPending = useMemo(() => {
    if (!search.trim()) return pendingItems;
    const q = search.toLowerCase().trim();
    return pendingItems.filter((p) => {
      const text = `${p.ref || ''} ${p.nom || ''} ${p.commande.numero || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [pendingItems, search]);

  const counts = useMemo(() => ({
    all: items.length,
    critical: items.filter((i) => i.est_critique && i.actif).length,
    pending: pendingItems.length,
    conso: items.filter((i) => i.type === 'conso').length,
    fibre: items.filter((i) => i.type === 'cable' && norm(i.categorie) === 'fibre').length,
    cuivre: items.filter((i) => i.type === 'cable' && norm(i.categorie) === 'cuivre').length,
  }), [items, pendingItems]);

  const tabs = [
    { id: 'all', label: 'Tous', count: counts.all, color: 'var(--ink)' },
    { id: 'pending', label: '📋 En commande', count: counts.pending, color: 'var(--blue)' },
    { id: 'conso', label: '📦 Conso', count: counts.conso, color: 'var(--orange)' },
    { id: 'fibre', label: '🟢 Fibre', count: counts.fibre, color: 'var(--green)' },
    { id: 'cuivre', label: '🟠 Cuivre', count: counts.cuivre, color: '#D97706' },
  ];

  return (
    <Layout brandTitle="Stock" brandSub="Inventaire" allowMultiService>
      <div style={{ padding: '16px 20px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Inventaire</h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>État du stock par périmètre.</p>
          </div>
          {counts.critical > 0 && (
            <button
              onClick={() => setCriticalModalOpen(true)}
              style={{
                background: 'var(--red)',
                color: 'white',
                border: 'none',
                borderRadius: '100px',
                padding: '10px 16px',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(230,57,70,0.35)',
                animation: 'critical-pulse 2s ease-in-out infinite',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>{counts.critical} article{counts.critical > 1 ? 's' : ''} critique{counts.critical > 1 ? 's' : ''}</span>
              <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 700 }}>→ détail</span>
            </button>
          )}
        </div>

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

        {loading || pendingLoading ? (
          <PageLoader />
        ) : tab === 'pending' ? (
          filteredPending.length === 0 ? (
            <Empty icon="📋" text="Aucune commande en attente" sub="Tout ce qui est commandé a été reçu." />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 10,
            }}>
              {filteredPending.map((p) => <PendingItem key={p.ligneId} item={p} />)}
            </div>
          )
        ) : filtered.length === 0 ? (
          <Empty icon="📦" text="Aucun article" />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 10,
          }}>
            {filtered.map((it) => <StockItem key={`${it.type}-${it.service_id}-${it.ref || it.id}`} item={it} showServiceBadge={isMultiService} />)}
          </div>
        )}
      </div>

      {criticalModalOpen && (
        <CriticalModal
          items={items.filter((i) => i.est_critique && i.actif)}
          pendingItems={pendingItems}
          onClose={() => setCriticalModalOpen(false)}
        />
      )}
    </Layout>
  );
}

// ===== Item carte (conso ou câble) =====
function StockItem({ item, showServiceBadge = false }) {
  if (item.type === 'cable') return <CableItem item={item} showServiceBadge={showServiceBadge} />;
  return <ConsoItem item={item} showServiceBadge={showServiceBadge} />;
}

function ServiceBadge({ serviceId }) {
  const info = getServiceInfo(serviceId);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
      background: info.couleur + '18', color: info.couleur,
      letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 10 }}>{info.icon}</span>
      <span>{info.nom}</span>
    </span>
  );
}

// ===== Carte d'article en commande =====
function PendingItem({ item }) {
  // Badge catégorie
  const catBadge = item.type === 'conso'
    ? { label: 'CONSO', color: '#FF7900', bg: '#FFF5EB' }
    : item.categorie === 'fibre'
      ? { label: 'FIBRE', color: '#00A86B', bg: '#E8F7F0' }
      : item.categorie === 'cuivre'
        ? { label: 'CUIVRE', color: '#D97706', bg: '#FEF6E7' }
        : null;

  return (
    <div style={{
      padding: '14px 16px',
      background: 'white',
      border: '1.5px solid var(--blue-light, #DBEAFE)',
      borderRadius: 'var(--radius)',
      borderLeft: '4px solid var(--blue)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {catBadge && <span style={{
              background: catBadge.bg,
              color: catBadge.color,
              fontSize: 9,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              letterSpacing: '0.05em',
            }}>{catBadge.label}</span>}
            <div title={item.nom || item.ref} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.nom || item.ref}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.nom && <span className="mono">{item.ref}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>
            {item.qty_attendue}<span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{item.unite}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>attendu</div>
        </div>
      </div>
      {/* Détail de la commande source */}
      <div style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px dashed var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: 'var(--ink-3)',
        fontWeight: 600,
      }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <span className="mono" style={{ fontWeight: 800, color: 'var(--ink)' }}>{item.commande.numero}</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span style={{ color: 'var(--ink-4)' }} title={fmtDate(item.commande.date_creation)}>
          créée {fmtRelative(item.commande.date_creation)}
        </span>
      </div>
    </div>
  );
}

function ConsoItem({ item, showServiceBadge = false }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          {showServiceBadge && <ServiceBadge serviceId={item.service_id} />}
          <div title={item.nom} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="mono">{item.ref}</span>
          <span>·</span>
          <span>seuil {item.seuil}</span>
          {item.emplacement && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--orange)', fontWeight: 700 }}>📍 {item.emplacement}</span>
            </>
          )}
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

function CableItem({ item, showServiceBadge = false }) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            {showServiceBadge && <ServiceBadge serviceId={item.service_id} />}
            <div title={item.nom} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom}</div>
          </div>
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
            {t.emplacement && (
              <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                📍 <span>{t.emplacement}</span>
              </div>
            )}
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

// ===== Modal détaillé des articles critiques =====
function CriticalModal({ items, pendingItems, onClose }) {
  // Croiser articles critiques avec commandes en attente
  // Pour matcher : type + ref doivent correspondre
  const getPending = (item) => pendingItems.filter(
    (p) => p.type === item.type && p.ref === item.ref
  );

  const norm = (s) => String(s || '').toLowerCase().trim();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fade-in 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          width: '100%',
          maxWidth: 600,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slide-up 0.25s cubic-bezier(0.2,0,0,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 12px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              ⚠ Stock critique
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {items.length} article{items.length > 1 ? 's' : ''} à surveiller
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, margin: '4px 0 0' }}>
              Articles dont le stock est ≤ au seuil défini.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--ink-3)',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Liste */}
        <div style={{ overflowY: 'auto', padding: '12px 20px 20px', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)', fontWeight: 600 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
              <div>Aucun article en stock critique</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Tout va bien !</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((it) => {
                const pending = getPending(it);
                const totalPending = pending.reduce((s, p) => s + p.qty_attendue, 0);
                const cat = norm(it.categorie);
                const catBadge = it.type === 'conso'
                  ? { label: 'CONSO', color: '#FF7900', bg: '#FFF5EB' }
                  : cat === 'fibre'
                    ? { label: 'FIBRE', color: '#00A86B', bg: '#E8F7F0' }
                    : cat === 'cuivre'
                      ? { label: 'CUIVRE', color: '#D97706', bg: '#FEF6E7' }
                      : null;
                return (
                  <div key={`${it.type}-${it.id}`} style={{
                    padding: '14px 16px',
                    background: 'white',
                    border: '1.5px solid var(--red)',
                    borderLeft: '4px solid var(--red)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          {catBadge && <span style={{
                            background: catBadge.bg,
                            color: catBadge.color,
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            letterSpacing: '0.05em',
                          }}>{catBadge.label}</span>}
                          <div title={it.nom} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.nom}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>
                          <span className="mono">{it.ref || '—'}</span> · seuil {it.seuil}{it.type === 'cable' ? 'm' : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>
                          {it.qty}<span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{it.type === 'cable' ? 'm' : 'u'}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>en stock</div>
                      </div>
                    </div>

                    {/* Commandes associées */}
                    <div style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px dashed var(--line)',
                    }}>
                      {pending.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>
                          <span style={{ fontSize: 14 }}>⚠️</span>
                          <span>Aucune commande en cours pour cet article</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>
                            <span style={{ fontSize: 14 }}>📋</span>
                            <span>{totalPending}{it.type === 'cable' ? 'm' : 'u'} attendu{totalPending > 1 ? 's' : ''}</span>
                            <span style={{ color: 'var(--ink-4)' }}>·</span>
                            <span style={{ color: 'var(--ink-4)' }}>{pending.length} commande{pending.length > 1 ? 's' : ''}</span>
                          </div>
                          {pending.map((p) => (
                            <div key={p.ligneId} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12,
                              color: 'var(--ink-3)',
                              fontWeight: 600,
                              paddingLeft: 22,
                            }}>
                              <span className="mono" style={{ fontWeight: 800, color: 'var(--ink)' }}>{p.commande.numero}</span>
                              <span style={{ color: 'var(--ink-4)' }}>·</span>
                              <span className="mono">{p.qty_attendue}{p.unite}</span>
                              <span style={{ color: 'var(--ink-4)' }}>·</span>
                              <span style={{ color: 'var(--ink-4)' }}>{fmtRelative(p.commande.date_creation)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--ink)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Fermer</button>
        </div>
      </div>
    </div>
  );
}
