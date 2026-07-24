import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { getServiceInfo, supabase } from '../lib/supabase';

const MAGASINS_REF = [
  { id: 'troyes', nom: 'Troyes', icon: '🏠' },
  { id: 'chalons', nom: 'Châlons', icon: '🏬' },
  { id: 'reims', nom: 'Reims', icon: '🏪' },
];

function getMagasinInfo(id) {
  return MAGASINS_REF.find((m) => m.id === id) || { id, nom: id, icon: '📍' };
}

function MagasinPill({ current, options, onSelect, beforeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const info = getMagasinInfo(current);
  const canSwitch = options.length > 1;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => canSwitch && setOpen((o) => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
        borderRadius: '100px', border: '1.5px solid var(--green)', background: 'var(--green-light)',
        color: 'var(--green)', fontSize: '13px', fontWeight: 700,
        cursor: canSwitch ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
        <span>{info.icon}</span><span>{info.nom}</span>
        {canSwitch && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>}
      </button>
      {open && canSwitch && (
        <div style={dropdownStyle}>
          <div style={dropdownHeader}>Changer de magasin</div>
          {options.map((id) => {
            const oInfo = getMagasinInfo(id);
            const active = id === current;
            return (
              <button key={id} onClick={() => {
                setOpen(false);
                if (id === current) return;
                if (beforeChange && beforeChange(id) === false) return;
                onSelect(id);
              }} style={{
                ...optionStyle,
                background: active ? 'var(--orange-light)' : 'transparent',
                color: active ? 'var(--orange-dark)' : 'var(--ink)',
              }}>
                <span style={{ fontSize: '16px' }}>{oInfo.icon}</span>
                <span style={{ flex: 1 }}>{oInfo.nom}</span>
                {active && checkIcon}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServicePill({ selected, options, onToggle, onSwitch, multi, beforeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const canSwitch = options.length > 1;
  const nbSelected = selected.length;

  let label, icon, color, bg;
  if (nbSelected === 1) {
    const info = getServiceInfo(selected[0]);
    label = info.nom;
    icon = info.icon;
    color = info.couleur;
    bg = info.couleur + '18';
  } else {
    const infos = selected.map((s) => getServiceInfo(s));
    label = `${nbSelected} services`;
    icon = infos.map((i) => i.icon).join(' ');
    color = 'var(--ink)';
    bg = 'var(--bg)';
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => canSwitch && setOpen((o) => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
        borderRadius: '100px', border: `1.5px solid ${color}`, background: bg, color: color,
        fontSize: '13px', fontWeight: 700, cursor: canSwitch ? 'pointer' : 'default',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
        <span>{icon}</span><span>{label}</span>
        {canSwitch && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>}
      </button>
      {open && canSwitch && (
        <div style={dropdownStyle}>
          <div style={dropdownHeader}>{multi ? 'Cochez les services à afficher' : 'Changer de service'}</div>
          {options.map((id) => {
            const oInfo = getServiceInfo(id);
            const active = selected.includes(id);
            const isLast = multi && active && nbSelected === 1;
            return (
              <button key={id} onClick={() => {
                if (isLast) return;
                if (beforeChange && beforeChange(id) === false) return;
                if (multi) onToggle(id);
                else { setOpen(false); if (!active) onSwitch(id); }
              }} disabled={isLast} title={isLast ? 'Au moins un service doit être sélectionné' : undefined} style={{
                ...optionStyle,
                background: active ? oInfo.couleur + '18' : 'transparent',
                color: active ? oInfo.couleur : 'var(--ink)',
                opacity: isLast ? 0.7 : 1,
                cursor: isLast ? 'not-allowed' : 'pointer',
              }}>
                {multi ? (
                  <span style={{
                    width: 18, height: 18,
                    border: `2px solid ${active ? oInfo.couleur : 'var(--line)'}`,
                    borderRadius: 4,
                    background: active ? oInfo.couleur : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </span>
                ) : null}
                <span style={{ fontSize: '16px' }}>{oInfo.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{oInfo.nom}</span>
                {!multi && active && checkIcon}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const dropdownStyle = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
  background: 'var(--white)', border: '1.5px solid var(--line)',
  borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
  padding: '6px', minWidth: '220px', zIndex: 100,
};
const dropdownHeader = {
  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--ink-4)', padding: '6px 10px',
};
const optionStyle = {
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
  padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', textAlign: 'left',
};
const checkIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

export default function SessionSelectors({ beforeServiceChange, beforeMagasinChange, allowMultiService = false }) {
  const { user } = useAuth();
  const { service, services, magasin, changeService, toggleService, changeMagasin } = useSession();
  const { toast } = useToast();
  const [magasinServices, setMagasinServices] = useState({}); // { magasinId: [service_ids] }

  // Charger la liste des services hébergés par chaque magasin de l'utilisateur
  useEffect(() => {
    if (!user || !user.magasins || user.magasins.length === 0) return;
    (async () => {
      const { data, error } = await supabase
        .from('magasins_services')
        .select('magasin_id, service_id')
        .in('magasin_id', user.magasins);
      if (error || !data) return;
      const map = {};
      data.forEach((row) => {
        if (!map[row.magasin_id]) map[row.magasin_id] = [];
        map[row.magasin_id].push(row.service_id);
      });
      setMagasinServices(map);
    })();
  }, [user]);

  // Services disponibles = intersection (droits user) ∩ (services hébergés dans le magasin actuel)
  const servicesInCurrentMagasin = magasinServices[magasin] || [];
  const availableServices = user
    ? user.services.filter((s) => servicesInCurrentMagasin.length === 0 || servicesInCurrentMagasin.includes(s))
    : [];

  // Auto-correct : si des services actifs ne sont plus disponibles dans ce magasin, on les retire
  useEffect(() => {
    if (availableServices.length === 0 || services.length === 0) return;
    const validSelection = services.filter((s) => availableServices.includes(s));
    if (validSelection.length !== services.length) {
      if (validSelection.length > 0) {
        // On garde ceux qui restent valides — passe par changeService pour reset propre
        // (services devient [validSelection[0]] ou plus si multi)
        const first = validSelection[0];
        changeService(first);
        // Ajouter les autres services valides restants (si multi)
        validSelection.slice(1).forEach((s) => toggleService(s));
      } else {
        // Aucun service actif dispo → prendre le premier disponible
        changeService(availableServices[0]);
      }
    }
  }, [magasin, availableServices, services, changeService, toggleService]);

  if (!user || !service || !magasin) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <ServicePill
        selected={services}
        options={availableServices.length > 0 ? availableServices : user.services}
        multi={allowMultiService}
        beforeChange={beforeServiceChange}
        onToggle={(id) => {
          const isRemoving = services.includes(id);
          toggleService(id);
          const info = getServiceInfo(id);
          toast(`${isRemoving ? '× Retrait' : '✓ Ajout'} : ${info.icon} ${info.nom}`, 'success');
        }}
        onSwitch={(id) => {
          changeService(id);
          toast(`Service : ${getServiceInfo(id).icon} ${getServiceInfo(id).nom}`, 'success');
        }}
      />
      <MagasinPill
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
