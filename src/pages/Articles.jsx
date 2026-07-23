import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, getServiceInfo, SERVICES_REF } from '../lib/supabase';
import { getMagasinInfo, MAGASINS_REF } from '../components/SessionSelectors';
import { Denied, PageLoader, Empty, Badge, Button } from '../components/ui';
import { touretStatus, fmtPrice } from '../lib/helpers';
import {
  fetchConsos, createConso, updateConso, toggleConsoActif, deleteConso,
  fetchCables, createCable, updateCable, toggleCableActif, deleteCable,
  fetchTouretsForCable, createTouret, updateTouretRestante, updateTouretEmplacement, deleteTouret,
  fetchEmplacementsSuggestions,
} from '../hooks/useArticles';
import { downloadConsoTemplate, downloadCableTemplate, parseFile, parseCableFile, importConsos, importCables } from '../hooks/useImport';
import { transferTouret } from '../hooks/useTransfert';
import { generateTouretLabels, downloadPdf, LABEL_FORMATS } from '../lib/labels';
import { fetchMagasins } from '../hooks/useMagasins';

export default function Articles() {
  const { isAdmin, user: currentUser } = useAuth();
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
  const [search, setSearch] = useState('');
  const [emplacementSuggestions, setEmplacementSuggestions] = useState([]);

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
    const [c, t, suggestions] = await Promise.all([
      fetchConsos(activeService, activeMagasin),
      fetchCables(activeService, activeMagasin),
      fetchEmplacementsSuggestions(activeService, activeMagasin),
    ]);
    setConsos(c.data);
    setCables(t.data);
    setEmplacementSuggestions(suggestions || []);
    setLoading(false);
  }, [activeService, activeMagasin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // useMemo doit être appelé AVANT tout early return (Rules of Hooks)
  const itemsRaw = tab === 'conso' ? consos : cables;
  const items = useMemo(() => {
    if (!search.trim()) return itemsRaw;
    const q = search.toLowerCase().trim();
    return itemsRaw.filter((it) => {
      const ref = tab === 'conso' ? (it.ref || '') : (it.ref_type || '');
      return (ref + ' ' + (it.nom || '')).toLowerCase().includes(q);
    });
  }, [itemsRaw, search, tab]);

  if (!isAdmin) {
    return <Layout brandTitle="Articles" brandSub="Administration"><Denied /></Layout>;
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && detail) {
    return (
      <DetailView
        type={detail.type}
        item={detail.item}
        activeService={activeService}
        activeMagasin={activeMagasin}
        emplacementSuggestions={emplacementSuggestions}
        isAdmin={isAdmin}
        userId={currentUser?.id}
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
        userId={currentUser?.id}
        emplacementSuggestions={emplacementSuggestions}
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
  return (
    <Layout brandTitle="Articles" brandSub="Administration">
      <div style={{ padding: '16px 20px', maxWidth: 1400, margin: '0 auto' }}>
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
            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
              📥 Importer
            </Button>
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

        {/* Barre de recherche */}
        <input
          placeholder="🔍 Rechercher par référence ou nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', border: '1.5px solid var(--line)', borderRadius: '100px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 12 }}
        />
        {search && (
          <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 8 }}>
            {items.length} résultat{items.length > 1 ? 's' : ''} sur {itemsRaw.length}
          </div>
        )}

        {loading ? <PageLoader /> : items.length === 0 ? <Empty icon="📦" text={search ? 'Aucun résultat' : 'Aucun article'} sub={search ? "Essayez un autre terme." : "Cliquez '+ Nouveau' pour en créer un."} /> : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 8,
          }}>
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
            mode={tab}
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
  const [magasins, setMagasins] = useState([]);

  useEffect(() => {
    fetchMagasins().then((r) => setMagasins((r.data || []).filter((m) => m.actif !== false)));
  }, []);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 24, width: '100%', maxWidth: 460 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Voir un autre périmètre</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 18 }}>Sélectionnez le service et le magasin à consulter.</p>

        <div style={{ marginBottom: 16 }}>
          <div style={fieldLabelTransfer}>Service</div>
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
          <div style={fieldLabelTransfer}>Magasin</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {magasins.map((m) => (
              <button key={m.id} onClick={() => setMag(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: mag === m.id ? 'var(--orange-light)' : 'var(--bg)', border: `1.5px solid ${mag === m.id ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: mag === m.id ? 'var(--orange-dark)' : 'var(--ink)', textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>{m.icon || '🏪'}</span>
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
function DetailView({ type, item, activeService, activeMagasin, emplacementSuggestions = [], isAdmin = false, userId, onBack, onEdit, toast }) {
  const isCable = type === 'cable';
  const ref = isCable ? item.ref_type : item.ref;
  const [tourets, setTourets] = useState([]);
  const [touretsLoading, setTouretsLoading] = useState(false);
  const [showTouretForm, setShowTouretForm] = useState(false);
  const [transferModalTouret, setTransferModalTouret] = useState(null);
  const [labelModal, setLabelModal] = useState(null); // null | { tourets: [...] }

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
          <Info label={`Prix HT ${isCable ? '(€/m)' : '(€/unité)'}`} value={fmtPrice(item.prix_ht)} />
          <Info label="Valeur du stock" value={fmtPrice((isCable ? totalRestante : item.qty) * (item.prix_ht || 0))} />
          {!isCable && (
            <Info label="📍 Emplacement" value={item.emplacement || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>Non renseigné</span>} />
          )}
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
                suggestions={emplacementSuggestions}
                onCancel={() => setShowTouretForm(false)}
                onDone={() => { setShowTouretForm(false); loadTourets(); }}
                toast={toast}
              />
            )}

            {touretsLoading ? <PageLoader /> : tourets.length === 0 ? (
              <Empty icon="🎰" text="Aucun touret" sub="Ajoutez un touret pour commencer." />
            ) : (
              <>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setLabelModal({ tourets, title: `Planche ${item.nom}` })} style={{ padding: '8px 14px', fontSize: 13 }}>
                    🖨 Imprimer planche ({tourets.length})
                  </Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tourets.map((t) => (
                    <TouretItem
                      key={t.id}
                      touret={t}
                      suggestions={emplacementSuggestions}
                      isAdmin={isAdmin}
                      cableInfo={item}
                      scopeInfo={{ service: activeService, magasin: activeMagasin }}
                      onUpdate={loadTourets}
                      onTransfer={(touret) => setTransferModalTouret(touret)}
                      onLabel={(touret) => setLabelModal({ tourets: [touret], title: `Étiquette ${touret.ref_touret}` })}
                      toast={toast}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {transferModalTouret && (
        <TransferModal
          touret={transferModalTouret}
          cable={item}
          currentService={activeService}
          currentMagasin={activeMagasin}
          userId={userId}
          onClose={() => setTransferModalTouret(null)}
          onDone={() => { setTransferModalTouret(null); loadTourets(); toast('✓ Touret transféré', 'success'); }}
          toast={toast}
        />
      )}

      {labelModal && (
        <LabelFormatModal
          tourets={labelModal.tourets}
          cable={item}
          scopeInfo={{ service: activeService, magasin: activeMagasin }}
          title={labelModal.title}
          onClose={() => setLabelModal(null)}
          toast={toast}
        />
      )}
    </Layout>
  );
}

function TouretItem({ touret, suggestions = [], cableInfo = {}, scopeInfo = {}, isAdmin = false, onUpdate, onTransfer, onLabel, toast }) {
  const [editing, setEditing] = useState(false);
  const [restante, setRestante] = useState(touret.restante);
  const [emplacement, setEmplacement] = useState(touret.emplacement || '');
  const status = touretStatus(touret);
  const statusColors = { neuf: 'green', entame: 'amber', vide: 'red' };
  const statusLabels = { neuf: '🆕 Neuf', entame: '🔄 Entamé', vide: '⚠ Vide' };

  async function save() {
    // Update restante d'abord (avec validation)
    const r = await updateTouretRestante(touret.id, restante, touret.initiale);
    if (!r.ok) return toast('Erreur : ' + r.error, 'error');
    // Update emplacement séparément (sans validation)
    if ((touret.emplacement || '') !== emplacement.trim()) {
      const e = await updateTouretEmplacement(touret.id, emplacement);
      if (!e.ok) return toast('Erreur emplacement : ' + e.error, 'error');
    }
    toast(`✓ Touret ${touret.ref_touret} mis à jour`);
    setEditing(false);
    onUpdate();
  }

  async function del() {
    if (!confirm(`Supprimer le touret ${touret.ref_touret} ?`)) return;
    const res = await deleteTouret(touret.id);
    if (res.ok) { toast('🗑️ Touret supprimé'); onUpdate(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  if (editing) {
    return (
      <div style={{ ...card, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{touret.ref_touret}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>Initial : {touret.initiale} m</div>
          </div>
          <input type="number" min="0" max={touret.initiale} value={restante} onChange={(e) => setRestante(e.target.value)} style={{ width: 90, padding: 8, border: '1.5px solid var(--orange)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center' }} />
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700 }}>m restant</span>
        </div>
        <EmplacementInput value={emplacement} onChange={setEmplacement} suggestions={suggestions} placeholder="📍 Emplacement (optionnel)" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} style={{ flex: 1, background: 'var(--green)', color: 'white', border: 'none', borderRadius: '100px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>✓ Enregistrer</button>
          <button onClick={() => { setRestante(touret.restante); setEmplacement(touret.emplacement || ''); setEditing(false); }} style={{ background: 'var(--line-2)', color: 'var(--ink)', border: 'none', borderRadius: '100px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>× Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{touret.ref_touret}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>Initial : {touret.initiale} m</span>
          {touret.emplacement && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--orange)' }}>📍 {touret.emplacement}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{touret.restante} m</div>
        {status !== 'neuf' && <Badge color={statusColors[status]}>{statusLabels[status]}</Badge>}
      </div>
      <button onClick={() => setEditing(true)} title="Modifier" style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
      {onLabel && (
        <button onClick={() => onLabel(touret)} title="Imprimer étiquette" style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontFamily: 'inherit' }}>🖨</button>
      )}
      {isAdmin && onTransfer && (
        <button onClick={() => onTransfer(touret)} title="Transférer vers un autre périmètre" style={{ background: 'var(--blue-light, #DBEAFE)', color: 'var(--blue)', border: 'none', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}>🔄</button>
      )}
      <button onClick={del} title="Supprimer" style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>🗑</button>
    </div>
  );
}

function TouretForm({ typeCableId, suggestions, onCancel, onDone, toast }) {
  const [ref, setRef] = useState('');
  const [initiale, setInitiale] = useState('');
  const [emplacement, setEmplacement] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!ref.trim()) return toast('Référence requise', 'error');
    if (!initiale || parseInt(initiale) <= 0) return toast('Longueur invalide', 'error');
    setSaving(true);
    const res = await createTouret({ ref_touret: ref.trim(), type_cable_id: typeCableId, initiale, emplacement });
    setSaving(false);
    if (res.ok) { toast(`✓ Touret ${ref} ajouté`); onDone(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div style={{ background: 'var(--orange-light)', border: '1.5px solid var(--orange)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input placeholder="Réf. touret (ex: TR-2050)" value={ref} onChange={(e) => setRef(e.target.value)} style={{ flex: 1, minWidth: 140, padding: 10, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600 }} />
      <input type="number" min="1" placeholder="Longueur (m)" value={initiale} onChange={(e) => setInitiale(e.target.value)} style={{ width: 130, padding: 10, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600 }} />
      <EmplacementInput value={emplacement} onChange={setEmplacement} suggestions={suggestions} placeholder="📍 Emplacement (optionnel)" style={{ flex: 1, minWidth: 180 }} />
      <Button onClick={submit} disabled={saving} style={{ padding: '10px 14px', fontSize: 13 }}>{saving ? '...' : '+ Ajouter'}</Button>
      <Button variant="secondary" onClick={onCancel} style={{ padding: '10px 14px', fontSize: 13 }}>Annuler</Button>
    </div>
  );
}

// Input emplacement avec autocomplete des valeurs existantes
function EmplacementInput({ value, onChange, suggestions = [], placeholder = '📍 Emplacement', style = {} }) {
  const [open, setOpen] = useState(false);
  const filtered = (suggestions || [])
    .filter((s) => !value || s.toLowerCase().includes(value.toLowerCase()))
    .filter((s) => s !== value)
    .slice(0, 6);

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={{ width: '100%', padding: 10, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, outline: 'none' }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'white',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100,
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink)',
                fontFamily: 'inherit',
                borderBottom: '1px solid var(--line-2)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              📍 {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== FORM VIEW (create / edit article) =====
function FormView({ mode, type, data, service, magasin, userId, emplacementSuggestions = [], onCancel, onDone, toast }) {
  const isCable = type === 'cable';
  const isEdit = mode === 'edit';
  const [ref, setRef] = useState(isEdit ? (isCable ? (data.ref_type || '') : (data.ref || '')) : '');
  const [nom, setNom] = useState(isEdit ? data.nom : '');
  const [seuil, setSeuil] = useState(isEdit ? data.seuil : (isCable ? 200 : 10));
  const [categorie, setCategorie] = useState(isEdit && isCable ? data.categorie : 'fibre');
  const [prixHt, setPrixHt] = useState(isEdit ? (data.prix_ht || 0) : 0);
  const [qty, setQty] = useState(isEdit && !isCable ? (data.qty || 0) : 0);
  const [emplacement, setEmplacement] = useState(isEdit && !isCable ? (data.emplacement || '') : '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    // Référence : obligatoire pour les conso, optionnelle pour les câbles (EAN)
    if (!isCable && !ref.trim()) return toast('Référence requise', 'error');
    if (!nom.trim()) return toast('Nom requis', 'error');
    setSaving(true);

    if (isEdit) {
      const fn = isCable ? updateCable : updateConso;
      const refTrim = ref.trim();
      const payload = isCable
        ? { ref_type: refTrim, nom, categorie, seuil, prix_ht: prixHt }
        : { ref: refTrim, nom, seuil, prix_ht: prixHt, emplacement, qty: parseInt(qty) || 0, userId, oldQty: data.qty };
      const res = await fn(data.id, payload);
      setSaving(false);
      if (res.ok) {
        const updatedData = isCable
          ? { ...data, ref_type: refTrim || null, nom, categorie, seuil, prix_ht: prixHt }
          : { ...data, ref: refTrim, nom, seuil, prix_ht: prixHt, emplacement: emplacement?.trim() || null, qty: parseInt(qty) || 0 };
        toast(`✓ ${nom} mis à jour`, 'success');
        onDone(updatedData);
      }
      else toast('Erreur : ' + res.error, 'error');
    } else {
      const fn = isCable ? createCable : createConso;
      const payload = isCable
        ? { ref_type: ref.trim(), nom: nom.trim(), categorie, seuil, prix_ht: prixHt, service, magasin }
        : { ref: ref.trim(), nom: nom.trim(), seuil, prix_ht: prixHt, emplacement, service, magasin };
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

        <Field label={isCable ? 'Référence (EAN)' : 'Référence'} required={!isCable}>
          <input value={ref} onChange={(e) => setRef(e.target.value)} className="mono" style={input} placeholder={isCable ? 'EAN (optionnel)' : ''} />
          {isCable && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>L'EAN sert à passer commande. Peut être ajouté plus tard.</div>}
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

        {isEdit && !isCable && (
          <Field label="Quantité en stock (unités)">
            <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} style={input} />
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>
              Modifier cette valeur enregistre un mouvement d'ajustement dans le journal.
            </div>
          </Field>
        )}

        <Field label={`Prix unitaire HT ${isCable ? '(€/m)' : '(€)'}`}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={prixHt}
            onChange={(e) => setPrixHt(e.target.value)}
            style={input}
            placeholder="0.00"
          />
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>
            Optionnel. Utilisé pour calculer la valeur du stock et le coût des commandes.
          </div>
        </Field>

        {!isCable && (
          <Field label="📍 Emplacement">
            <EmplacementInput value={emplacement} onChange={setEmplacement} suggestions={emplacementSuggestions} placeholder="Ex: Allée A - Étagère 2" />
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>
              Optionnel. Aide les techniciens à trouver l'article dans le magasin.
              {isCable ? '' : ' Tapez pour voir les emplacements déjà utilisés.'}
            </div>
          </Field>
        )}

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
      <div style={fieldLabelTransfer}>{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</div>
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
function ImportModal({ mode, service, magasin, onClose, onDone, toast }) {
  const [step, setStep] = useState('upload'); // upload | preview | result
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);

  const isCable = mode === 'cable';
  const title = isCable ? '📥 Importer des câbles & tourets' : '📥 Importer des consommables';

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setParsing(true);
    const res = isCable ? await parseCableFile(f) : await parseFile(f);
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
    const res = isCable
      ? await importCables({ items: parseResult.items, service, magasin })
      : await importConsos({ items: parseResult.items, service, magasin });
    setImporting(false);
    if (!res.ok) return toast(res.error, 'error');
    setReport(res);
    setStep('result');
    if (isCable) {
      const total = res.touretsInserted + res.typesCreated;
      if (total > 0) toast(`✓ ${res.touretsInserted} touret(s) + ${res.typesCreated} type(s) créé(s)`, 'success');
    } else {
      if (res.inserted > 0) toast(`✓ ${res.inserted} article(s) importé(s)`, 'success');
    }
  }

  function finishImport() { onDone(); }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 24, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>{title}</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              {getServiceInfo(service).icon} {getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '100px', background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>

        {/* Bannière de scope */}
        <div style={{ padding: '10px 14px', background: 'var(--orange-light)', border: '1.5px dashed #FFD9B0', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--orange-dark)', fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
          ⚠️ Les {isCable ? 'câbles' : 'articles'} seront créés dans le périmètre <strong>{getServiceInfo(service).nom} · {getMagasinInfo(magasin).nom}</strong>. Changez de pastilles avant d'importer si ce n'est pas le bon scope.
        </div>

        {step === 'upload' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                Étape 1 — Téléchargez un modèle
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => isCable ? downloadCableTemplate('xlsx') : downloadConsoTemplate('xlsx')} style={{ flex: 1 }}>
                  📊 Modèle Excel (.xlsx)
                </Button>
                <Button variant="secondary" onClick={() => isCable ? downloadCableTemplate('csv') : downloadConsoTemplate('csv')} style={{ flex: 1 }}>
                  📄 Modèle CSV
                </Button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8, fontWeight: 600 }}>
                {isCable ? (
                  <>Le fichier contient : <span className="mono">ref_touret, nom_type, categorie, longueur</span> (obligatoires) + <span className="mono">ref_type, seuil, prix_ht</span> (optionnels). Une feuille d'aide explique tout.</>
                ) : (
                  <>Le fichier contient 4 colonnes : <span className="mono">ref, nom, seuil, qty</span>. Une feuille d'aide explique tout.</>
                )}
              </p>
            </div>

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
              Aperçu — {parseResult.items.length} {isCable ? 'touret(s)' : 'article(s)'} détecté(s)
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

            {isCable && (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
                ℹ️ {new Set(parseResult.items.map(i => `${i.nom_type}|||${i.categorie}`)).size} type(s) de câble distinct(s) détecté(s).
              </div>
            )}

            <div style={{ maxHeight: 280, overflow: 'auto', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: 'var(--bg)', position: 'sticky', top: 0 }}>
                  {isCable ? (
                    <tr>
                      <th style={th}>Touret</th>
                      <th style={th}>Type</th>
                      <th style={th}>Cat.</th>
                      <th style={{ ...th, textAlign: 'right' }}>Long.</th>
                      <th style={{ ...th, textAlign: 'right' }}>Prix/m</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={th}>Réf</th>
                      <th style={th}>Nom</th>
                      <th style={{ ...th, textAlign: 'right' }}>Seuil</th>
                      <th style={{ ...th, textAlign: 'right' }}>Qty</th>
                      <th style={{ ...th, textAlign: 'right' }}>Prix HT</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {parseResult.items.slice(0, 50).map((it, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                      {isCable ? (
                        <>
                          <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{it.ref_touret}</td>
                          <td style={td}>
                            <div style={{ fontWeight: 700 }}>{it.nom_type}</div>
                            {it.ref_type && <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>EAN : {it.ref_type}</div>}
                          </td>
                          <td style={td}>{it.categorie === 'fibre' ? '🟢 Fibre' : '🟠 Cuivre'}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.longueur}m</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.prix_ht ? it.prix_ht.toFixed(2) + ' €' : '—'}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{it.ref}</td>
                          <td style={td}>{it.nom}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.seuil}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.qty}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{it.prix_ht ? it.prix_ht.toFixed(2) + ' €' : '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {parseResult.items.length > 50 && (
                    <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--ink-4)', fontStyle: 'italic' }}>
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
                {importing ? 'Import en cours...' : `✓ Importer ${parseResult.items.length} ${isCable ? 'touret(s)' : 'article(s)'}`}
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
              {isCable ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--blue)' }}>
                    <span style={{ fontWeight: 700 }}>🔌 Types de câbles créés</span>
                    <span className="mono" style={{ fontWeight: 800 }}>{report.typesCreated}</span>
                  </div>
                  {report.typesUpdated > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--blue)' }}>
                      <span style={{ fontWeight: 700 }}>📝 EAN ajoutés à des types existants</span>
                      <span className="mono" style={{ fontWeight: 800 }}>{report.typesUpdated}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--green)' }}>
                    <span style={{ fontWeight: 700 }}>✓ Tourets créés</span>
                    <span className="mono" style={{ fontWeight: 800 }}>{report.touretsInserted}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', color: 'var(--green)' }}>
                  <span style={{ fontWeight: 700 }}>✓ Articles créés</span>
                  <span className="mono" style={{ fontWeight: 800 }}>{report.inserted}</span>
                </div>
              )}
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

// ===== MODAL TRANSFERT TOURET =====
function TransferModal({ touret, cable, currentService, currentMagasin, userId, onClose, onDone, toast }) {
  const [magasins, setMagasins] = useState([]);
  const [destService, setDestService] = useState('');
  const [destMagasin, setDestMagasin] = useState('');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMagasins().then((r) => setMagasins((r.data || []).filter((m) => m.actif !== false)));
  }, []);

  // Magasins disponibles pour le service de destination
  const availableMagasins = useMemo(() => {
    if (!destService) return [];
    return magasins.filter((m) =>
      (m.magasins_services || []).some((ms) => ms.service_id === destService)
    );
  }, [magasins, destService]);

  // Reset magasin si plus disponible pour le service choisi
  useEffect(() => {
    if (destMagasin && !availableMagasins.find((m) => m.id === destMagasin)) {
      setDestMagasin('');
    }
  }, [availableMagasins, destMagasin]);

  const isSameScope = destService === currentService && destMagasin === currentMagasin;

  async function submit() {
    if (!destService || !destMagasin) return toast('Sélectionnez un service et un magasin', 'error');
    if (isSameScope) return toast('Choisissez un périmètre différent', 'error');
    setSubmitting(true);
    const res = await transferTouret({
      touretId: touret.id,
      destService,
      destMagasin,
      motif,
      userId,
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={(e) => e.stopPropagation()} style={modalPanel}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            🔄 Transférer un touret
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
            <span className="mono">{touret.ref_touret}</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, margin: '4px 0 0' }}>
            {cable?.nom} · <span className="mono">{touret.restante} m</span> restant
          </p>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={fieldLabelTransfer}>Service de destination</label>
            <select value={destService} onChange={(e) => setDestService(e.target.value)} style={selectStyle}>
              <option value="">— Choisir un service —</option>
              {SERVICES_REF.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabelTransfer}>Magasin de destination</label>
            <select value={destMagasin} onChange={(e) => setDestMagasin(e.target.value)} style={selectStyle} disabled={!destService}>
              <option value="">— Choisir un magasin —</option>
              {availableMagasins.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
            {destService && availableMagasins.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, marginTop: 4 }}>
                Aucun magasin disponible pour ce service.
              </div>
            )}
          </div>

          <div>
            <label style={fieldLabelTransfer}>Motif (optionnel)</label>
            <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex: Réaffectation chantier" style={inputStyle} />
          </div>

          {isSameScope && (
            <div style={{ padding: 10, background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700 }}>
              ⚠ Le périmètre choisi est identique au périmètre actuel.
            </div>
          )}

          {destService && destMagasin && !isSameScope && (
            <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600 }}>
              💡 Si aucun type de câble correspondant n'existe en destination, il sera créé automatiquement (nom + catégorie identiques).
            </div>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={submitting || !destService || !destMagasin || isSameScope} style={{ flex: 1 }}>
            {submitting ? '...' : '🔄 Transférer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== MODAL FORMAT ÉTIQUETTES =====
function LabelFormatModal({ tourets, cable, scopeInfo, title, onClose, toast }) {
  const [format, setFormat] = useState('medium');
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const magasinInfo = getMagasinInfo(scopeInfo?.magasin);
      const data = tourets.map((t) => ({
        ref_touret: t.ref_touret,
        initiale: t.initiale,
        restante: t.restante,
        nom_cable: cable?.nom || '',
        categorie: cable?.categorie || '',
        ref_type: cable?.ref_type || '',
        emplacement: t.emplacement || '',
        magasin: magasinInfo?.nom || '',
      }));
      const doc = await generateTouretLabels(data, { format, title });
      downloadPdf(doc, `etiquettes-tourets-${Date.now()}.pdf`);
      toast(`✓ PDF généré (${tourets.length} étiquette${tourets.length > 1 ? 's' : ''})`, 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('Erreur génération PDF : ' + err.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={(e) => e.stopPropagation()} style={modalPanel}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            🖨 Générer les étiquettes PDF
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            {tourets.length} étiquette{tourets.length > 1 ? 's' : ''} à imprimer
          </h2>
        </div>

        <div style={{ padding: 20 }}>
          <label style={fieldLabelTransfer}>Format des étiquettes</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(LABEL_FORMATS).map((f) => {
              const active = format === f.id;
              const pages = Math.ceil(tourets.length / f.perPage);
              return (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  style={{
                    padding: '14px 16px',
                    background: active ? 'var(--orange-light)' : 'white',
                    border: `1.5px solid ${active ? 'var(--orange)' : 'var(--line)'}`,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: active ? 'var(--orange-dark)' : 'var(--ink)' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                      {tourets.length} étiquette{tourets.length > 1 ? 's' : ''} → {pages} page{pages > 1 ? 's' : ''} A4
                    </div>
                  </div>
                  {active && <span style={{ fontSize: 18, color: 'var(--orange)' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={generate} disabled={generating} style={{ flex: 1 }}>
            {generating ? '...' : '🖨 Générer PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  animation: 'fade-in 0.18s ease-out',
};
const modalPanel = {
  background: 'white',
  borderRadius: 'var(--radius-lg)',
  width: '100%',
  maxWidth: 500,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
};
const fieldLabelTransfer = { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '10px 14px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
