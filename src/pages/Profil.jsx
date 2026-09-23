import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getServiceInfo } from '../lib/supabase';
import { getMagasinInfo } from '../components/SessionSelectors';
import { PageLoader, Empty, Badge } from '../components/ui';
import { initials, displayName, fmtRelative, fmtDate } from '../lib/helpers';

export default function Profil() {
  const { user, isAdmin } = useAuth();
  const [mouvements, setMouvements] = useState([]);
  const [equipe, setEquipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | sortie | entree

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Journal personnel : mes sorties + entrées uniquement (pas de régul, pas les autres)
    const { data: mouvs } = await supabase
      .from('mouvements')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['sortie', 'entree'])
      .order('created_at', { ascending: false })
      .limit(200);
    setMouvements(mouvs || []);

    // Équipe (si rattaché)
    if (user.equipe_id) {
      const { data: eq } = await supabase.from('equipes').select('nom, couleur').eq('id', user.equipe_id).maybeSingle();
      setEquipe(eq || null);
    } else {
      setEquipe(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  const filtered = filter === 'all' ? mouvements : mouvements.filter((m) => m.type === filter);
  const nbSorties = mouvements.filter((m) => m.type === 'sortie').length;
  const nbEntrees = mouvements.filter((m) => m.type === 'entree').length;

  const services = user.services || [];
  const magasins = user.magasins || [];

  return (
    <Layout brandTitle="Mon profil" brandSub="Compte">
      <div style={{ padding: '16px 20px', maxWidth: 900, margin: '0 auto' }}>

        {/* Carte identité */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
          <span className={user.avatar_couleur || 'c-orange'} style={{ width: 64, height: 64, borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
            {initials(user.prenom, user.nom_initiale)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{displayName(user)}</h1>
              {isAdmin && <Badge color="gray">Admin</Badge>}
              {user.trigramme && (
                <span style={{ background: 'var(--ink)', color: 'white', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 4 }}>{user.trigramme}</span>
              )}
              {equipe && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: '100px', background: (equipe.couleur || '#FF7900') + '18', color: equipe.couleur || '#FF7900' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: equipe.couleur || '#FF7900' }} />
                  {equipe.nom}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, marginTop: 4 }}>
              <span className="mono">{user.identifiant}</span>
            </div>
          </div>
        </div>

        {/* Accès : services + magasins */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 16, background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Mes services</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {services.length === 0 ? <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Aucun</span> : services.map((s) => {
                const info = getServiceInfo(s);
                return <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: '100px', background: info.couleur + '18', color: info.couleur }}>{info.icon} {info.nom}</span>;
              })}
            </div>
          </div>
          <div style={{ padding: 16, background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Mes magasins</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {magasins.length === 0 ? <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Aucun</span> : magasins.map((m) => {
                const info = getMagasinInfo(m);
                return <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: '100px', background: 'var(--bg)', color: 'var(--ink)' }}>{info.icon} {info.nom}</span>;
              })}
            </div>
          </div>
        </div>

        {/* Journal personnel */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>📜 Mon journal</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', `Tout (${mouvements.length})`], ['sortie', `Sorties (${nbSorties})`], ['entree', `Entrées (${nbEntrees})`]].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ background: filter === id ? 'var(--ink)' : 'white', color: filter === id ? 'white' : 'var(--ink-3)', border: '1.5px solid ' + (filter === id ? 'var(--ink)' : 'var(--line)'), borderRadius: '100px', padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
            ))}
          </div>
        </div>

        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <Empty icon="📜" text="Aucun mouvement" sub="Tes sorties et entrées de stock apparaîtront ici." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((m) => {
              const touretMatch = m.note && m.note.match(/Touret (\S+)/);
              const touretRef = touretMatch ? touretMatch[1] : null;
              const info = getMagasinInfo(m.magasin_id);
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div title={m.nom || m.ref} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom || m.ref}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge color={m.type === 'sortie' ? 'orange' : 'green'}>{m.type === 'sortie' ? '↑ Sortie' : '↓ Entrée'}</Badge>
                      <span className="mono">{m.ref}</span>
                      {touretRef && (<><span>·</span><span style={{ color: 'var(--blue)', fontWeight: 700 }}>🎰 <span className="mono">{touretRef}</span></span></>)}
                      <span>·</span>
                      <span>{info.nom}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: m.qty < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {m.qty > 0 ? '+' : ''}{m.qty}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600 }} title={fmtDate(m.created_at)}>{fmtRelative(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
