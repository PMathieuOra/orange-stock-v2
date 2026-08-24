import { useState, useEffect, useCallback } from 'react';
import { Button, Badge, PageLoader, Empty } from './ui';
import { initials, displayName } from '../lib/helpers';
import {
  fetchEquipes, createEquipe, updateEquipe, deleteEquipe,
  setUserEquipe, EQUIPE_COULEURS,
} from '../hooks/useEquipes';

// Modale principale : liste des équipes + accès création/édition/membres.
// allUsers vient de la page Utilisateurs ; onChanged prévient le parent pour recharger.
export default function EquipesManager({ allUsers, onClose, onChanged, toast }) {
  const [equipes, setEquipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);       // {mode, data}
  const [membersOf, setMembersOf] = useState(null); // équipe

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchEquipes();
    setEquipes(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(eq) {
    if (!confirm(`Supprimer l'équipe "${eq.nom}" ?\n\nLes ${eq.nbMembres} membre(s) ne seront pas supprimés, ils passeront simplement "sans équipe".`)) return;
    const res = await deleteEquipe(eq.id);
    if (res.ok) { toast('🗑️ Équipe supprimée'); load(); onChanged && onChanged(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalPanel, maxWidth: 640 }}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>👥 Gérer les équipes</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, margin: '4px 0 0' }}>
              Créez des équipes et affectez-y vos utilisateurs.
            </p>
          </div>
          <Button onClick={() => setForm({ mode: 'create' })} style={{ padding: '8px 14px', fontSize: 13, flexShrink: 0 }}>+ Nouvelle</Button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {loading ? (
            <PageLoader />
          ) : equipes.length === 0 ? (
            <Empty icon="👥" text="Aucune équipe" sub="Créez votre première équipe pour organiser vos utilisateurs." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {equipes.map((eq) => {
                const membres = (allUsers || []).filter((u) => u.equipe_id === eq.id);
                return (
                  <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', border: '1.5px solid var(--line)', borderLeft: `4px solid ${eq.couleur || '#FF7900'}`, borderRadius: 'var(--radius)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: eq.couleur || '#FF7900', flexShrink: 0 }} />
                        <span style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={eq.nom}>{eq.nom}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2 }}>
                        {membres.length} membre{membres.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    {/* Avatars condensés */}
                    <div style={{ display: 'flex', marginRight: 4 }}>
                      {membres.slice(0, 4).map((m, i) => (
                        <div key={m.id} className={m.avatar_couleur || 'c-orange'} title={displayName(m)} style={{ ...avatarSm, marginLeft: i === 0 ? 0 : -8, border: '2px solid white' }}>
                          {initials(m.prenom, m.nom_initiale)}
                        </div>
                      ))}
                      {membres.length > 4 && (
                        <div style={{ ...avatarSm, marginLeft: -8, border: '2px solid white', background: 'var(--ink-4)' }}>+{membres.length - 4}</div>
                      )}
                    </div>
                    <button onClick={() => setMembersOf(eq)} style={smallBtn}>Membres</button>
                    <button onClick={() => setForm({ mode: 'edit', data: eq })} title="Modifier" style={iconBtn}>✏️</button>
                    <button onClick={() => handleDelete(eq)} title="Supprimer" style={{ ...iconBtn, background: 'var(--red-light)', color: 'var(--red)' }}>🗑</button>
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
        <EquipeForm
          mode={form.mode}
          data={form.data}
          onClose={() => setForm(null)}
          onDone={() => { setForm(null); load(); onChanged && onChanged(); }}
          toast={toast}
        />
      )}

      {membersOf && (
        <MembersModal
          equipe={membersOf}
          allUsers={allUsers}
          onClose={() => setMembersOf(null)}
          onDone={() => { load(); onChanged && onChanged(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ===== Formulaire création/édition équipe =====
function EquipeForm({ mode, data, onClose, onDone, toast }) {
  const isEdit = mode === 'edit';
  const [nom, setNom] = useState(isEdit ? data.nom : '');
  const [couleur, setCouleur] = useState(isEdit ? (data.couleur || '#FF7900') : EQUIPE_COULEURS[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nom.trim()) return toast('Nom requis', 'error');
    setSaving(true);
    const res = isEdit
      ? await updateEquipe(data.id, { nom, couleur })
      : await createEquipe({ nom, couleur });
    setSaving(false);
    if (res.ok) { toast(isEdit ? `✓ ${nom} mis à jour` : `✓ ${nom} créée`, 'success'); onDone(); }
    else toast('Erreur : ' + res.error, 'error');
  }

  return (
    <div onClick={onClose} style={{ ...modalBackdrop, zIndex: 110 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalPanel, maxWidth: 420 }}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{isEdit ? 'Modifier l\'équipe' : 'Nouvelle équipe'}</h2>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={fieldLabel}>Nom de l'équipe</label>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Équipe Nord, Techniciens fibre..." autoFocus style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Couleur</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EQUIPE_COULEURS.map((c) => (
                <button key={c} type="button" onClick={() => setCouleur(c)} style={{
                  width: 36, height: 36, borderRadius: '50%', background: c,
                  border: couleur === c ? '3px solid var(--ink)' : '3px solid transparent',
                  cursor: 'pointer', outline: couleur === c ? '2px solid ' + c : 'none',
                }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Annuler</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? '...' : isEdit ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </div>
    </div>
  );
}

// ===== Modal de gestion des membres d'une équipe =====
function MembersModal({ equipe, allUsers, onClose, onDone, toast }) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);
  const [localUsers, setLocalUsers] = useState(allUsers);

  const membres = localUsers.filter((u) => u.equipe_id === equipe.id);
  const nonMembres = localUsers.filter((u) => u.equipe_id !== equipe.id);
  const filteredNonMembres = search.trim()
    ? nonMembres.filter((u) => displayName(u).toLowerCase().includes(search.toLowerCase().trim()))
    : nonMembres;

  async function assign(user, join) {
    setSaving(user.id);
    const res = await setUserEquipe(user.id, join ? equipe.id : null);
    setSaving(null);
    if (res.ok) {
      setLocalUsers((us) => us.map((u) => u.id === user.id ? { ...u, equipe_id: join ? equipe.id : null } : u));
      toast(join ? `✓ ${user.prenom} ajouté à ${equipe.nom}` : `× ${user.prenom} retiré`, 'success');
      onDone();
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  }

  return (
    <div onClick={onClose} style={{ ...modalBackdrop, zIndex: 110 }}>
      <div onClick={(e) => e.stopPropagation()} style={modalPanel}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: equipe.couleur || '#FF7900' }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{equipe.nom}</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 600, margin: '4px 0 0' }}>
            {membres.length} membre{membres.length > 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {membres.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={sectionLabel}>Membres de l'équipe</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {membres.map((m) => (
                  <div key={m.id} style={memberRow}>
                    <div className={m.avatar_couleur || 'c-orange'} style={avatarSm}>{initials(m.prenom, m.nom_initiale)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{displayName(m)}</div>
                      {m.role === 'admin' && <Badge color="orange">Admin</Badge>}
                    </div>
                    <button onClick={() => assign(m, false)} disabled={saving === m.id} style={{ ...smallBtn, background: 'var(--red-light)', color: 'var(--red)' }}>
                      {saving === m.id ? '...' : '× Retirer'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={sectionLabel}>Ajouter des utilisateurs</div>
          <input placeholder="🔍 Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          {filteredNonMembres.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
              {search ? 'Aucun utilisateur trouvé' : 'Tous les utilisateurs sont déjà dans une équipe'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredNonMembres.map((u) => (
                <div key={u.id} style={memberRow}>
                  <div className={u.avatar_couleur || 'c-orange'} style={avatarSm}>{initials(u.prenom, u.nom_initiale)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{displayName(u)}</div>
                    {u.equipe_id && u.equipes && (
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>Actuellement : {u.equipes.nom}</div>
                    )}
                  </div>
                  <button onClick={() => assign(u, true)} disabled={saving === u.id} style={{ ...smallBtn, background: 'var(--orange-light)', color: 'var(--orange-dark)' }}>
                    {saving === u.id ? '...' : '+ Ajouter'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
          <Button onClick={onClose} style={{ width: '100%' }}>Terminé</Button>
        </div>
      </div>
    </div>
  );
}

const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fade-in 0.18s ease-out' };
const modalPanel = { background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' };
const sectionLabel = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-4)', marginBottom: 8 };
const inputStyle = { width: '100%', padding: '10px 14px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, outline: 'none' };
const memberRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' };
const avatarSm = { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 };
const smallBtn = { border: 'none', borderRadius: '100px', padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, background: 'var(--bg)', color: 'var(--ink)' };
const iconBtn = { background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 };
