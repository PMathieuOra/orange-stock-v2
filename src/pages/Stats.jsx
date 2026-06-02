import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { supabase } from '../lib/supabase';
import { Denied, PageLoader, Empty } from '../components/ui';
import { fmtRelative, displayName } from '../lib/helpers';

export default function Stats() {
  const { isAdmin } = useAuth();
  const { service, magasin } = useSession();
  const [tab, setTab] = useState('overview');
  const [mouvements, setMouvements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);
    const { data } = await supabase
      .from('mouvements')
      .select('*, users(prenom, nom_initiale)')
      .eq('service_id', service)
      .eq('magasin_id', magasin)
      .order('created_at', { ascending: false })
      .limit(500);
    setMouvements(data || []);
    setLoading(false);
  }, [service, magasin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!isAdmin) {
    return <Layout brandTitle="Stats" brandSub="Tableau de bord"><Denied /></Layout>;
  }

  const sorties = mouvements.filter((m) => m.type === 'sortie');
  const nbCmd = mouvements.filter((m) => m.type === 'commande').length;
  const techIds = new Set(sorties.map((m) => m.user_id));
  const refIds = new Set(sorties.map((m) => m.ref));

  // Top techniciens
  const techMap = new Map();
  sorties.forEach((m) => {
    if (!m.user_id) return;
    const cur = techMap.get(m.user_id) || { prenom: m.users?.prenom || '?', count: 0 };
    cur.count++;
    techMap.set(m.user_id, cur);
  });
  const topTech = [...techMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  // Top articles
  const artMap = new Map();
  sorties.forEach((m) => {
    const cur = artMap.get(m.ref) || { ref: m.ref, nom: m.nom, count: 0 };
    cur.count++;
    artMap.set(m.ref, cur);
  });
  const topArt = [...artMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  const kpis = [
    { label: 'Sorties', value: sorties.length, color: 'var(--orange)' },
    { label: 'Commandes', value: nbCmd, color: 'var(--blue)' },
    { label: 'Techniciens', value: techIds.size, color: 'var(--green)' },
    { label: 'Articles', value: refIds.size, color: 'var(--purple)' },
  ];

  return (
    <Layout brandTitle="Stats" brandSub="Tableau de bord">
      <div style={{ padding: '16px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Tableau de bord</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>Statistiques du périmètre actif.</p>

        {loading ? <PageLoader /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              {kpis.map((k) => (
                <div key={k.label} style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, borderLeft: `4px solid ${k.color}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)', marginBottom: 8 }}>{k.label}</div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800 }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
              {[['overview', 'Aperçu'], ['journal', 'Journal']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', borderBottom: '3px solid ' + (tab === id ? 'var(--orange)' : 'transparent'), color: tab === id ? 'var(--orange)' : 'var(--ink-4)', padding: '10px 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
              ))}
            </div>

            {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>🏆 Top techniciens</div>
                  {topTech.length === 0 ? <Empty icon="—" text="Aucune sortie" /> : topTech.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ width: 26, height: 26, borderRadius: '100px', background: i === 0 ? 'gold' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{t.prenom}</span>
                      <span className="mono" style={{ fontWeight: 800, color: 'var(--orange)' }}>{t.count}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>📦 Top articles</div>
                  {topArt.length === 0 ? <Empty icon="—" text="Aucune sortie" /> : topArt.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ width: 26, height: 26, borderRadius: '100px', background: i === 0 ? 'gold' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nom}</span>
                      <span className="mono" style={{ fontWeight: 800, color: 'var(--orange)' }}>{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'journal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mouvements.slice(0, 50).map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.nom || m.ref}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>
                        {m.type} · <span className="mono">{m.ref}</span> · {m.users ? displayName(m.users) : 'Système'}
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
