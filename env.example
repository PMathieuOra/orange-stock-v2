import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SERVICES_REF, getServiceInfo } from '../lib/supabase';
import { Denied, PageLoader, Empty, Badge, Button } from '../components/ui';
import {
  fetchMagasins, fetchMagasinStats, slugify,
  createMagasin, updateMagasin, toggleMagasinActif, deleteMagasin,
} from '../hooks/useMagasins';

export default function Magasins() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState('list');  // list | detail | form
  const [magasins, setMagasins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailStats, setDetailStats] = useState(null);
  const [form, setForm] = useState(null);

  const loadMagasins = useCallback(async () => {
    setLoading(true);
    const res = await fetchMagasins();
    setMagasins(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadMagasins(); }, [loadMagasins]);

  // Load stats when detail opens
  useEffect(() => {
    if (view === 'detail' && detail) {
      setDetailStats(null);
      fetchMagasinStats(detail.id).then(setDetailStats);
    }
  }, [view, detail]);

  if (!isAdmin) {
    return <Layout brandTitle="Magasins" brandSub="Administration"><Denied /></Layout>;
  }

  // ===== FORM =====
  if (view === 'form' && form) {
    return (
      <MagasinForm
        mode={form.mode}
        data={form.data}
        existingIds={magasins.map((m) => m.id)}
        onCancel={() => { setView(detail ? 'detail' : 'list'); setForm(null); }}
        onDone={async () => {
          setForm(null);
          await loadMagasins();
          if (form.mode === 'create') setView('list');
          else if (detail) {
            const fresh = await fetchMagasins();
            const updated = (fresh.data || []).find((m) => m.id === detail.id);
            setDetail(updated || null);
            setView(updated ? 'detail' : 'list');
          } else setView('list');
        }}
        toast={toast}
      />
    );
  }

  // ===== DETAIL =====
  if (view === 'detail' && detail) {
    const detailServices = (detail.magasins_services || []).map((s) => s.service_id);

    return (
      <Layout brandTitle="Magasin" brandSub="Administration">
        <div style={{ padding: '16px 20px' }}>
          <button onClick={() => { setView('list'); setDetail(null); }} style={backBtn}>← Magasins</button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, margin: '16px 0' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #00A86B, #34D399)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🏠</div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{detail.nom}</h1>
                <div className="mono" style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>{detail.id}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <Badge color={detail.actif ? 'green' : 'red'}>{detail.actif ? '✓ Actif' : '○ Désactivé'}</Badge>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => { setForm({ mode: 'edit', data: detail }); setView('form'); }}>✏️ Modifier</Button>
              <Button variant="secondary" onClick={async () => {
                const res = await toggleMagasinActif(detail.id, !detail.actif);
                if (res.ok) { toast(detail.actif ? '🔒 Désactivé' : '✓ Réactivé'); setDetail({ ...detail, actif: !detail.actif }); loadMagasins(); }
                else toast('Erreur : ' + res.error, 'error');
              }}>{detail.actif ? '🔒 Désactiver' : '🔓 Réactiver'}</Button>
              <Button variant="danger" onClick={async () => {
                if (!confirm(`Supprimer définitivement "${detail.nom}" ?\nCette action est irréversible.`)) return;
                const res = await deleteMagasin(detail.id);
                if (res.ok) { toast(`🗑️ ${detail.nom} supprimé`); setView('list'); setDetail(null); loadMagasins(); }
                else toast(res.error, 'error');
              }}>🗑️ Supprimer</Button>
            </div>
          </div>

          {/* Services hébergés */}
          <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
              Services hébergés ({detailServices.length})
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {detailServices.length === 0 ? <span style={{ color: 'var(--ink-4)', fontSize: 13, fontWeight: 600 }}>Aucun service rattaché</span> : detailServices.map((s) => {
                const svc = getServiceInfo(s);
                return <Badge key={s} color="gray">{svc.icon} {svc.nom}</Badge>;
              })}
            </div>
          </div>

          {/* Stats */}
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
            Activité dans ce magasin
          </div>
          {detailStats === null ? <PageLoader /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard icon="👥" label="Utilisateurs" value={detailStats.nbUsers} color="var(--blue)" />
              <StatCard icon="📦" label="Consommables" value={detailStats.nbConso} color="var(--orange)" />
              <StatCard icon="🔌" label="Types de câble" value={detailStats.nbCables} color="var(--blue)" />
              <StatCard icon="🎰" label="Tourets" value={detailStats.nbTourets} color="var(--purple)" />
              <StatCard icon="📋" label="Commandes" value={detailStats.nbCommandes} color="var(--green)" />
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ===== LIST =====
  return (
    <Layout brandTitle="Magasins" brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={() => navigate('/admin')} style={backBtn}>← Administration</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, margin: '12px 0 4px' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Magasins</h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{magasins.length} site(s) de stockage</p>
          </div>
          <Button onClick={() => { setForm({ mode: 'create', data: null }); setView('form'); }}>+ Nouveau magasin</Button>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? <PageLoader /> : magasins.length === 0 ? <Empty icon="🏪" text="Aucun magasin" sub="Créez un magasin pour démarrer." /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {magasins.map((m) => {
                const services = (m.magasins_services || []).map((s) => s.service_id);
                return (
                  <button key={m.id} onClick={() => { setDetail(m); setView('detail'); }} style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18, opacity: m.actif ? 1 : 0.6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #00A86B, #34D399)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏠</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>{m.nom}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>{m.id}</div>
                      </div>
                      <Badge color={m.actif ? 'green' : 'red'}>{m.actif ? '✓' : '○'}</Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                      {services.length === 0 ? (
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, fontStyle: 'italic' }}>Aucun service rattaché</span>
                      ) : services.map((s) => {
                        const svc = getServiceInfo(s);
                        return <Badge key={s} color="gray">{svc.icon}</Badge>;
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ===== FORM =====
function MagasinForm({ mode, data, existingIds, onCancel, onDone, toast }) {
  const isEdit = mode === 'edit';
  const [nom, setNom] = useState(isEdit ? data.nom : '');
  const [id, setId] = useState(isEdit ? data.id : '');
  const [idTouched, setIdTouched] = useState(false);
  const [services, setServices] = useState(isEdit ? (data.magasins_services || []).map((s) => s.service_id) : []);
  const [saving, setSaving] = useState(false);

  // Auto-slugify nom → id en création
  useEffect(() => {
    if (!isEdit && !idTouched) {
      setId(slugify(nom));
    }
  }, [nom, isEdit, idTouched]);

  function toggleService(sid) {
    setServices((s) => s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid]);
  }

  async function submit() {
    if (!nom.trim()) return toast('Nom requis', 'error');
    if (!isEdit) {
      if (!id || !/^[a-z0-9_]+$/.test(id)) return toast('Identifiant invalide (lettres min, chiffres, _ seulement)', 'error');
      if (existingIds.includes(id)) return toast('Cet identifiant existe déjà', 'error');
    }

    setSaving(true);
    if (isEdit) {
      const res = await updateMagasin(data.id, { nom, services });
      setSaving(false);
      if (res.ok) { toast(`✓ ${nom} mis à jour`, 'success'); onDone(); }
      else toast('Erreur : ' + res.error, 'error');
    } else {
      const res = await createMagasin({ id, nom, services });
      setSaving(false);
      if (res.ok) { toast(`✓ ${nom} créé`, 'success'); onDone(); }
      else toast('Erreur : ' + res.error, 'error');
    }
  }

  return (
    <Layout brandTitle={isEdit ? 'Modifier' : 'Nouveau'} brandSub="Magasin">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={onCancel} style={backBtn}>← Retour</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 20px' }}>
          {isEdit ? `Modifier ${data.nom}` : 'Nouveau magasin'}
        </h1>

        <Field label="Nom du magasin" required>
          <input value={nom} onChange={(e) => setNom(e.target.value)} style={input} placeholder="Troyes, Châlons..." autoCapitalize="words" />
        </Field>

        <Field label="Identifiant technique" required>
          <input
            value={id}
            onChange={(e) => { setId(e.target.value); setIdTouched(true); }}
            disabled={isEdit}
            className="mono"
            style={{ ...input, background: isEdit ? 'var(--bg)' : 'white' }}
            placeholder="troyes, chalons..."
          />
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontWeight: 600 }}>
            {isEdit ? "L'identifiant ne peut pas être modifié." : 'Auto-généré depuis le nom. Modifiable si besoin. Lettres min, chiffres, _ seulement.'}
          </div>
        </Field>

        <Field label={`Services hébergés (${services.length}/${SERVICES_REF.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SERVICES_REF.map((s) => (
              <CheckRow key={s.id} checked={services.includes(s.id)} onClick={() => toggleService(s.id)}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ flex: 1, fontWeight: 700 }}>{s.nom}</span>
              </CheckRow>
            ))}
          </div>
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

function CheckRow({ checked, onClick, children }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: checked ? 'var(--orange-light)' : 'white', border: `1.5px solid ${checked ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', color: checked ? 'var(--orange-dark)' : 'var(--ink)', textAlign: 'left', width: '100%' }}>
      <span style={{ width: 20, height: 20, borderRadius: 5, background: checked ? 'var(--orange)' : 'white', border: `2px solid ${checked ? 'var(--orange)' : 'var(--line)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
        {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </span>
      {children}
    </button>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)' }}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
