import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { getServiceInfo } from '../lib/supabase';

// Magasins ref (mirror of magasins table — could be fetched, kept static for simplicity)
const MAGASINS_REF = [
  { id: 'troyes', nom: 'Troyes', icon: '🏠' },
  { id: 'chalons', nom: 'Châlons', icon: '🏬' },
  { id: 'reims', nom: 'Reims', icon: '🏪' },
];

function getMagasinInfo(id) {
  return MAGASINS_REF.find((m) => m.id === id) || { id, nom: id, icon: '📍' };
}

function Pill({ kind, current, options, onSelect, beforeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const info = kind === 'svc' ? getServiceInfo(current) : getMagasinInfo(current);
  const canSwitch = options.length > 1;
  const color = kind === 'svc' ? getServiceInfo(current).couleur : 'var(--green)';

  function handleSelect(id) {
    setOpen(false);
    if (id === current) return;
    if (beforeChange && beforeChange(id) === false) return;
    onSelect(id);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => canSwitch && setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '100px',
          border: `1.5px solid ${color}`,
          background: kind === 'svc' ? getServiceInfo(current).couleur + '18' : 'var(--green-light)',
          color: kind === 'svc' ? getServiceInfo(current).couleur : 'var(--green)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: canSwitch ? 'pointer' : 'default',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{info.icon}</span>
        <span>{info.nom}</span>
        {canSwitch && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {open && canSwitch && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--white)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            padding: '6px',
            minWidth: '180px',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-4)', padding: '6px 10px' }}>
            {kind === 'svc' ? 'Changer de service' : 'Changer de magasin'}
          </div>
          {options.map((id) => {
            const oInfo = kind === 'svc' ? getServiceInfo(id) : getMagasinInfo(id);
            const active = id === current;
            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: active ? 'var(--orange-light)' : 'transparent',
                  color: active ? 'var(--orange-dark)' : 'var(--ink)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '16px' }}>{oInfo.icon}</span>
                <span style={{ flex: 1 }}>{oInfo.nom}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SessionSelectors({ beforeServiceChange, beforeMagasinChange }) {
  const { user } = useAuth();
  const { service, magasin, changeService, changeMagasin } = useSession();
  const { toast } = useToast();

  if (!user || !service || !magasin) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Pill
        kind="svc"
        current={service}
        options={user.services}
        beforeChange={beforeServiceChange}
        onSelect={(id) => {
          changeService(id);
          toast(`Service : ${getServiceInfo(id).icon} ${getServiceInfo(id).nom}`, 'success');
        }}
      />
      <Pill
        kind="mag"
        current={magasin}
        options={user.magasins}
        beforeChange={beforeMagasinChange}
        onSelect={(id) => {
          changeMagasin(id);
          toast(`Magasin : ${getMagasinInfo(id).nom}`, 'success');
        }}
      />
    </div>
  );
}

export { MAGASINS_REF, getMagasinInfo };
