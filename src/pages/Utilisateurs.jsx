import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SERVICES_REF, getServiceInfo } from '../lib/supabase';
import { getMagasinInfo as getStaticMagasinInfo } from '../components/SessionSelectors';
import { Denied, PageLoader, Empty, Badge, Button } from '../components/ui';
import { initials, displayName } from '../lib/helpers';
import {
  fetchUsers, createUser, updateUser, toggleUserActif, resetPassword, deleteUser,
} from '../hooks/useUsers';
import { fetchMagasins } from '../hooks/useMagasins';
import { fetchEquipes } from '../hooks/useEquipes';
import EquipesManager from '../components/EquipesManager';

export default function Utilisateurs() {
  const { isAdmin, user: currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [view, setView] = useState('list'); // list | detail | form
  const [users, setUsers] = useState([]);
  const [magasins, setMagasins] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | actif | inactif
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null); // {mode, data}
  const [manageEquipes, setManageEquipes] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const [usersRes, magsRes, eqRes] = await Promise.all([
      fetchUsers(),
      fetchMagasins(),
      fetchEquipes(),
    ]);
    setUsers(usersRes.data);
    setMagasins((magsRes.data || []).filter((m) => m.actif !== false));
    setEquipes(eqRes.data || []);
    setLoading(false);
  }, []);

  // Helper : info magasin (dynamique par ID)
  const getMagasinInfo = useCallback((id) => {
    const found = magasins.find((m) => m.id === id);
    if (found) return { id: found.id, nom: found.nom, icon: found.icon || '🏪' };
    return getStaticMagasinInfo(id);
  }, [magasins]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  if (!isAdmin) {
    return <Layout brandTitle="Utilisateurs" brandSub="Administration"><Denied /></Layout>;
  }

  // ===== FORM =====
  if (view === 'form' && form) {
    return (
      <UserForm
        mode={form.mode}
        data={form.data}
        allUsers={users}
        availableMagasins={magasins}
        availableEquipes={equipes}
        onCancel={() => { setView(detail ? 'detail' : 'list'); setForm(null); }}
        onDone={async () => {
          setForm(null);
          await loadUsers();
          if (form.mode === 'create') setView('list');
          else if (detail) {
            // Refresh detail with new data
            const fresh = await fetchUsers();
            const updated = (fresh.data || []).find((u) => u.id === detail.id);
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
    const isCurrentUser = currentUser?.id === detail.id;
    const userServices = (detail.users_services || []).map((s) => s.service_id);
    const userMagasins = (detail.users_magasins || []).map((m) => m.magasin_id);

    return (
      <Layout brandTitle="Utilisateur" brandSub="Administration">
        <div style={{ padding: '16px 20px' }}>
          <button onClick={() => { setView('list'); setDetail(null); }} style={backBtn}>← Utilisateurs</button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, margin: '16px 0' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span className={detail.avatar_couleur || 'c-orange'} style={{ width: 64, height: 64, borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 22 }}>
                {initials(detail.prenom, detail.nom_initiale)}
              </span>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{displayName(detail)}</h1>
                <div className="mono" style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>{detail.identifiant}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <Badge color={detail.role === 'admin' ? 'gray' : 'blue'}>{detail.role === 'admin' ? '👑 Admin' : '👤 Utilisateur'}</Badge>
                  <Badge color={detail.actif ? 'green' : 'red'}>{detail.actif ? '✓ Actif' : '○ Inactif'}</Badge>
                  {detail.must_change_pwd && <Badge color="amber">🔑 MDP à changer</Badge>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => { setForm({ mode: 'edit', data: detail }); setView('form'); }}>✏️ Modifier</Button>
              <Button variant="secondary" onClick={async () => {
                if (!confirm(`Réinitialiser le mot de passe de ${detail.prenom} à "0000" ?\nIl devra le changer à sa prochaine connexion.`)) return;
                const res = await resetPassword(detail.id);
                if (res.ok) { toast(`✓ MDP réinitialisé à "0000"`, 'success'); loadUsers(); }
                else toast('Erreur : ' + res.error, 'error');
              }}>🔑 Reset MDP</Button>
              {!isCurrentUser && (
                <>
                  <Button variant="secondary" onClick={async () => {
                    const res = await toggleUserActif(detail.id, !detail.actif);
                    if (res.ok) { toast(detail.actif ? '🔒 Désactivé' : '✓ Réactivé'); setDetail({ ...detail, actif: !detail.actif }); loadUsers(); }
                    else toast('Erreur : ' + res.error, 'error');
                  }}>{detail.actif ? '🔒 Désactiver' : '🔓 Réactiver'}</Button>
                  <Button variant="danger" onClick={async () => {
                    if (!confirm(`Supprimer définitivement ${detail.prenom} ?\nCette action est irréversible.`)) return;
                    const res = await deleteUser(detail.id);
                    if (res.ok) { toast('🗑️ Utilisateur supprimé'); setView('list'); setDetail(null); loadUsers(); }
                    else toast('Erreur : ' + res.error, 'error');
                  }}>🗑️ Supprimer</Button>
                </>
              )}
            </div>
          </div>

          {isCurrentUser && (
            <div style={{ padding: 12, background: 'var(--blue-light)', border: '1.5px solid #C8D8FF', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>
              ℹ️ C'est votre compte. Vous ne pouvez ni vous désactiver ni vous supprimer vous-même.
            </div>
          )}

          <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>Services autorisés ({userServices.length})</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {userServices.length === 0 ? <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Aucun service</span> : userServices.map((s) => {
                const svc = getServiceInfo(s);
                return <Badge key={s} color="gray">{svc.icon} {svc.nom}</Badge>;
              })}
            </div>
          </div>

          <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>Magasins autorisés ({userMagasins.length})</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {userMagasins.length === 0 ? <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Aucun magasin</span> : userMagasins.map((m) => {
                const mag = getMagasinInfo(m);
                return <Badge key={m} color="green">{mag.icon} {mag.nom}</Badge>;
              })}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ===== LIST =====
  const filtered = users.filter((u) => {
    if (filter === 'actif' && !u.actif) return false;
    if (filter === 'inactif' && u.actif) return false;
    if (search) {
      const q = search.toLowerCase();
      const txt = (u.prenom + ' ' + u.nom_initiale + ' ' + u.identifiant).toLowerCase();
      if (!txt.includes(q)) return false;
    }
    return true;
  });

  return (
    <Layout brandTitle="Utilisateurs" brandSub="Administration">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={() => navigate('/admin')} style={backBtn}>← Administration</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, margin: '12px 0 4px' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Utilisateurs</h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{users.length} compte(s) au total</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setManageEquipes(true)}>👥 Gérer les équipes</Button>
            <Button onClick={() => { setForm({ mode: 'create', data: null }); setView('form'); }}>+ Nouvel utilisateur</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
          <input placeholder="🔍 Rechercher (prénom, identifiant...)" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, padding: '10px 14px', border: '1.5px solid var(--line)', borderRadius: '100px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, outline: 'none' }} />
          {[['all', 'Tous'], ['actif', '✓ Actifs'], ['inactif', '○ Inactifs']].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{ background: filter === id ? 'var(--ink)' : 'white', color: filter === id ? 'white' : 'var(--ink-3)', border: '1.5px solid ' + (filter === id ? 'var(--ink)' : 'var(--line)'), borderRadius: '100px', padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
          ))}
        </div>

        {loading ? <PageLoader /> : filtered.length === 0 ? <Empty icon="👥" text="Aucun utilisateur" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((u) => {
              const nbSvc = (u.users_services || []).length;
              const nbMag = (u.users_magasins || []).length;
              return (
                <button key={u.id} onClick={() => { setDetail(u); setView('detail'); }} style={{ ...card, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', opacity: u.actif ? 1 : 0.5 }}>
                  <span className={u.avatar_couleur || 'c-orange'} style={{ width: 44, height: 44, borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {initials(u.prenom, u.nom_initiale)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {displayName(u)}
                      {u.role === 'admin' && <Badge color="gray">Admin</Badge>}
                      {!u.actif && <Badge color="red">Inactif</Badge>}
                      {u.must_change_pwd && <Badge color="amber">🔑</Badge>}
                      {u.equipes && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '100px',
                          background: (u.equipes.couleur || '#FF7900') + '18',
                          color: u.equipes.couleur || '#FF7900',
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.equipes.couleur || '#FF7900' }} />
                          {u.equipes.nom}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                      <span className="mono">{u.identifiant}</span> · {nbSvc} service{nbSvc > 1 ? 's' : ''} · {nbMag} magasin{nbMag > 1 ? 's' : ''}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {manageEquipes && (
        <EquipesManager
          allUsers={users}
          onClose={() => setManageEquipes(false)}
          onChanged={loadUsers}
          toast={toast}
        />
      )}
    </Layout>
  );
}

// ===== USER FORM =====
function UserForm({ mode, data, allUsers, availableMagasins = [], availableEquipes = [], onCancel, onDone, toast }) {
  const isEdit = mode === 'edit';
  const [prenom, setPrenom] = useState(isEdit ? data.prenom : '');
  const [initiale, setInitiale] = useState(isEdit ? data.nom_initiale : '');
  const [role, setRole] = useState(isEdit ? data.role : 'user');
  const [services, setServices] = useState(isEdit ? (data.users_services || []).map((s) => s.service_id) : []);
  const [magasins, setMagasins] = useState(isEdit ? (data.users_magasins || []).map((m) => m.magasin_id) : []);
  const [equipeId, setEquipeId] = useState(isEdit ? (data.equipe_id || '') : '');
  const [saving, setSaving] = useState(false);

  function toggleService(id) {
    setServices((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function toggleMagasin(id) {
    setMagasins((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);
  }

  async function submit() {
    if (!prenom.trim()) return toast('Prénom requis', 'error');
    if (!initiale.trim()) return toast('Initiale du nom requise', 'error');
    if (initiale.trim().length > 1) return toast('Une seule lettre pour l\'initiale', 'error');
    if (services.length === 0) return toast('Au moins un service requis', 'error');
    if (magasins.length === 0) return toast('Au moins un magasin requis', 'error');

    setSaving(true);
    if (isEdit) {
      const res = await updateUser(data.id, { prenom, initiale, role, services, magasins, equipeId: equipeId || null });
      setSaving(false);
      if (res.ok) { toast(`✓ ${prenom} mis à jour`, 'success'); onDone(); }
      else toast('Erreur : ' + res.error, 'error');
    } else {
      const res = await createUser({ prenom, initiale, role, services, magasins, equipeId: equipeId || null, allUsers });
      setSaving(false);
      if (res.ok) {
        toast(`✓ ${prenom} créé. Identifiant : ${res.identifiant}. MDP initial : 0000`, 'success');
        onDone();
      } else toast('Erreur : ' + res.error, 'error');
    }
  }

  return (
    <Layout brandTitle={isEdit ? 'Modifier' : 'Nouveau'} brandSub="Utilisateur">
      <div style={{ padding: '16px 20px' }}>
        <button onClick={onCancel} style={backBtn}>← Retour</button>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 4px' }}>
          {isEdit ? `Modifier ${data.prenom}` : 'Nouvel utilisateur'}
        </h1>
        {!isEdit && <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 20 }}>L'identifiant sera généré automatiquement (prénom_initiale). MDP initial : <strong>0000</strong></p>}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 16 }}>
          <Field label="Prénom" required>
            <input value={prenom} onChange={(e) => setPrenom(e.target.value)} style={input} placeholder="Mathieu" autoCapitalize="words" />
          </Field>
          <Field label="Initiale" required>
            <input value={initiale} onChange={(e) => setInitiale(e.target.value.slice(0, 1).toUpperCase())} maxLength={1} style={{ ...input, textAlign: 'center', textTransform: 'uppercase', fontWeight: 800 }} placeholder="P" />
          </Field>
        </div>

        {!isEdit && prenom && initiale && (
          <div style={{ padding: '10px 14px', background: 'var(--orange-light)', border: '1.5px dashed #FFD9B0', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--orange-dark)', fontWeight: 600, marginBottom: 16 }}>
            Identifiant qui sera créé : <span className="mono"><strong>{prenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')}_{initiale.toLowerCase()}</strong></span>
          </div>
        )}

        <Field label="Rôle" required>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['user', '👤 Utilisateur'], ['admin', '👑 Administrateur']].map(([id, lbl]) => (
              <button key={id} onClick={() => setRole(id)} style={{ flex: 1, padding: 12, background: role === id ? 'var(--orange-light)' : 'white', color: role === id ? 'var(--orange-dark)' : 'var(--ink)', border: `1.5px solid ${role === id ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 'var(--radius)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{lbl}</button>
            ))}
          </div>
        </Field>

        <Field label="Équipe">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              onClick={() => setEquipeId('')}
              style={{
                padding: '8px 14px',
                background: !equipeId ? 'var(--ink)' : 'white',
                color: !equipeId ? 'white' : 'var(--ink-3)',
                border: `1.5px solid ${!equipeId ? 'var(--ink)' : 'var(--line)'}`,
                borderRadius: '100px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >Sans équipe</button>
            {availableEquipes.map((eq) => {
              const active = equipeId === eq.id;
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => setEquipeId(eq.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: active ? (eq.couleur || '#FF7900') : 'white',
                    color: active ? 'white' : 'var(--ink-3)',
                    border: `1.5px solid ${active ? (eq.couleur || '#FF7900') : 'var(--line)'}`,
                    borderRadius: '100px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'white' : (eq.couleur || '#FF7900') }} />
                  {eq.nom}
                </button>
              );
            })}
          </div>
          {availableEquipes.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 6 }}>
              Aucune équipe créée. Rendez-vous dans Admin → Équipes pour en créer.
            </div>
          )}
        </Field>

        <Field label={`Services autorisés (${services.length}/${SERVICES_REF.length})`} required>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SERVICES_REF.map((s) => (
              <CheckRow key={s.id} checked={services.includes(s.id)} onClick={() => toggleService(s.id)}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ flex: 1, fontWeight: 700 }}>{s.nom}</span>
              </CheckRow>
            ))}
          </div>
        </Field>

        <Field label={`Magasins autorisés (${magasins.length}/${availableMagasins.length})`} required>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {availableMagasins.map((m) => (
              <CheckRow key={m.id} checked={magasins.includes(m.id)} onClick={() => toggleMagasin(m.id)}>
                <span style={{ fontSize: 18 }}>{m.icon || '🏪'}</span>
                <span style={{ flex: 1, fontWeight: 700 }}>{m.nom}</span>
              </CheckRow>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le compte'}</Button>
        </div>
      </div>
    </Layout>
  );
}

// ===== shared components =====
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
