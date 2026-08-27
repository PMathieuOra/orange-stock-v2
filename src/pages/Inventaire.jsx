import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Badge, PageLoader, Empty, Denied } from '../components/ui';
import { fetchConsos, fetchCables, fetchAllTouretsForScope } from '../hooks/useArticles';
import {
  getOrCreateWeeklyInventory,
  validateInventoryCheck,
  createRegularisation,
  createTouretRegularisation,
  fetchRegularisations,
  fetchRegulStats,
  getCurrentWeek,
} from '../hooks/useInventaire';
import { fmtRelative, fmtDate } from '../lib/helpers';

export default function Inventaire() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { service, magasin } = useSession();
  const { toast } = useToast();

  const [tab, setTab] = useState('hebdo'); // 'hebdo' | 'regul' | 'historique'
  const [loading, setLoading] = useState(true);
  const [inventaire, setInventaire] = useState(null);
  const [checks, setChecks] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [regulStats, setRegulStats] = useState([]);

  const week = useMemo(() => getCurrentWeek(), []);

  const userId = user?.id;
  const fetchingRef = useRef(false);
  const lastScopeRef = useRef('');

  useEffect(() => {
    const scopeKey = `${service}|${magasin}|${userId}`;
    if (!service || !magasin || !userId) return;
    if (lastScopeRef.current === scopeKey) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    lastScopeRef.current = scopeKey;

    (async () => {
      setLoading(true);
      try {
        const [inv, regs, stats] = await Promise.all([
          getOrCreateWeeklyInventory({ service, magasin, userId, nbItems: 5 }),
          fetchRegularisations({ service, magasin, limit: 100 }),
          fetchRegulStats({ service, magasin }),
        ]);
        if (inv.ok) {
          setInventaire(inv.inventaire);
          setChecks(inv.checks);
        } else {
          toast('Erreur inventaire : ' + inv.error, 'error');
        }
        setRegulations(regs.data);
        setRegulStats(stats);
      } catch (err) {
        console.error('[Inventaire] Erreur :', err);
        toast('Erreur : ' + err.message, 'error');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, magasin, userId]);

  // Fonction pour rafraîchir manuellement (après une régul / validation)
  const refresh = useCallback(async () => {
    if (!service || !magasin || !userId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const [inv, regs, stats] = await Promise.all([
        getOrCreateWeeklyInventory({ service, magasin, userId, nbItems: 5 }),
        fetchRegularisations({ service, magasin, limit: 100 }),
        fetchRegulStats({ service, magasin }),
      ]);
      if (inv.ok) {
        setInventaire(inv.inventaire);
        setChecks(inv.checks);
      }
      setRegulations(regs.data);
      setRegulStats(stats);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, magasin, userId]);

  if (!isAdmin) {
    return <Layout brandTitle="Inventaire" brandSub="Administration"><Denied /></Layout>;
  }

  const completedCount = checks.filter((c) => c.qty_comptee !== null).length;

  return (
    <Layout brandTitle="Inventaire" brandSub="Administration">
      <div style={{ padding: '16px 20px', maxWidth: 1400, margin: '0 auto' }}>
        <button onClick={() => navigate('/admin')} style={backBtn}>← Administration</button>

        <div style={{ margin: '12px 0 16px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>📋 Inventaire</h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 14, fontWeight: 600 }}>
            Contrôles hebdomadaires et régularisations de stock.
          </p>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }} className="no-scrollbar">
          {[
            { id: 'hebdo', label: `📅 Hebdo (${completedCount}/${checks.length})`, color: 'var(--orange)' },
            { id: 'regul', label: '⚖️ Régulariser', color: 'var(--blue)' },
            { id: 'historique', label: `📜 Historique (${regulations.length})`, color: 'var(--ink)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? t.color : 'white',
                color: tab === t.id ? 'white' : 'var(--ink-3)',
                border: `1.5px solid ${tab === t.id ? t.color : 'var(--line)'}`,
                borderRadius: '100px',
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >{t.label}</button>
          ))}
        </div>

        {loading ? (
          <PageLoader />
        ) : (
          <>
            {tab === 'hebdo' && (
              <HebdoTab
                inventaire={inventaire}
                checks={checks}
                week={week}
                userId={userId}
                onRefresh={refresh}
                toast={toast}
              />
            )}

            {tab === 'regul' && (
              <RegulTab
                service={service}
                magasin={magasin}
                userId={userId}
                onDone={refresh}
                toast={toast}
              />
            )}

            {tab === 'historique' && (
              <HistoriqueTab
                regulations={regulations}
                stats={regulStats}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ============================================================================
// Onglet HEBDO
// ============================================================================
function HebdoTab({ inventaire, checks, week, userId, onRefresh, toast }) {
  if (!inventaire) {
    return <Empty icon="📋" text="Aucun inventaire" sub="Aucun article actif dans ce périmètre." />;
  }

  const completed = checks.filter((c) => c.qty_comptee !== null);
  const remaining = checks.filter((c) => c.qty_comptee === null);
  const pct = checks.length > 0 ? (completed.length / checks.length) * 100 : 0;

  return (
    <div>
      {/* Bandeau semaine */}
      <div style={{
        background: 'var(--orange-light)',
        border: '1.5px solid var(--orange)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--orange-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            🎲 Tirage de la semaine
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            Semaine {week.semaine_iso.split('-W')[1]} · à partir du {fmtDate(week.date_debut)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>
            5 articles sont tirés au hasard chaque lundi (pondérés selon l'usage).
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange-dark)' }}>
            {completed.length}/{checks.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase' }}>
            complétés
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--green)', transition: 'width 0.3s' }} />
      </div>

      {checks.length === 0 ? (
        <Empty icon="📦" text="Aucun article à inventorier" />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 10,
        }}>
          {/* D'abord les non-complétés */}
          {remaining.map((c) => (
            <CheckCard key={c.id} check={c} userId={userId} onRefresh={onRefresh} toast={toast} />
          ))}
          {/* Puis les complétés */}
          {completed.map((c) => (
            <CheckCard key={c.id} check={c} userId={userId} onRefresh={onRefresh} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

// Carte d'un check : article + saisie qty comptée
function CheckCard({ check, userId, onRefresh, toast }) {
  const [qty, setQty] = useState(check.qty_comptee !== null ? String(check.qty_comptee) : '');
  const [saving, setSaving] = useState(false);
  const article = check.article;
  const done = check.qty_comptee !== null;
  const ecartZero = check.ecart === 0;

  async function submit() {
    if (qty === '' || isNaN(parseInt(qty))) return toast('Saisissez une quantité', 'error');
    setSaving(true);
    const res = await validateInventoryCheck({ checkId: check.id, qtyComptee: qty, userId, regulariser: true });
    setSaving(false);
    if (res.ok) {
      if (res.ecart === 0) toast('✓ Stock conforme', 'success');
      else toast(`✓ Régul appliquée (${res.ecart > 0 ? '+' : ''}${res.ecart})`, 'success');
      onRefresh();
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  }

  if (!article) {
    return (
      <div style={{ padding: 14, background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
        <div style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>Article supprimé</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 16px',
      background: 'white',
      border: '1.5px solid ' + (done ? (ecartZero ? 'var(--green)' : 'var(--amber)') : 'var(--line)'),
      borderLeft: '4px solid ' + (done ? (ecartZero ? 'var(--green)' : 'var(--amber)') : 'var(--orange)'),
      borderRadius: 'var(--radius)',
      opacity: done ? 0.85 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Badge color={check.item_type === 'cable' ? 'blue' : 'orange'}>
              {check.item_type === 'cable' ? '🔌 Câble' : '📦 Conso'}
            </Badge>
          </div>
          <div title={article.nom} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.nom}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="mono">{article.ref}</span>
            {article.emplacement && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--orange)', fontWeight: 700 }}>📍 {article.emplacement}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>Théorique</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 800 }}>{check.qty_theorique}{check.item_type === 'cable' ? 'm' : ''}</div>
        </div>
      </div>

      {!done ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min="0"
            placeholder="Compté"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              fontSize: 16,
              outline: 'none',
              textAlign: 'center',
            }}
          />
          <Button onClick={submit} disabled={saving} style={{ padding: '10px 16px', fontSize: 13 }}>
            {saving ? '...' : '✓ Valider'}
          </Button>
        </div>
      ) : (
        <div style={{
          padding: '10px 14px',
          background: ecartZero ? 'var(--green-light, #DCFCE7)' : 'var(--amber-light, #FEF3C7)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {ecartZero ? (
            <>
              <span style={{ fontSize: 18 }}>✅</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--green-dark, #166534)' }}>Stock conforme ({check.qty_comptee})</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 18 }}>⚖️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--amber-dark, #92400E)' }}>
                  Compté : <span className="mono">{check.qty_comptee}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>
                  Écart : <span className="mono" style={{ fontWeight: 800 }}>{check.ecart > 0 ? '+' : ''}{check.ecart}</span> · régul appliquée
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Onglet RÉGULARISATIONS MANUELLES
// ============================================================================
function RegulTab({ service, magasin, userId, onDone, toast }) {
  const [itemType, setItemType] = useState('conso'); // 'conso' | 'cable'
  const [consos, setConsos] = useState([]);
  const [tourets, setTourets] = useState([]); // liste à plat des tourets du périmètre
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // { kind, ...data }
  const [newVal, setNewVal] = useState('');
  const [motif, setMotif] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    fetchConsos(service, magasin).then((r) => setConsos((r.data || []).filter((a) => a.actif)));
    // Charger les câbles + leurs tourets, aplatis
    Promise.all([fetchCables(service, magasin), fetchAllTouretsForScope(service, magasin)]).then(([cablesRes, touretsRes]) => {
      const cables = cablesRes.data || [];
      const cableById = {};
      cables.forEach((c) => { cableById[c.id] = c; });
      const byCable = touretsRes.byCable || {};
      const flat = [];
      Object.keys(byCable).forEach((cableId) => {
        const cable = cableById[cableId];
        (byCable[cableId] || []).forEach((t) => {
          flat.push({
            touret_id: t.id,
            ref_touret: t.ref_touret,
            restante: t.restante,
            emplacement: t.emplacement,
            nom_cable: cable?.nom || 'Câble',
            ref_cable: cable?.ref_type || '',
            categorie: cable?.categorie || '',
          });
        });
      });
      setTourets(flat);
    });
  }, [service, magasin]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (itemType === 'conso') {
      if (!q) return consos;
      return consos.filter((a) => (a.ref + ' ' + a.nom).toLowerCase().includes(q));
    }
    if (!q) return tourets;
    return tourets.filter((t) => (t.ref_touret + ' ' + t.nom_cable + ' ' + t.ref_cable).toLowerCase().includes(q));
  }, [itemType, consos, tourets, search]);

  async function submit() {
    if (!selected) return;
    if (newVal === '' || isNaN(parseInt(newVal))) return toast('Valeur invalide', 'error');
    setSaving(true);
    let res;
    if (selected.kind === 'conso') {
      res = await createRegularisation({ articleId: selected.id, qtyApres: newVal, motif, userId, service, magasin });
    } else {
      res = await createTouretRegularisation({ touretId: selected.touret_id, longueurApres: newVal, motif, userId, service, magasin });
    }
    setSaving(false);
    if (res.ok) {
      toast(`✓ Régul appliquée (${res.ecart > 0 ? '+' : ''}${res.ecart}${selected.kind === 'cable' ? 'm' : ''})`, 'success');
      setSelected(null); setNewVal(''); setMotif('');
      loadData();
      onDone();
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  }

  // ----- Vue formulaire (article/touret sélectionné) -----
  if (selected) {
    const isCable = selected.kind === 'cable';
    const currentVal = isCable ? selected.restante : selected.qty;
    const unite = isCable ? 'm' : '';
    const ecart = newVal !== '' ? parseInt(newVal) - currentVal : null;
    const titre = isCable ? `${selected.nom_cable} · touret ${selected.ref_touret}` : selected.nom;
    const refAff = isCable ? selected.ref_cable || selected.ref_touret : selected.ref;
    const empl = selected.emplacement;
    return (
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <button onClick={() => { setSelected(null); setNewVal(''); setMotif(''); }} style={backBtn}>← Choisir un autre article</button>

        <div style={{ marginTop: 16, padding: '20px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', borderLeft: `4px solid ${isCable ? 'var(--blue)' : 'var(--orange)'}` }}>
          <div style={{ fontSize: 11, color: isCable ? 'var(--blue)' : 'var(--orange)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            ⚖️ Régulariser {isCable ? 'un touret' : 'le stock'}
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{titre}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="mono">{refAff}</span>
            {empl && (<><span>·</span><span style={{ color: 'var(--orange)' }}>📍 {empl}</span></>)}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ flex: 1, padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>{isCable ? 'Longueur actuelle' : 'Stock actuel'}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>{currentVal}{unite}</div>
            </div>
            <div style={{ fontSize: 24 }}>→</div>
            <div style={{ flex: 1, padding: 14, background: 'var(--orange-light)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1.5px solid var(--orange)' }}>
              <div style={{ fontSize: 10, color: 'var(--orange-dark)', fontWeight: 700, textTransform: 'uppercase' }}>{isCable ? 'Nouvelle longueur' : 'Nouveau stock'}</div>
              <input type="number" min="0" value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="?" style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 800, textAlign: 'center', outline: 'none', color: 'var(--orange-dark)' }} />
            </div>
          </div>

          {ecart !== null && ecart !== 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: 12, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
              Écart : <span className="mono" style={{ color: ecart > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>{ecart > 0 ? '+' : ''}{ecart}{unite}</span>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Motif (optionnel)</label>
            <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex: stock cassé, erreur de saisie..." style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600, outline: 'none', fontSize: 13 }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => { setSelected(null); setNewVal(''); setMotif(''); }} style={{ flex: 1 }}>Annuler</Button>
            <Button onClick={submit} disabled={saving || newVal === '' || ecart === 0} style={{ flex: 1 }}>{saving ? '...' : '✓ Régulariser'}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Vue liste (sélecteur type + recherche + grille) -----
  return (
    <div>
      {/* Sélecteur conso / câble */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['conso', '📦 Consommables'], ['cable', '🔌 Câbles (tourets)']].map(([id, label]) => (
          <button key={id} onClick={() => { setItemType(id); setSearch(''); }} style={{
            flex: 1, padding: '10px 14px',
            background: itemType === id ? (id === 'cable' ? 'var(--blue)' : 'var(--orange)') : 'white',
            color: itemType === id ? 'white' : 'var(--ink-3)',
            border: `1.5px solid ${itemType === id ? (id === 'cable' ? 'var(--blue)' : 'var(--orange)') : 'var(--line)'}`,
            borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      <input
        placeholder={itemType === 'conso' ? '🔍 Rechercher un consommable...' : '🔍 Rechercher un touret (n° touret, câble...)'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid var(--line)', borderRadius: '100px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 16 }}
      />

      {filtered.length === 0 ? (
        <Empty icon={itemType === 'conso' ? '📦' : '🔌'} text="Aucun élément" sub={search ? 'Essayez un autre terme.' : (itemType === 'conso' ? 'Aucun consommable actif.' : 'Aucun touret dans ce périmètre.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
          {itemType === 'conso' ? filtered.map((a) => (
            <button key={a.id} onClick={() => { setSelected({ kind: 'conso', ...a }); setNewVal(String(a.qty)); }}
              style={regulCardStyle}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--orange)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div title={a.nom} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nom}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="mono">{a.ref}</span>
                  {a.emplacement && (<><span>·</span><span style={{ color: 'var(--orange)' }}>📍 {a.emplacement}</span></>)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>{a.qty}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>en stock</div>
              </div>
            </button>
          )) : filtered.map((t) => (
            <button key={t.touret_id} onClick={() => { setSelected({ kind: 'cable', ...t }); setNewVal(String(t.restante)); }}
              style={regulCardStyle}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div title={t.nom_cable} style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nom_cable}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="mono">touret {t.ref_touret}</span>
                  {t.emplacement && (<><span>·</span><span style={{ color: 'var(--orange)' }}>📍 {t.emplacement}</span></>)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>{t.restante}m</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase' }}>restant</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const regulCardStyle = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
  background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)',
  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
};


// ============================================================================
// Onglet HISTORIQUE
// ============================================================================
function HistoriqueTab({ regulations, stats }) {
  return (
    <div>
      {/* Stats par utilisateur */}
      {stats.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)', marginBottom: 10 }}>
            📊 Régul par utilisateur
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--blue)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {s.prenom} {s.nom_initiale}.
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <div>
                    <span className="mono" style={{ fontWeight: 800, fontSize: 16, color: 'var(--blue)' }}>{s.nb_regul}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginLeft: 4 }}>régul</span>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 12, color: 'var(--green)' }}>+{s.total_ajout || 0}</span>
                    <span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>/</span>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 12, color: 'var(--red)' }}>-{s.total_retrait || 0}</span>
                  </div>
                </div>
                {s.derniere_regul && (
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, marginTop: 4 }}>
                    Dernière : {fmtRelative(s.derniere_regul)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)', marginBottom: 10 }}>
        📜 Toutes les régularisations
      </h3>

      {regulations.length === 0 ? (
        <Empty icon="📜" text="Aucune régularisation" sub="Les régul apparaîtront ici après leur création." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {regulations.map((r) => (
            <div key={r.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: 'white',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--radius)',
              borderLeft: '4px solid ' + (r.ecart > 0 ? 'var(--green)' : 'var(--red)'),
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.nom}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="mono">{r.ref}</span>
                  <span>·</span>
                  <span>{r.users ? `${r.users.prenom} ${r.users.nom_initiale}.` : 'inconnu'}</span>
                  <span>·</span>
                  <span title={fmtDate(r.created_at)}>{fmtRelative(r.created_at)}</span>
                  {r.source === 'inventaire' && <Badge color="orange">📅 Inventaire</Badge>}
                  {r.motif && (
                    <>
                      <span>·</span>
                      <span style={{ fontStyle: 'italic' }}>« {r.motif} »</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>{r.qty_avant}</span>
                <span style={{ color: 'var(--ink-4)' }}>→</span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{r.qty_apres}</span>
                <span className="mono" style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: r.ecart > 0 ? 'var(--green-light, #DCFCE7)' : 'var(--red-light)',
                  color: r.ecart > 0 ? 'var(--green-dark, #166534)' : 'var(--red)',
                }}>
                  {r.ecart > 0 ? '+' : ''}{r.ecart}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const backBtn = { background: 'none', border: 'none', color: 'var(--ink-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' };
