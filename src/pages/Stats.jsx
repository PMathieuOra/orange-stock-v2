import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { supabase } from '../lib/supabase';
import { Denied, PageLoader, Empty, Badge } from '../components/ui';
import { fmtRelative, displayName, fmtPrice, initials } from '../lib/helpers';
import { fetchStatsKPIs, fetchTops, fetchEvolution, fetchRuptures, fetchCommandesEvolution } from '../hooks/useStats';

const PERIODS = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
];

export default function Stats() {
  const { isAdmin } = useAuth();
  const { service, magasin } = useSession();
  const [period, setPeriod] = useState('month');
  const [tab, setTab] = useState('overview'); // overview | journal | ruptures
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [tops, setTops] = useState({ topArticles: [], topTechniciens: [] });
  const [evolution, setEvolution] = useState([]);
  const [cmdEvo, setCmdEvo] = useState({ buckets: [], totalCout: 0, totalNb: 0, moyCout: 0 });
  const [ruptures, setRuptures] = useState([]);
  const [mouvements, setMouvements] = useState([]);

  const fetchAll = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);

    const [k, t, e, ce, r, m] = await Promise.all([
      fetchStatsKPIs({ service, magasin, period }),
      fetchTops({ service, magasin, period, limit: 5 }),
      fetchEvolution({ service, magasin, months: 12 }),
      fetchCommandesEvolution({ service, magasin, period }),
      fetchRuptures({ service, magasin }),
      supabase
        .from('mouvements')
        .select('*, users(prenom, nom_initiale)')
        .eq('service_id', service)
        .eq('magasin_id', magasin)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    setKpis(k);
    setTops(t);
    setEvolution(e);
    setCmdEvo(ce);
    setRuptures(r);
    setMouvements(m.data || []);
    setLoading(false);
  }, [service, magasin, period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!isAdmin) {
    return <Layout brandTitle="Stats" brandSub="Tableau de bord"><Denied /></Layout>;
  }

  return (
    <Layout brandTitle="Stats" brandSub="Tableau de bord">
      <div style={{ padding: '16px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Tableau de bord</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>Statistiques du périmètre actif.</p>

        {/* Sélecteur période */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                background: period === p.id ? 'var(--orange)' : 'white',
                color: period === p.id ? 'white' : 'var(--ink-3)',
                border: '1.5px solid ' + (period === p.id ? 'var(--orange)' : 'var(--line)'),
                borderRadius: '100px',
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading || !kpis ? <PageLoader /> : (
          <>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
              <KpiCard icon="💰" label="Valeur du stock" value={fmtPrice(kpis.stockValue)} color="var(--green)" mono small />
              <KpiCard icon="📉" label="Coût des sorties" sub={`${kpis.nbMouvements} mouvements`} value={fmtPrice(kpis.coutSorties)} color="var(--orange)" mono small />
              <KpiCard icon="📋" label="Coût des commandes" sub={`${kpis.nbCommandes} commande(s)`} value={fmtPrice(kpis.coutCommandes)} color="var(--blue)" mono small />
              <KpiCard icon="⚠️" label="Articles critiques" value={kpis.nbCritique} color="var(--amber)" mono />
              <KpiCard icon="🔴" label="En rupture" value={kpis.nbRupture} color="var(--red)" mono />
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
              {[
                ['overview', '📊 Aperçu'],
                ['ruptures', `🔴 Ruptures (${ruptures.length})`],
                ['journal', '📜 Journal'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: '3px solid ' + (tab === id ? 'var(--orange)' : 'transparent'),
                    color: tab === id ? 'var(--orange)' : 'var(--ink-4)',
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <>
                {/* Évolution */}
                <EvolutionChart data={evolution} />

                {/* Tops */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
                  <TopCard
                    title="🏆 Top techniciens"
                    empty="Aucune sortie sur la période"
                    items={tops.topTechniciens.map((t) => ({
                      key: t.user_id,
                      label: displayName(t),
                      sub: `${t.sorties} sortie${t.sorties > 1 ? 's' : ''} · ${t.unites} unités`,
                      value: t.sorties,
                      avatar: { initials: initials(t.prenom, t.nom_initiale), color: t.avatar_couleur || 'c-orange' },
                    }))}
                    maxValue={Math.max(...tops.topTechniciens.map((t) => t.sorties), 1)}
                  />
                  <TopCard
                    title="📦 Top articles"
                    empty="Aucune sortie sur la période"
                    items={tops.topArticles.map((a) => ({
                      key: a.ref,
                      label: a.nom,
                      sub: `${a.ref} · ${a.qtyTotale} unité${a.qtyTotale > 1 ? 's' : ''} sorties`,
                      value: a.sorties,
                      suffix: a.sorties > 1 ? 'sorties' : 'sortie',
                    }))}
                    maxValue={Math.max(...tops.topArticles.map((a) => a.sorties), 1)}
                  />
                </div>

                {/* Synthèse des commandes */}
                <CommandesSynthese data={cmdEvo} />
              </>
            )}

            {tab === 'ruptures' && (
              <div>
                {ruptures.length === 0 ? (
                  <Empty icon="✅" text="Aucune rupture" sub="Tous les articles ont du stock." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ruptures.map((r) => (
                      <div key={`${r.type}-${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '1.5px solid var(--red)', borderRadius: 'var(--radius)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '100px', background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 20 }}>🔴</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nom}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                            <span className="mono">{r.ref}</span> · seuil {r.seuil}{r.type === 'cable' ? 'm' : ''}
                          </div>
                        </div>
                        <Badge color="red">Rupture</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'journal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mouvements.slice(0, 100).map((m) => {
                  // Extraire le n° de touret depuis la note (format : "Touret XXX : 1000m → 750m")
                  const touretMatch = m.note && m.note.match(/Touret\s+([^\s:]+)\s*:/i);
                  const touretRef = touretMatch ? touretMatch[1] : null;
                  // Le reste de la note (si elle commence par autre chose que "Touret")
                  const userNote = m.note && !m.note.startsWith('Touret ') && !m.note.startsWith('Touret\t')
                    ? m.note.split(' | Touret ')[0]
                    : null;
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.nom || m.ref}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Badge color={m.type === 'sortie' ? 'orange' : m.type === 'entree' ? 'green' : 'gray'}>{m.type}</Badge>
                          <span className="mono">{m.ref}</span>
                          {touretRef && (
                            <>
                              <span>·</span>
                              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>🎰 <span className="mono">{touretRef}</span></span>
                            </>
                          )}
                          <span>·</span>
                          <span>{m.users ? displayName(m.users) : 'Système'}</span>
                          {userNote && (
                            <>
                              <span>·</span>
                              <span style={{ fontStyle: 'italic' }}>« {userNote} »</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mono" style={{ fontWeight: 800, color: m.qty > 0 ? 'var(--green)' : 'var(--orange-dark)' }}>{m.qty > 0 ? '+' : ''}{m.qty}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{fmtRelative(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ===== KPI Card =====
function KpiCard({ icon, label, sub, value, color, mono, small }) {
  return (
    <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)' }}>{label}</span>
      </div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: small ? 18 : 26, fontWeight: 800, color: color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ===== Top Card =====
function TopCard({ title, items, maxValue, empty, suffix }) {
  return (
    <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-4)', fontSize: 13, fontWeight: 600 }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item, i) => {
            const pct = (item.value / maxValue) * 100;
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.avatar ? (
                  <span className={item.avatar.color} style={{ width: 32, height: 32, borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                    {item.avatar.initials}
                  </span>
                ) : (
                  <span style={{ width: 26, height: 26, borderRadius: '100px', background: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? '#cd7f32' : 'var(--bg)', color: i < 3 ? 'white' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  {item.sub && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>{item.sub}</div>}
                  <div style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--orange)', borderRadius: 2 }} />
                  </div>
                </div>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 14 }}>
                  {item.value}{item.suffix ? ` ${item.suffix}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Evolution Chart (SVG bars) =====
function EvolutionChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxValue = Math.max(...data.map((d) => Math.max(d.sorties, d.entrees)), 1);
  const totalSorties = data.reduce((s, d) => s + d.sorties, 0);
  const totalEntrees = data.reduce((s, d) => s + d.entrees, 0);

  return (
    <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>📈 Évolution sur 12 mois</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--orange)', borderRadius: 2, marginRight: 4 }} />Sorties ({totalSorties})</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--green)', borderRadius: 2, marginRight: 4 }} />Entrées ({totalEntrees})</span>
        </div>
      </div>

      {/* Bars container */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 4, paddingBottom: 24, position: 'relative' }}>
        {data.map((b, i) => {
          const hSorties = (b.sorties / maxValue) * 100;
          const hEntrees = (b.entrees / maxValue) * 100;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, width: '100%' }}>
                {/* Sorties */}
                <div
                  style={{ width: '40%', height: `${hSorties}%`, background: 'var(--orange)', borderRadius: '3px 3px 0 0', minHeight: b.sorties > 0 ? 2 : 0, position: 'relative' }}
                  title={`Sorties : ${b.sorties}`}
                />
                {/* Entrées */}
                <div
                  style={{ width: '40%', height: `${hEntrees}%`, background: 'var(--green)', borderRadius: '3px 3px 0 0', minHeight: b.entrees > 0 ? 2 : 0 }}
                  title={`Entrées : ${b.entrees}`}
                />
              </div>
              <div style={{ position: 'absolute', bottom: -20, fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textAlign: 'center', width: '100%' }}>
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Synthèse des commandes (KPIs + graphique combo barres + ligne) =====
function CommandesSynthese({ data }) {
  const { buckets, totalCout, totalNb, moyCout } = data;
  const maxCout = Math.max(...buckets.map((b) => b.cout), 1);
  const maxNb = Math.max(...buckets.map((b) => b.nb), 1);

  // Pour la ligne SVG : générer les points
  const chartH = 260;
  const chartW = 100; // en %, on travaille en pourcentages
  const padTop = 20;
  const padBottom = 30;
  const usableH = chartH - padTop - padBottom;

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
        🛒 Synthèse des commandes
      </h2>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, margin: '0 0 12px' }}>
        Coût et nombre de commandes sur la période.
      </p>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--orange)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>💰 Coût total</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{fmtPrice(totalCout)}</div>
        </div>
        <div style={{ padding: '14px 16px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--blue)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>📋 Nombre</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{totalNb}</div>
        </div>
        <div style={{ padding: '14px 16px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>📊 Coût moyen / cmd</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmtPrice(moyCout)}</div>
        </div>
      </div>

      {/* Graphique combo */}
      <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 16 }}>
        {/* Légende */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 12, fontSize: 12, fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--blue)' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--blue)' }} />
            Nombre de commandes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--orange)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--orange)' }} />
            Coût (€)
          </span>
        </div>

        {/* Zone graphique avec axes */}
        <div style={{ position: 'relative', height: chartH, marginLeft: 50, marginRight: 50 }}>
          {/* Axe Y gauche (coût) */}
          <div style={{ position: 'absolute', left: -45, top: padTop, height: usableH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--orange)', fontWeight: 700, alignItems: 'flex-end' }}>
            <span>{fmtPrice(maxCout, { showCurrency: false, decimals: 0 })} €</span>
            <span>{fmtPrice(maxCout * 0.75, { showCurrency: false, decimals: 0 })} €</span>
            <span>{fmtPrice(maxCout * 0.5, { showCurrency: false, decimals: 0 })} €</span>
            <span>{fmtPrice(maxCout * 0.25, { showCurrency: false, decimals: 0 })} €</span>
            <span>0 €</span>
          </div>

          {/* Axe Y droit (nombre) */}
          <div style={{ position: 'absolute', right: -40, top: padTop, height: usableH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--blue)', fontWeight: 700 }}>
            <span>{maxNb}</span>
            <span>{Math.round(maxNb * 0.75)}</span>
            <span>{Math.round(maxNb * 0.5)}</span>
            <span>{Math.round(maxNb * 0.25)}</span>
            <span>0</span>
          </div>

          {/* Lignes horizontales grille */}
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <div key={p} style={{ position: 'absolute', left: 0, right: 0, top: padTop + usableH * (1 - p), borderTop: '1px dashed var(--line-2)' }} />
          ))}

          {/* Barres (coût) */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: padTop, height: usableH, display: 'flex', alignItems: 'flex-end', gap: 4, paddingLeft: 4, paddingRight: 4 }}>
            {buckets.map((b) => {
              const h = (b.cout / maxCout) * 100;
              return (
                <div
                  key={b.key}
                  title={`${b.label} : ${fmtPrice(b.cout)}`}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    minHeight: b.cout > 0 ? 2 : 0,
                    background: 'linear-gradient(180deg, var(--orange), #E66E00)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'opacity 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                />
              );
            })}
          </div>

          {/* Ligne (nombre) en SVG */}
          <svg
            style={{ position: 'absolute', left: 0, right: 0, top: padTop, height: usableH, width: '100%', pointerEvents: 'none' }}
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {/* Zone sous la courbe */}
            <polygon
              fill="rgba(37, 99, 235, 0.1)"
              points={`${buckets.map((b, i) => {
                const x = ((i + 0.5) / buckets.length) * 100;
                const y = 100 - (b.nb / maxNb) * 100;
                return `${x},${y}`;
              }).join(' ')} ${((buckets.length - 0.5) / buckets.length) * 100},100 ${(0.5 / buckets.length) * 100},100`}
            />
            {/* Ligne */}
            <polyline
              fill="none"
              stroke="var(--blue)"
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: 2.5 }}
              points={buckets.map((b, i) => {
                const x = ((i + 0.5) / buckets.length) * 100;
                const y = 100 - (b.nb / maxNb) * 100;
                return `${x},${y}`;
              }).join(' ')}
            />
          </svg>

          {/* Points (nombre) en HTML pour pouvoir afficher des tooltips */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: padTop, height: usableH, pointerEvents: 'none' }}>
            {buckets.map((b, i) => {
              const x = ((i + 0.5) / buckets.length) * 100;
              const y = 100 - (b.nb / maxNb) * 100;
              return (
                <div
                  key={b.key}
                  title={`${b.label} : ${b.nb} commande${b.nb > 1 ? 's' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--blue)',
                    border: '2px solid white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    pointerEvents: 'auto',
                  }}
                />
              );
            })}
          </div>

          {/* Labels axe X */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: padBottom, display: 'flex', gap: 4, paddingLeft: 4, paddingRight: 4, alignItems: 'flex-end' }}>
            {buckets.map((b) => (
              <div
                key={b.key}
                style={{
                  flex: 1,
                  fontSize: 10,
                  color: 'var(--ink-4)',
                  fontWeight: 700,
                  textAlign: 'center',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >{b.label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
