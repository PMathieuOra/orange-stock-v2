import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { getServiceInfo } from '../lib/supabase';
import { getMagasinInfo } from '../components/SessionSelectors';
import { initials } from '../lib/helpers';
import { Spinner } from '../components/ui';

export default function Login() {
  const { login, changePassword, completeLogin } = useAuth();
  const { setScope } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState('login'); // 'login' | 'changePwd' | 'setup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // login fields
  const [ident, setIdent] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // pending user (between steps)
  const [pendingUser, setPendingUser] = useState(null);

  // change pwd fields
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // setup fields
  const [selService, setSelService] = useState(null);
  const [selMagasin, setSelMagasin] = useState(null);

  async function handleLogin() {
    setError('');
    if (!ident.trim()) return setError('Identifiant requis');
    if (!pwd || pwd.length < 4) return setError('Mot de passe trop court');
    setLoading(true);
    const res = await login(ident, pwd);
    setLoading(false);
    if (!res.ok) return setError(res.error);

    setPendingUser(res.user);
    if (res.mustChangePwd) {
      setStep('changePwd');
    } else {
      goToSetupOrFinish(res.user);
    }
  }

  async function handleChangePwd() {
    setError('');
    if (newPwd.length < 8) return setError('Min. 8 caractères');
    if (!/\d/.test(newPwd)) return setError('Doit contenir un chiffre');
    if (!/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd)) return setError('Maj + min requises');
    if (newPwd !== confirmPwd) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    const res = await changePassword(pendingUser.id, newPwd);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    toast('✓ Mot de passe mis à jour', 'success');
    goToSetupOrFinish(pendingUser);
  }

  function goToSetupOrFinish(user) {
    const needService = user.services.length > 1;
    const needMagasin = user.magasins.length > 1;
    if (!needService && !needMagasin) {
      finish(user, user.services[0], user.magasins[0]);
      return;
    }
    setSelService(needService ? null : user.services[0]);
    setSelMagasin(needMagasin ? null : user.magasins[0]);
    setStep('setup');
  }

  function finish(user, svc, mag) {
    completeLogin(user);
    setScope(svc, mag);
    toast(`Bienvenue ${user.prenom} !`, 'success');
    navigate('/sortie');
  }

  function handleSetup() {
    if (!selService || !selMagasin) return toast('Choisissez un service et un magasin', 'error');
    finish(pendingUser, selService, selMagasin);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'linear-gradient(135deg, #FFB066 0%, #FF7900 50%, #E66E00 100%)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 28,
          boxShadow: '0 24px 80px rgba(255,121,0,0.25), 0 8px 24px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: 440,
          overflow: 'hidden',
          animation: 'slide-up 0.5s cubic-bezier(0.2,0,0,1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '36px 32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                background: 'var(--orange)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 12,
              }}
            >
              <span style={{ width: 28, height: 4, background: 'white', borderRadius: 1 }} />
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em' }}>Stock</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Réseaux · Orange
              </div>
            </div>
          </div>
          {step === 'login' && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Connexion</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>Identifiez-vous pour accéder à votre stock.</p>
            </>
          )}
          {step === 'changePwd' && (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Nouveau mot de passe</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>Première connexion : choisissez un mot de passe sécurisé.</p>
            </>
          )}
          {step === 'setup' && pendingUser && (
            <>
              <div
                className={pendingUser.avatar_couleur || 'c-orange'}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '100px',
                  margin: '0 auto 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 28,
                  color: 'white',
                }}
              >
                {initials(pendingUser.prenom, pendingUser.nom_initiale)}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
                Bonjour {pendingUser.prenom} 👋
              </h1>
              <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>Choisissez vos préférences de session.</p>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '8px 32px 32px' }}>
          {error && (
            <div
              style={{
                background: 'var(--red-light)',
                border: '1.5px solid #FFC8CE',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--red)',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {step === 'login' && (
            <>
              <Field label="Identifiant">
                <input
                  className="login-input mono"
                  placeholder="mathieu p, pierre m..."
                  value={ident}
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => setIdent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </Field>
              <Field label="Mot de passe">
                <div style={{ position: 'relative' }}>
                  <input
                    className="login-input"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Votre mot de passe"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    style={{ paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 12, fontWeight: 700 }}
                  >
                    {showPwd ? 'Cacher' : 'Voir'}
                  </button>
                </div>
              </Field>
              <button className="login-btn" onClick={handleLogin} disabled={loading}>
                {loading ? <Spinner size={18} /> : 'Se connecter →'}
              </button>
            </>
          )}

          {step === 'changePwd' && (
            <>
              <Field label="Nouveau mot de passe">
                <input className="login-input" type="password" placeholder="Min. 8 caractères, 1 chiffre, maj+min" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              </Field>
              <Field label="Confirmer">
                <input
                  className="login-input"
                  type="password"
                  placeholder="Retapez le mot de passe"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePwd()}
                />
              </Field>
              <button className="login-btn" onClick={handleChangePwd} disabled={loading}>
                {loading ? <Spinner size={18} /> : 'Mettre à jour →'}
              </button>
            </>
          )}

          {step === 'setup' && pendingUser && (
            <>
              {pendingUser.services.length > 1 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                    Service
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {pendingUser.services.map((id) => (
                      <ChoiceCard key={id} info={getServiceInfo(id)} selected={selService === id} onClick={() => setSelService(id)} />
                    ))}
                  </div>
                </div>
              )}
              {pendingUser.magasins.length > 1 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                    Magasin
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {pendingUser.magasins.map((id) => (
                      <ChoiceCard key={id} info={getMagasinInfo(id)} selected={selMagasin === id} onClick={() => setSelMagasin(id)} />
                    ))}
                  </div>
                </div>
              )}
              <button className="login-btn" onClick={handleSetup} disabled={!selService || !selMagasin}>
                Continuer →
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .login-input {
          width: 100%;
          padding: 16px;
          border: 1.5px solid var(--line);
          border-radius: var(--radius);
          background: var(--bg);
          font-family: inherit;
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          outline: none;
          transition: all 0.15s;
        }
        .login-input:focus {
          border-color: var(--orange);
          background: white;
          box-shadow: 0 0 0 4px var(--orange-glow);
        }
        .login-btn {
          width: 100%;
          background: var(--orange);
          color: white;
          border: none;
          border-radius: var(--radius);
          padding: 16px;
          font-family: inherit;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: var(--shadow-orange);
          transition: all 0.15s;
        }
        .login-btn:hover:not(:disabled) { background: var(--orange-dark); }
        .login-btn:disabled { background: var(--line); color: var(--ink-4); cursor: not-allowed; box-shadow: none; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ChoiceCard({ info, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? 'var(--orange-light)' : 'white',
        border: `1.5px solid ${selected ? 'var(--orange)' : 'var(--line)'}`,
        borderRadius: 'var(--radius)',
        padding: '14px 12px',
        cursor: 'pointer',
        textAlign: 'center',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        boxShadow: selected ? '0 0 0 3px var(--orange-glow)' : 'none',
      }}
    >
      <div style={{ fontSize: 24 }}>{info.icon}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{info.nom}</div>
    </button>
  );
}
