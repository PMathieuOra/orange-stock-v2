import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, getServiceInfo, SERVICES_REF } from '../lib/supabase';
import { getMagasinInfo, MAGASINS_REF } from '../components/SessionSelectors';
import { Denied, PageLoader, Empty, Badge, Button } from '../components/ui';
import { touretStatus } from '../lib/helpers';
import {
  fetchConsos, createConso, updateConso, toggleConsoActif, deleteConso,
  fetchCables, createCable, updateCable, toggleCableActif, deleteCable,
  fetchTouretsForCable, createTouret, updateTouretRestante, deleteTouret,
} from '../hooks/useArticles';
import { downloadTemplate, parseFile, importConsos } from '../hooks/useImport';

export default function Articles() {
  const { isAdmin } = useAuth();
  const { service: sessionSvc, magasin: sessionMag } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Vue & scope actif (peut différer de la session si "autre périmètre")
  const [view, setView] = useState('list'); // list | detail | form
  const [activeService, setActiveService] = useState(null);
  const [activeMagasin, setActiveMagasin] = useState(null);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);

  const [tab, setTab] = useState('conso');
  const [consos, setConsos] = useState([]);
  const [cables, setCables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // {type, item}
  const [form, setForm] = useState(null); // {mode: 'create'|'edit', type, data}
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Sync activeScope with session on mount and session change
  useEffect(() => {
    setActiveService(sessionSvc);
    setActiveMagasin(sessionMag);
    setView('list');
    setDetail(null);
    setForm(null);
  }, [sessionSvc, sessionMag]);

  const isSessionScope = activeService === sessionSvc && activeMagasin === sessionMag;

  const fetchData = useCallback(async () => {
    if (!activeService || !activeMagasin) return;
    setLoading(true);
    const [c, t] = await Promise.all([
      fetchConsos(activeService, activeMagasin),
      fetchCables(activeService, activeMagasin),
    ]);
    setConsos(c.data);
    setCables(t.data);
    setLoading(false);
  }, [activeService, activeMagasin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!isAdmin) {
    return <Layout brandTitle="Articles" brandSub="Administration"><Denied /></Layout>;
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && detail) {
    return (
      <DetailView
        type={detail.type}
        item={detail.item}
        activeMagasin={activeMagasin}
        onBack={() => { setView('list'); fetchData(); }}
        onEdit={() => { setForm({ mode: 'edit', type: detail.type, data: detail.item }); setView('form'); }}
        toast={toast}
      />
    );
  }

  // ===== FORM VIEW =====
  if (view === 'form' && form) {
    return (
      <FormView
        mode={form.mode}
        type={form.type}
        data={form.data}
        service={activeService}
        magasin={activeMagasin}
        onCancel={() => { setView(detail ? 'detail' : 'list'); setForm(null); }}
        onDone={async (newOrUpdated) => {
          setForm(null);
          if (form.mode === 'create') {
            setView('list');
            fetchData();
          } else {
            // edit: refresh detail
            const refreshed = { ...detail.item, ...newOrUpdated };
            setDetail({ type: form.type, item: refreshed });
            setView('detail');
          }
        }}
        toast={toast}
      />
    );
  }

  // ===== LIST VIEW =====
  const items = tab === 'conso' ? consos : cables;

  return (
    <Layout brandTitle="Articles" brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={() => navigate('/admin')} style={backBtn}>← Administration</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, margin: '12px 0 4px' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Articles</h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
              {getServiceInfo(activeService).icon} {getServiceInfo(activeService).nom} · {getMagasinInfo(activeMagasin).nom}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setScopeModalOpen(true)}>
              👀 {isSessionScope ? 'Voir un autre périmètre' : 'Changer de périmètre'}
            </Button>
            {tab === 'conso' && (
              <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                📥 Importer
              </Button>
            )}
            <Button onClick={() => { setForm({ mode: 'create', type: tab, data: null }); setView('form'); }}>
              + Nouveau
            </Button>
          </div>
        </div>

        {/* Banner if hors session scope */}
        {!isSessionScope && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg, #FFF5EB 0%, #FFEBC9 100%)', border: '1.5px solid #FFD9B0', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>👀</span>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--orange-dark)' }}>
              Vous consultez : {getServiceInfo(activeService).nom} · {getMagasinInfo(activeMagasin).nom}
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>Hors de votre session. Toute action s'applique à ce périmètre.</div>
            </div>
            <button onClick={() => { setActiveService(sessionSvc); setActiveMagasin(sessionMag); }} style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: '100px', padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Revenir</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, margin: '16px 0' }}>
          {[['conso', `📦 Conso (${consos.length})`], ['cable', `🔌 Câbles (${cables.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? 'var(--ink)' : 'white', color: tab === id ? 'white' : 'var(--ink-3)', border: '1.5px solid ' + (tab === id ? 'var(--ink)' : 'var(--line)'), borderRadius: '100px', padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
          ))}
        </div>

        {loading ? <PageLoader /> : items.length === 0 ? <Empty icon="📦" text="Aucun article" sub="Cliquez '+ Nouveau' pour en créer un." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((a) => (
              <button key={a.id} onClick={() => { setDetail({ type: tab, item: a }); setView('detail'); }} style={{ ...card, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', opacity: a.actif ? 1 : 0.5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.nom}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                    <span className="mono">{tab === 'cable' ? a.ref_type : a.ref}</span> · seuil {a.seuil}
                  </div>
                </div>
                {tab === 'cable' && <Badge color={a.categorie === 'fibre' ? 'blue' : 'orange'}>{a.categorie}</Badge>}
                {!a.actif && <Badge color="gray">Désactivé</Badge>}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            ))}
          </div>
        )}

        {scopeModalOpen && (
          <ScopeModal
            current={{ service: activeService, magasin: activeMagasin }}
            onClose={() => setScopeModalOpen(false)}
            onApply={(svc, mag) => { setActiveService(svc); setActiveMagasin(mag); setScopeModalOpen(false); }}
          />
        )}

        {importModalOpen && (
          <ImportModal
            service={activeService}
            magasin={activeMagasin}
            onClose={() => setImportModalOpen(false)}
            onDone={() => { setImportModalOpen(false); fetchData(); }}
            toast={toast}
          />
        )}
      </div>
    </Layout>
  );
}

// ===== SCOPE MODAL =====
function ScopeModal({ current, onClose, onApply }) {
  const [svc, setSvc] = useState(current.service);
  const [mag, setMag] = useState(current.magasin);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 24, width: '100%', maxWidth: 460 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Voir un autre périmètre</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 18 }}>Sélectionnez le service et le magasin à consulter.</p>

        <div style={{ marginBottom: 16 }}>
          <div style={fieldLabel}>Service</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SERVICES_REF.map((s) => (
              <button key={s.id} onClick={() => setSvc(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: svc === s.id ? 'var(--orange-light)' : 'var(--bg)', border: `1.5px solid ${svc === s.id ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: svc === s.id ? 'var(--orange-dark)' : 'var(--ink)', textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span>{s.nom}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={fieldLabel}>Magasin</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MAGASINS_REF.map((m) => (
              <button key={m.id} onClick={() => setMag(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: mag === m.id ? 'var(--orange-light)' : 'var(--bg)', border: `1.5px solid ${mag === m.id ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: mag === m.id ? 'var(--orange-dark)' : 'var(--ink)', textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                <span>{m.nom}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={() => onApply(svc, mag)} style={{ flex: 1 }}>Voir ce stock</Button>
        </div>
      </div>
    </div>
  );
}

// ===== DETAIL VIEW =====
function DetailView({ type, item, activeMagasin, onBack, onEdit, toast }) {
  const isCable = type === 'cable';
  const ref = isCable ? item.ref_type : item.ref;
  const [tourets, setTourets] = useState([]);
  const [touretsLoading, setTouretsLoading] = useState(false);
  const [showTouretForm, setShowTouretForm] = useState(false);

  const loadTourets = useCallback(async () => {
    if (!isCable) return;
    setTouretsLoading(true);
    const res = await fetchTouretsForCable(item.id);
    setTourets(res.data);
    setTouretsLoading(false);
  }, [isCable, item.id]);

  useEffect(() => { loadTourets(); }, [loadTourets]);

  async function handleToggleActif() {
    const fn = isCable ? toggleCableActif : toggleConsoActif;
    await fn(item.id, !item.actif);
    item.actif = !item.actif; // mutate locally for instant feedback
    toast(item.actif ? `✓ ${item.nom} réactivé` : `🔒 ${item.nom} désactivé`);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement "${item.nom}" (${ref}) ?\n\nCette action est irréversible.`)) return;
    const fn = isCable ? deleteCable : deleteConso;
    const res = await fn(item.id);
    if (res.ok) { toast(`🗑️ ${item.nom} supprimé`); onBack(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  const totalRestante = tourets.reduce((s, t) => s + t.restante, 0);

  return (
    <Layout brandTitle={isCable ? 'Câble' : 'Article'} brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={onBack} style={backBtn}>← Articles</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, margin: '12px 0 16px' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{item.nom}</h1>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Badge color={isCable ? 'blue' : 'orange'}>{isCable ? '🔌 Câble' : '📦 Conso'}</Badge>
              {isCable && <Badge color={item.categorie === 'fibre' ? 'blue' : 'orange'}>{item.categorie}</Badge>}
              <Badge color={item.actif ? 'green' : 'gray'}>{item.actif ? 'Actif' : 'Désactivé'}</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={onEdit}>✏️ Modifier</Button>
            <Button variant="secondary" onClick={handleToggleActif}>{item.actif ? '🔒 Désactiver' : '🔓 Réactiver'}</Button>
            <Button variant="danger" onClick={handleDelete}>🗑️ Supprimer</Button>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Info label="Référence" value={<span className="mono">{ref}</span>} />
          <Info label="Seuil" value={`${item.seuil}${isCable ? ' m' : ''}`} />
          {!isCable && <Info label="Stock actuel" value={`${item.qty} unités`} />}
          {isCable && <Info label="Stock total" value={`${totalRestante} m`} />}
          {isCable && <Info label="Tourets" value={`${tourets.length}`} />}
        </div>

        {isCable && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>Tourets ({tourets.length})</div>
              <Button onClick={() => setShowTouretForm(true)} style={{ padding: '8px 14px', fontSize: 13 }}>+ Ajouter touret</Button>
            </div>

            {showTouretForm && (
              <TouretForm
                typeCableId={item.id}
                onCancel={() => setShowTouretForm(false)}
                onDone={() => { setShowTouretForm(false); loadTourets(); }}
                toast={toast}
              />
            )}

            {touretsLoading ? <PageLoader /> : tourets.length === 0 ? (
              <Empty icon="🎰" text="Aucun touret" sub="Ajoutez un touret pour commencer." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tourets.map((t) => (
                  <TouretItem key={t.id} touret={t} onUpdate={loadTourets} toast={toast} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function TouretItem({ touret, onUpdate, toast }) {
  const [editing, setEditing] = useState(false);
  const [restante, setRestante] = useState(touret.restante);
  const status = touretStatus(touret);
  const statusColors = { neuf: 'green', entame: 'amber', vide: 'red' };
  const statusLabels = { neuf: '🆕 Neuf', entame: '🔄 Entamé', vide: '⚠ Vide' };

  async function save() {
    const res = await updateTouretRestante(touret.id, restante, touret.initiale);
    if (res.ok) { toast(`✓ Touret ${touret.ref_touret} mis à jour`); setEditing(false); onUpdate(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  async function del() {
    if (!confirm(`Supprimer le touret ${touret.ref_touret} ?`)) return;
    const res = await deleteTouret(touret.id);
    if (res.ok) { toast('🗑️ Touret supprimé'); onUpdate(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div style={card}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{touret.ref_touret}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
          Initial : {touret.initiale} m
        </div>
      </div>
      {editing ? (
        <>
          <input type="number" min="0" max={touret.initiale} value={restante} onChange={(e) => setRestante(e.target.value)} style={{ width: 80, padding: 8, border: '1.5px solid var(--orange)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center' }} />
          <button onClick={save} style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: '100px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✓</button>
          <button onClick={() => { setRestante(touret.restante); setEditing(false); }} style={{ background: 'var(--line-2)', color: 'var(--ink)', border: 'none', borderRadius: '100px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>×</button>
        </>
      ) : (
        <>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{touret.restante} m</div>
            <Badge color={statusColors[status]}>{statusLabels[status]}</Badge>
          </div>
          <button onClick={() => setEditing(true)} style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
          <button onClick={del} style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>🗑</button>
        </>
      )}
    </div>
  );
}

function TouretForm({ typeCableId, onCancel, onDone, toast }) {
  const [ref, setRef] = useState('');
  const [initiale, setInitiale] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!ref.trim()) return toast('Référence requise', 'error');
    if (!initiale || parseInt(initiale) <= 0) return toast('Longueur invalide', 'error');
    setSaving(true);
    const res = await createTouret({ ref_touret: ref.trim(), type_cable_id: typeCableId, initiale });
    setSaving(false);
    if (res.ok) { toast(`✓ Touret ${ref} ajouté`); onDone(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div style={{ background: 'var(--orange-light)', border: '1.5px solid var(--orange)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input placeholder="Réf. touret (ex: TR-2050)" value={ref} onChange={(e) => setRef(e.target.value)} style={{ flex: 1, minWidth: 140, padding: 10, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600 }} />
      <input type="number" min="1" placeholder="Longueur (m)" value={initiale} onChange={(e) => setInitiale(e.target.value)} style={{ width: 130, padding: 10, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600 }} />
      <Button onClick={submit} disabled={saving} style={{ padding: '10px 14px', fontSize: 13 }}>{saving ? '...' : '+ Ajouter'}</Button>
      <Button variant="secondary" onClick={onCancel} style={{ padding: '10px 14px', fontSize: 13 }}>Annuler</Button>
    </div>
  );
}

// ===== FORM VIEW (create / edit article) =====
function FormView({ mode, type, data, service, magasin, onCancel, onDone, toast }) {
  const isCable = type === 'cable';
  const isEdit = mode === 'edit';
  const [ref, setRef] = useState(isEdit ? (isCable ? data.ref_type : data.ref) : '');
  const [nom, setNom] = useState(isEdit ? data.nom : '');
  const [seuil, setSeuil] = useState(isEdit ? data.seuil : (isCable ? 200 : 10));
  const [categorie, setCategorie] = useState(isEdit && isCable ? data.categorie : 'fibre');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!ref.trim()) return toast('Référence requise', 'error');
    if (!nom.trim()) return toast('Nom requis', 'error');
    setSaving(true);

    if (isEdit) {
      const fn = isCable ? updateCable : updateConso;
      const payload = isCable ? { nom, categorie, seuil } : { nom, seuil };
      const res = await fn(data.id, payload);
      setSaving(false);
      if (res.ok) { toast(`✓ ${nom} mis à jour`, 'success'); onDone({ ...data, ...payload }); }
      else toast('Erreur : ' + res.error, 'error');
    } else {
      const fn = isCable ? createCable : createConso;
      const payload = isCable ? { ref_type: ref.trim(), nom: nom.trim(), categorie, seuil, service, magasin } : { ref: ref.trim(), nom: nom.trim(), seuil, service, magasin };
      const res = await fn(payload);
      setSaving(false);
      if (res.ok) { toast(`✓ ${nom} créé`, 'success'); onDone(res.data); }
      else toast('Erreur : ' + res.error, 'error');
    }
  }

  return (
    <Layout brandTitle={isEdit ? 'Modifier' : 'Nouveau'} brandSub="Article">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={onCancel} style={backBtn}>← Retour</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 4px' }}>
          {isEdit ? 'Modifier' : 'Nouveau'} {isCable ? 'câble' : 'consommable'}
        </h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 20 }}>
          {getServiceInfo(service).icon} {getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}
        </p>

        <Field label="Référence" required>
          <input value={ref} onChange={(e) => setRef(e.target.value)} disabled={isEdit} className="mono" style={input} placeholder={isCable ? 'L1016-12FO' : 'PRJ45-C6'} />
          {isEdit && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>La référence ne peut pas être modifiée.</div>}
        </Field>

        <Field label="Nom" required>
          <input value={nom} onChange={(e) => setNom(e.target.value)} style={input} placeholder="Nom affiché" />
        </Field>

        {isCable && (
          <Field label="Catégorie" required>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['fibre', '🌐 Fibre'], ['cuivre', '🟫 Cuivre']].map(([id, lbl]) => (
                <button key={id} onClick={() => setCategorie(id)} style={{ flex: 1, padding: 12, background: categorie === id ? 'var(--orange-light)' : 'white', color: categorie === id ? 'var(--orange-dark)' : 'var(--ink)', border: `1.5px solid ${categorie === id ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 'var(--radius)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{lbl}</button>
              ))}
            </div>
          </Field>
        )}

        <Field label={`Seuil d'alerte ${isCable ? '(m)' : '(unités)'}`} required>
          <input type="number" min="0" value={seuil} onChange={(e) => setSeuil(e.target.value)} style={input} />
        </Field>

        <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </div>
    </Layout>
  );
}

// ===== shared =====
const backBtn = { background: 'none', border: 'none', color: 'var(--ink-3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 };
const card = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' };
const fieldLabel = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 8 };
const input = { width: '100%', padding: 12, border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', background: 'white', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--ink)', outline: 'none' };

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={fieldLabel}>{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</div>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-4)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ===== IMPORT MODAL =====
function ImportModal({ service, magasin, onClose, onDone, toast }) {
  const [step, setStep] = useState('upload'); // upload | preview | result
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setParsing(true);
    const res = await parseFile(f);
    setParsing(false);
    if (!res.ok) {
      toast(res.error, 'error');
      setFile(null);
      return;
    }
    setParseResult(res);
    setStep('preview');
  }

  async function confirmImport() {
    setImporting(true);
    const res = await importConsos({ items: parseResult.items, service, magasin });
    setImporting(false);
    if (!res.ok) return toast(res.error, 'error');
    setReport(res);
    setStep('result');
    if (res.inserted > 0) toast(`✓ ${res.inserted} article(s) importé(s)`, 'success');
  }

  function finishImport() {
    onDone();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>📥 Importer des consommables</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              {getServiceInfo(service).icon} {getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '100px', background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>

        {/* Bannière de scope */}
        <div style={{ padding: '10px 14px', background: 'var(--orange-light)', border: '1.5px dashed #FFD9B0', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--orange-dark)', fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
          ⚠️ Les articles seront créés dans le périmètre <strong>{getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}</strong>. Changez de pastilles avant d'importer si ce n'est pas le bon scope.
        </div>

        {step === 'upload' && (
          <>
            {/* Étape 1 : Télécharger le modèle */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                Étape 1 — Téléchargez un modèle
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => downloadTemplate('xlsx')} style={{ flex: 1 }}>
                  📊 Modèle Excel (.xlsx)
                </Button>
                <Button variant="secondary" onClick={() => downloadTemplate('csv')} style={{ flex: 1 }}>
                  📄 Modèle CSV
                </Button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8, fontWeight: 600 }}>
                Le fichier contient 4 colonnes : <span className="mono">ref, nom, seuil, qty</span>. Une feuille d'aide explique tout.
              </p>
            </div>

            {/* Étape 2 : Charger le fichier */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                Étape 2 — Chargez votre fichier rempli
              </div>
              <label style={{ display: 'block', padding: 32, border: '2px dashed var(--line)', borderRadius: 'var(--radius)', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)', transition: 'all 0.15s' }}>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
                <div style={{ fontSize: 40, marginBottom: 8 }}>{parsing ? '⏳' : '📂'}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                  {parsing ? 'Analyse en cours...' : 'Cliquez pour choisir un fichier'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 4 }}>
                  Excel (.xlsx) ou CSV
                </div>
              </label>
            </div>
          </>
        )}

        {step === 'preview' && parseResult && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
              Aperçu — {parseResult.items.length} article(s) détecté(s)
            </div>

            {parseResult.errors.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'var(--amber-light)', border: '1.5px solid #FCD34D', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                ⚠️ {parseResult.errors.length} ligne(s) invalide(s) sera/seront ignorée(s) :
                <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 11 }}>
                  {parseResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {parseResult.errors.length > 5 && <li>… et {parseResult.errors.length - 5} autres</li>}
                </ul>
              </div>
            )}

            <div style={{ maxHeight: 280, overflow: 'auto', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: 'var(--bg)', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={th}>Réf</th>
                    <th style={th}>Nom</th>
                    <th style={{ ...th, textAlign: 'right' }}>Seuil</th>
                    <th style={{ ...th, textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.items.slice(0, 50).map((it, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{it.ref}</td>
                      <td style={td}>{it.nom}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.seuil}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.qty}</td>
                    </tr>
                  ))}
                  {parseResult.items.length > 50 && (
                    <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--ink-4)', fontStyle: 'italic' }}>
                      ... et {parseResult.items.length - 50} autre(s)
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => { setStep('upload'); setFile(null); setParseResult(null); }} style={{ flex: 1 }}>
                ← Choisir un autre fichier
              </Button>
              <Button onClick={confirmImport} disabled={importing || parseResult.items.length === 0} style={{ flex: 2 }}>
                {importing ? 'Import en cours...' : `✓ Importer ${parseResult.items.length} article(s)`}
              </Button>
            </div>
          </>
        )}

        {step === 'result' && report && (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0', marginBottom: 16 }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Import terminé !</div>
            </div>

            <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600 }}>📦 Lignes lues</span>
                <span className="mono" style={{ fontWeight: 800 }}>{report.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--green)' }}>
                <span style={{ fontWeight: 700 }}>✓ Articles créés</span>
                <span className="mono" style={{ fontWeight: 800 }}>{report.inserted}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: report.skipped.length ? 'var(--amber)' : 'var(--ink-4)' }}>
                <span style={{ fontWeight: 700 }}>⏭️ Doublons ignorés</span>
                <span className="mono" style={{ fontWeight: 800 }}>{report.skipped.length}</span>
              </div>
              {report.insertErrors.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)', color: 'var(--red)' }}>
                  <span style={{ fontWeight: 700 }}>✗ Erreurs</span>
                  <span className="mono" style={{ fontWeight: 800 }}>{report.insertErrors.length}</span>
                </div>
              )}
            </div>

            {report.skipped.length > 0 && (
              <details style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--amber-light)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--amber)' }}>
                  Voir les références ignorées ({report.skipped.length})
                </summary>
                <div className="mono" style={{ marginTop: 8, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  {report.skipped.join(', ')}
                </div>
              </details>
            )}

            <Button onClick={finishImport} style={{ width: '100%' }}>
              ✓ Terminer
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

const th = { textAlign: 'left', padding: '8px 10px', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)' };
const td = { padding: '8px 10px', fontWeight: 600 };
