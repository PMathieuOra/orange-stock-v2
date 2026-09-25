import { useState, useEffect, useCallback } from 'react';
import { Button, PageLoader, Empty } from './ui';
import {
  fetchPaniersTypes, createPanierType, updatePanierType, deletePanierType,
  fetchConsosForScope,
} from '../hooks/usePaniersTypes';
import { getServiceInfo } from '../lib/supabase';

// Modale de gestion des paniers types pour un couple (service, magasin) précis.
export default function PaniersTypesManager({ service, magasin, magasinNom, userId, onClose, toast }) {
  const [paniers, setPaniers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // {mode, data}
  const svcInfo = getServiceInfo(service);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPaniersTypes(service, magasin);
    setPaniers(res.data || []);
    setLoading(false);
  }, [service, magasin]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(p) {
    if (!confirm(`Supprimer le panier type "${p.nom}" ?`)) return;
    const res = await deletePanierType(p.id);
    if (res.ok) { toast('🗑️ Panier type supprimé'); load(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalPanel, maxWidth: 600 }}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🧺 Paniers types</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, margin: '4px 0 0' }}>
              <span style={{ color: svcInfo.couleur, fontWeight: 800 }}>{svcInfo.icon} {svcInfo.nom}</span>
              {' · '}{magasinNom || 'ce magasin'}
            </p>
          </div>
          <Button onClick={() => setForm({ mode: 'create' })} style={{ padding: '8px 14px', fontSize: 13, flexShrink: 0 }}>+ Nouveau</Button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {loading ? (
            <PageLoader />
          ) : paniers.length === 0 ? (
            <Empty icon="🧺" text="Aucun panier type" sub="Créez un modèle pour ce service et ce magasin." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paniers.map((p) => {
                const n = (p.paniers_types_lignes || []).length;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)' }}>
                    <span style={{ fontSize: 22 }}>🧺</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nom}>{p.nom}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>{n} article{n > 1 ? 's' : ''}</div>
                    </div>
                    <button onClick={() => setForm({ mode: 'edit', data: p })} title="Modifier" style={iconBtn}>✏️</button>
                    <button onClick={() => handleDelete(p)} title="Supprimer" style={{ ...iconBtn, background: 'var(--red-light)', color: 'var(--red)' }}>🗑</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
          <Button variant="secondary" onClick={onClose} style={{ width: '100%' }}>Fermer</Button>
        </div>
      </div>

      {form && (
        <PanierForm
          mode={form.mode}
          data={form.data}
          service={service}
          magasin={magasin}
          userId={userId}
          onClose={() => setForm(null)}
          onDone={() => { setForm(null); load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function PanierForm({ mode, data, service, magasin, userId, onClose, onDone, toast }) {
  const isEdit = mode === 'edit';
  const [nom, setNom] = useState(isEdit ? data.nom : '');
  const [selected, setSelected] = useState(isEdit ? (data.paniers_types_lignes || []).map((l) => ({ ref: l.ref, nom: l.nom })) : []);
  const [consos, setConsos] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConsosForScope(service, magasin).then((r) => { setConsos(r.data || []); setLoading(false); });
  }, [service, magasin]);

  const selectedRefs = new Set(selected.map((s) => s.ref));
  const filtered = search.trim()
    ? consos.filter((c) => (c.ref + ' ' + c.nom).toLowerCase().includes(search.toLowerCase().trim()))
    : consos;

  function toggle(c) {
    setSelected((cur) => cur.some((s) => s.ref === c.ref)
      ? cur.filter((s) => s.ref !== c.ref)
      : [...cur, { ref: c.ref, nom: c.nom }]);
  }

  async function submit() {
    if (!nom.trim()) return toast('Nom requis', 'error');
    if (selected.length === 0) return toast('Ajoutez au moins un article', 'error');
    setSaving(true);
    const res = isEdit
      ? await updatePanierType(data.id, { nom, lignes: selected })
      : await createPanierType({ nom, service, magasin, lignes: selected, userId });
    setSaving(false);
    if (res.ok) { toast(isEdit ? `✓ ${nom} mis à jour` : `✓ ${nom} créé`, 'success'); onDone(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div onClick={onClose} style={{ ...modalBackdrop, zIndex: 110 }}>
      <div onClick={(e) => e.stopPropagation()} style={modalPanel}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{isEdit ? 'Modifier le panier type' : 'Nouveau panier type'}</h2>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <label style={fieldLabel}>Nom du panier</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Intervention fibre, Kit raccordement..." autoFocus style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={fieldLabel}>Articles ({selected.length} sélectionné{selected.length > 1 ? 's' : ''})</label>
          <input placeholder="🔍 Rechercher un consommable..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />

          {loading ? <PageLoader /> : filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
              {search ? 'Aucun consommable trouvé' : 'Aucun consommable pour ce service et ce magasin'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
              {filtered.map((c) => {
                const on = selectedRefs.has(c.ref);
                return (
                  <button key={c.ref} onClick={() => toggle(c)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    background: on ? 'var(--orange-light)' : 'white',
                    border: `1.5px solid ${on ? 'var(--orange)' : 'var(--line)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${on ? 'var(--orange)' : 'var(--line)'}`,
                      background: on ? 'var(--orange)' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>{c.ref}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? '...' : isEdit ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </div>
    </div>
  );
}

const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fade-in 0.18s ease-out' };
const modalPanel = { background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '10px 14px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, outline: 'none' };
const iconBtn = { background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };
