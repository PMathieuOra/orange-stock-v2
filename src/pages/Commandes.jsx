import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, getServiceInfo } from '../lib/supabase';
import { getMagasinInfo } from '../components/SessionSelectors';
import { Denied, PageLoader, Empty, Badge, Button } from '../components/ui';
import { fmtDate, fmtPrice } from '../lib/helpers';
import {
  genNumeroCommande,
  fetchArticlesForScope,
  createCommande,
  receptionCommande,
  archiveCommande,
  deleteCommande,
} from '../hooks/useCommandes';

const STATUT_LABELS = {
  en_cours: { label: 'En cours', color: 'amber' },
  recu_total: { label: 'Reçue', color: 'green' },
  archivee: { label: 'Archivée', color: 'gray' },
};

export default function Commandes() {
  const { isAdmin, user } = useAuth();
  const { service, magasin } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState('list');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('en_cours');
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);
    const { data } = await supabase
      .from('commandes')
      .select('*, commande_lignes(*)')
      .eq('service_id', service)
      .eq('magasin_id', magasin)
      .order('date_creation', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [service, magasin]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setView('list'); setSelected(null); }, [service, magasin]);

  if (!isAdmin) {
    return <Layout brandTitle="Commandes" brandSub="Administration"><Denied /></Layout>;
  }

  const filtered = rows.filter((c) => c.statut === tab);
  const counts = {
    en_cours: rows.filter((c) => c.statut === 'en_cours').length,
    recu_total: rows.filter((c) => c.statut === 'recu_total').length,
    archivee: rows.filter((c) => c.statut === 'archivee').length,
  };

  async function openDetail(cmd) {
    const { data } = await supabase
      .from('commandes')
      .select('*, commande_lignes(*)')
      .eq('id', cmd.id)
      .single();

    // Récupérer les prix des articles pour calculer le coût
    if (data && data.commande_lignes && data.commande_lignes.length) {
      const refs = data.commande_lignes.map((l) => l.ref);
      const table = data.type === 'cable' ? 'types_cable' : 'articles_conso';
      const refCol = data.type === 'cable' ? 'ref_type' : 'ref';
      const { data: articles } = await supabase
        .from(table)
        .select(`${refCol}, prix_ht`)
        .in(refCol, refs)
        .eq('service_id', data.service_id)
        .eq('magasin_id', data.magasin_id);

      const prixByRef = {};
      (articles || []).forEach((a) => {
        prixByRef[a[refCol]] = a.prix_ht || 0;
      });
      data.commande_lignes = data.commande_lignes.map((l) => ({
        ...l,
        prix_ht: prixByRef[l.ref] || 0,
      }));
    }

    setSelected(data || cmd);
    setView('detail');
  }

  if (view === 'list') {
    return (
      <Layout brandTitle="Commandes" brandSub="Administration">
        <div style={{ padding: '16px 20px' }}>
          <button onClick={() => navigate('/admin')} style={backBtn}>← Administration</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, margin: '12px 0 4px' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Commandes</h1>
              <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
                {getServiceInfo(service).icon} {getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}
              </p>
            </div>
            <Button onClick={() => setView('create')}>+ Nouvelle commande</Button>
          </div>

          <div style={{ display: 'flex', gap: 6, margin: '16px 0' }}>
            {Object.entries(STATUT_LABELS).map(([id, { label }]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? 'var(--ink)' : 'white', color: tab === id ? 'white' : 'var(--ink-3)', border: '1.5px solid ' + (tab === id ? 'var(--ink)' : 'var(--line)'), borderRadius: '100px', padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{label} ({counts[id]})</button>
            ))}
          </div>

          {loading ? <PageLoader /> : filtered.length === 0 ? <Empty icon="📋" text="Aucune commande" sub="Aucune commande dans cette catégorie." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((c) => {
                const totalCmd = (c.commande_lignes || []).reduce((s, l) => s + l.qty_commandee, 0);
                const totalRecu = (c.commande_lignes || []).reduce((s, l) => s + l.qty_recue, 0);
                const pct = totalCmd > 0 ? Math.round((totalRecu / totalCmd) * 100) : 0;
                return (
                  <button key={c.id} onClick={() => openDetail(c)} style={{ ...card, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontWeight: 800, fontSize: 15 }}>{c.numero}</span>
                        <Badge color={STATUT_LABELS[c.statut].color}>{STATUT_LABELS[c.statut].label}</Badge>
                        <Badge color={c.type === 'cable' ? 'blue' : 'orange'}>{c.type === 'cable' ? '🔌 Câble' : '📦 Conso'}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 4 }}>
                        Créée le {fmtDate(c.date_creation)} · {(c.commande_lignes || []).length} ligne(s)
                        {c.statut === 'en_cours' && totalRecu > 0 && ` · ${pct}% reçu`}
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (view === 'detail' && selected) {
    const totalCmd = (selected.commande_lignes || []).reduce((s, l) => s + l.qty_commandee, 0);
    const totalRecu = (selected.commande_lignes || []).reduce((s, l) => s + l.qty_recue, 0);
    return (
      <Layout brandTitle="Commande" brandSub="Administration">
        <div style={{ padding: '16px 20px' }}>
          <button onClick={() => { setView('list'); fetchData(); }} style={backBtn}>← Commandes</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, margin: '12px 0 16px' }}>
            <div>
              <h1 className="mono" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{selected.numero}</h1>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <Badge color={STATUT_LABELS[selected.statut].color}>{STATUT_LABELS[selected.statut].label}</Badge>
                <Badge color={selected.type === 'cable' ? 'blue' : 'orange'}>{selected.type === 'cable' ? '🔌 Câble' : '📦 Conso'}</Badge>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.statut === 'en_cours' && <Button onClick={() => setView('reception')}>📥 Réceptionner</Button>}
              {selected.statut === 'recu_total' && <Button variant="secondary" onClick={async () => { await archiveCommande(selected.id); toast('✓ Commande archivée', 'success'); setView('list'); fetchData(); }}>Archiver</Button>}
              <Button variant="danger" onClick={async () => { if (!confirm(`Supprimer la commande ${selected.numero} ?`)) return; await deleteCommande(selected.id); toast('🗑️ Commande supprimée'); setView('list'); fetchData(); }}>Supprimer</Button>
            </div>
          </div>

          <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Info label="Date création" value={fmtDate(selected.date_creation)} />
            <Info label="Date réception" value={selected.date_reception ? fmtDate(selected.date_reception) : '—'} />
            <Info label="Progression" value={`${totalRecu}/${totalCmd} unités`} />
            <Info label="Lignes" value={`${(selected.commande_lignes || []).length}`} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>Articles commandés</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(selected.commande_lignes || []).map((l) => {
              const complete = l.qty_recue >= l.qty_commandee;
              const sousTotal = l.qty_commandee * (l.prix_ht || 0);
              return (
                <div key={l.id} style={card}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{l.ref}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                      Reçu {l.qty_recue} / {l.qty_commandee}
                      {l.prix_ht > 0 && ` · ${fmtPrice(l.prix_ht)}${selected.type === 'cable' ? '/m' : '/u'}`}
                    </div>
                  </div>
                  {sousTotal > 0 && (
                    <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', minWidth: 70, textAlign: 'right' }}>
                      {fmtPrice(sousTotal)}
                    </span>
                  )}
                  <Badge color={complete ? 'green' : 'amber'}>{complete ? '✓ Complet' : 'En attente'}</Badge>
                </div>
              );
            })}
          </div>

          {/* Total commande */}
          {(() => {
            const total = (selected.commande_lignes || []).reduce((s, l) => s + l.qty_commandee * (l.prix_ht || 0), 0);
            if (total === 0) return null;
            return (
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--green-light)', border: '1.5px solid #B0E5D0', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)' }}>💰 Coût total HT</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 18, color: 'var(--green)' }}>{fmtPrice(total)}</span>
              </div>
            );
          })()}
        </div>
      </Layout>
    );
  }

  if (view === 'reception' && selected) {
    return <ReceptionForm commande={selected} userId={user.id} onCancel={() => setView('detail')} onDone={() => { setView('list'); fetchData(); }} toast={toast} />;
  }

  if (view === 'create') {
    return <CreateForm service={service} magasin={magasin} userId={user.id} onCancel={() => setView('list')} onDone={() => { setView('list'); fetchData(); }} toast={toast} />;
  }

  return null;
}

function ReceptionForm({ commande, userId, onCancel, onDone, toast }) {
  const [receptions, setReceptions] = useState(
    (commande.commande_lignes || []).map((l) => ({ ligneId: l.id, ref: l.ref, reste: l.qty_commandee - l.qty_recue, qtyAjout: 0 }))
  );
  const [saving, setSaving] = useState(false);

  function setQty(ligneId, val) {
    setReceptions((r) => r.map((x) => (x.ligneId === ligneId ? { ...x, qtyAjout: Math.max(0, Math.min(x.reste, parseInt(val) || 0)) } : x)));
  }
  async function submit() {
    const toReceive = receptions.filter((r) => r.qtyAjout > 0);
    if (!toReceive.length) return toast('Indiquez au moins une quantité reçue', 'error');
    setSaving(true);
    const res = await receptionCommande(commande, toReceive, userId);
    setSaving(false);
    if (res.ok) { toast(res.statut === 'recu_total' ? '✓ Commande entièrement reçue' : '✓ Réception partielle enregistrée', 'success'); onDone(); }
    else toast('Erreur lors de la réception', 'error');
  }

  return (
    <Layout brandTitle="Réception" brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={onCancel} style={backBtn}>← Détail</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 4px' }}>Réceptionner</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}><span className="mono">{commande.numero}</span> — saisissez les quantités reçues.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {receptions.map((r) => (
            <div key={r.ligneId} style={card}>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{r.ref}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>Reste à recevoir : {r.reste}</div>
              </div>
              {r.reste > 0 ? (
                <input type="number" min="0" max={r.reste} value={r.qtyAjout} onChange={(e) => setQty(r.ligneId, e.target.value)} style={{ width: 80, padding: '10px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center' }} />
              ) : <Badge color="green">✓ Complet</Badge>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Enregistrement...' : 'Valider la réception'}</Button>
        </div>
      </div>
    </Layout>
  );
}

function CreateForm({ service, magasin, userId, onCancel, onDone, toast }) {
  const [type, setType] = useState('conso');
  const [numero, setNumero] = useState('');
  const [available, setAvailable] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { genNumeroCommande().then(setNumero); }, []);
  useEffect(() => { fetchArticlesForScope(service, magasin, type).then(setAvailable); setLignes([]); }, [service, magasin, type]);

  function addLigne(ref, nom, prix_ht) { if (lignes.some((l) => l.ref === ref)) return; setLignes((l) => [...l, { ref, nom, prix_ht: prix_ht || 0, qty_commandee: 1 }]); }
  function setQty(ref, qty) { setLignes((l) => l.map((x) => (x.ref === ref ? { ...x, qty_commandee: Math.max(1, parseInt(qty) || 1) } : x))); }
  function removeLigne(ref) { setLignes((l) => l.filter((x) => x.ref !== ref)); }

  async function submit() {
    if (!lignes.length) return toast('Ajoutez au moins une ligne', 'error');
    setSaving(true);
    const res = await createCommande({ numero, type, service, magasin, lignes, userId });
    setSaving(false);
    if (res.ok) { toast(`✓ Commande ${numero} créée`, 'success'); onDone(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  const notAdded = available.filter((a) => !lignes.some((l) => l.ref === a.ref));

  return (
    <Layout brandTitle="Nouvelle commande" brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={onCancel} style={backBtn}>← Commandes</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 4px' }}>Nouvelle commande</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}><span className="mono">{numero || '...'}</span> · {getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}</p>

        <div style={{ marginBottom: 16 }}>
          <div style={fieldLabel}>Type de commande</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['conso', '📦 Consommables'], ['cable', '🔌 Câbles']].map(([id, label]) => (
              <button key={id} onClick={() => setType(id)} style={{ flex: 1, padding: '12px', border: `1.5px solid ${type === id ? 'var(--orange)' : 'var(--line)'}`, background: type === id ? 'var(--orange-light)' : 'white', color: type === id ? 'var(--orange-dark)' : 'var(--ink)', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
            ))}
          </div>
        </div>

        {lignes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={fieldLabel}>Lignes ({lignes.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lignes.map((l) => {
                const sousTotal = l.qty_commandee * (l.prix_ht || 0);
                return (
                  <div key={l.ref} style={card}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{l.nom}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>
                        {l.ref}{l.prix_ht > 0 && ` · ${fmtPrice(l.prix_ht)}${type === 'cable' ? '/m' : '/u'}`}
                      </div>
                    </div>
                    <input type="number" min="1" value={l.qty_commandee} onChange={(e) => setQty(l.ref, e.target.value)} style={{ width: 70, padding: '8px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center' }} />
                    {sousTotal > 0 && (
                      <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', minWidth: 70, textAlign: 'right' }}>
                        {fmtPrice(sousTotal)}
                      </span>
                    )}
                    <button onClick={() => removeLigne(l.ref)} style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontWeight: 800 }}>×</button>
                  </div>
                );
              })}
            </div>

            {/* Total estimé */}
            {(() => {
              const total = lignes.reduce((s, l) => s + l.qty_commandee * (l.prix_ht || 0), 0);
              if (total === 0) return null;
              return (
                <div style={{ marginTop: 10, padding: '12px 16px', background: 'var(--green-light)', border: '1.5px solid #B0E5D0', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)' }}>💰 Coût total estimé HT</span>
                  <span className="mono" style={{ fontWeight: 800, fontSize: 18, color: 'var(--green)' }}>{fmtPrice(total)}</span>
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={fieldLabel}>Ajouter un article</div>
          {notAdded.length === 0 ? <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600 }}>Tous les articles sont ajoutés (ou aucun dans ce périmètre).</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notAdded.map((a) => (
                <button key={a.ref} onClick={() => addLigne(a.ref, a.nom, a.prix_ht)} style={{ ...card, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nom}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>
                      {a.ref}{a.prix_ht > 0 && ` · ${fmtPrice(a.prix_ht)}${type === 'cable' ? '/m' : '/u'}`}
                    </div>
                  </div>
                  <span style={{ color: 'var(--orange)', fontWeight: 800 }}>+ Ajouter</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={saving || !lignes.length} style={{ flex: 1 }}>{saving ? 'Création...' : 'Créer la commande'}</Button>
        </div>
      </div>
    </Layout>
  );
}

const backBtn = { background: 'none', border: 'none', color: 'var(--ink-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 };
const card = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' };
const fieldLabel = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 8 };

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-4)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
