import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { supabase } from '../lib/supabase';
import { Denied, PageLoader, Empty, Badge } from '../components/ui';
import { fmtRelative, displayName, fmtPrice, initials } from '../lib/helpers';
import { fetchStatsKPIs, fetchTops, fetchEvolution, fetchRuptures } from '../hooks/useStats';

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
  const [ruptures, setRuptures] = useState([]);
  const [mouvements, setMouvements] = useState([]);

  const fetchAll = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);

    const [k, t, e, r, m] = await Promise.all([
      fetchStatsKPIs({ service, magasin, period }),
      fetchTops({ service, magasin, period, limit: 5 }),
      fetchEvolution({ service, magasin, months: 12 }),
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
              </>
            )}

            {tab === 'ruptures' && (
              <div>
                {ruptures.length === 0 ? (
                  <Empty icon="✅" text="Aucune rupture" sub="Tous les articles ont du stock." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ruptures.map((r) => (
                      <div key={`${r.type}-${r.ref}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '1.5px solid var(--red)', borderRadius: 'var(--radius)' }}>
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
                {mouvements.slice(0, 100).map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.nom || m.ref}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                        <Badge color={m.type === 'sortie' ? 'orange' : m.type === 'entree' ? 'green' : 'gray'}>{m.type}</Badge>
                        {' '}<span className="mono">{m.ref}</span> · {m.users ? displayName(m.users) : 'Système'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontWeight: 800, color: m.qty > 0 ? 'var(--green)' : 'var(--orange-dark)' }}>{m.qty > 0 ? '+' : ''}{m.qty}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{fmtRelative(m.created_at)}</div>
                    </div>
                  </div>
                ))}
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
