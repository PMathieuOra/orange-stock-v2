import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStock } from '../hooks/useStock';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { PageLoader, Empty, Badge, Button } from '../components/ui';
import { validateSortie, fetchTouretsForRef } from '../hooks/useSortie';
import { touretStatus } from '../lib/helpers';

export default function Sortie() {
  const { items, loading, error, refetch } = useStock();
  const { toast } = useToast();
  const { user } = useAuth();
  const { service, magasin } = useSession();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState('');
  const [validating, setValidating] = useState(false);
  const [catFilter, setCatFilter] = useState('all'); // 'all' | 'conso' | 'fibre' | 'cuivre'

  // Sélecteur de touret (quand on clique sur un câble)
  const [touretPicker, setTouretPicker] = useState(null); // {item, tourets, loading}

  // Normaliser la catégorie pour comparaisons robustes
  const norm = (s) => String(s || '').toLowerCase().trim();

  // Helper : vrai si l'item correspond au filtre catégorie
  function matchCategory(it, filter) {
    if (filter === 'all') return true;
    if (filter === 'conso') return it.type === 'conso';
    if (filter === 'fibre') return it.type === 'cable' && norm(it.categorie) === 'fibre';
    if (filter === 'cuivre') return it.type === 'cable' && norm(it.categorie) === 'cuivre';
    return true;
  }

  const filtered = useMemo(() => items.filter((it) => {
    if (!it.actif) return false;
    if (it.qty <= 0) return false;
    if (!matchCategory(it, catFilter)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const refStr = String(it.ref || '');
    const nomStr = String(it.nom || '');
    if ((refStr + ' ' + nomStr).toLowerCase().includes(q)) return true;
    // Pour les câbles : chercher aussi dans les noms de tourets
    if (it.type === 'cable' && Array.isArray(it.tourets)) {
      return it.tourets.some((t) => String(t.ref_touret || '').toLowerCase().includes(q));
    }
    return false;
  }), [items, catFilter, search]);

  // Compteurs : uniquement les articles actifs avec stock
  const counts = useMemo(() => {
    const dispo = items.filter((it) => it.actif && it.qty > 0);
    return {
      all: dispo.length,
      conso: dispo.filter((it) => it.type === 'conso').length,
      fibre: dispo.filter((it) => it.type === 'cable' && norm(it.categorie) === 'fibre').length,
      cuivre: dispo.filter((it) => it.type === 'cable' && norm(it.categorie) === 'cuivre').length,
    };
  }, [items]);

  async function handleAddClick(item) {
    if (item.type === 'conso') {
      addConsoToCart(item);
    } else {
      // Câble : ouvrir le sélecteur de touret (utilise l'ID qui est toujours présent)
      setTouretPicker({ item, tourets: [], loading: true });
      const res = await fetchTouretsForRef(item.id, service, magasin);
      if (!res.ok) {
        toast(res.error, 'error');
        setTouretPicker(null);
        return;
      }
      if (res.tourets.length === 0) {
        toast('Aucun touret disponible avec du stock', 'error');
        setTouretPicker(null);
        return;
      }
      setTouretPicker({ item, tourets: res.tourets, loading: false });
    }
  }

  function addConsoToCart(item) {
    setCart((c) => {
      const existing = c.find((x) => x.ref === item.ref && x.type === 'conso');
      if (existing) {
        const newQty = Math.min(existing.qty + 1, item.qty);
        if (newQty === existing.qty) {
          toast(`Stock max atteint (${item.qty})`, 'error');
          return c;
        }
        return c.map((x) => (x === existing ? { ...x, qty: newQty } : x));
      }
      return [...c, { ref: item.ref, nom: item.nom, type: 'conso', qty: 1, qtyDispo: item.qty }];
    });
  }

  function addCableToCart(item, touret, qty) {
    const q = parseInt(qty) || 0;
    if (q <= 0) return toast('Quantité invalide', 'error');
    if (q > touret.restante) return toast(`Maximum disponible : ${touret.restante}m`, 'error');

    setCart((c) => {
      // Vérifier si ce touret est déjà au panier
      const existing = c.find((x) => x.type === 'cable' && x.touretId === touret.id);
      if (existing) {
        const newQty = existing.qty + q;
        if (newQty > touret.restante) {
          toast(`Total dépasserait le stock du touret (${touret.restante}m)`, 'error');
          return c;
        }
        return c.map((x) => (x === existing ? { ...x, qty: newQty } : x));
      }
      return [...c, {
        ref: item.ref,
        nom: item.nom,
        type: 'cable',
        qty: q,
        qtyDispo: touret.restante,
        touretId: touret.id,
        touretRef: touret.ref_touret,
      }];
    });
    setTouretPicker(null);
    toast(`✓ ${q}m de ${touret.ref_touret} ajoutés`);
  }

  function setCartQty(idx, qty) {
    setCart((c) => c.map((x, i) => {
      if (i !== idx) return x;
      const newQty = Math.max(0, Math.min(qty, x.qtyDispo));
      return { ...x, qty: newQty };
    }).filter((x) => x.qty > 0));
  }

  function removeFromCart(idx) {
    setCart((c) => c.filter((_, i) => i !== idx));
  }

  function clearCart() {
    setCart([]);
    setNote('');
  }

  async function handleValidate() {
    if (cart.length === 0) return;
    setValidating(true);
    const res = await validateSortie({
      cart,
      service,
      magasin,
      userId: user.id,
      note: note.trim(),
    });
    setValidating(false);
    if (res.ok) {
      toast(`✓ Sortie validée : ${cart.length} ligne(s)`, 'success');
      clearCart();
      setCartOpen(false);
      refetch();
    } else {
      toast(res.error, 'error');
    }
  }

  const totalItems = cart.reduce((s, x) => s + x.qty, 0);

  return (
    <Layout brandTitle="Sortie" brandSub="Stock">
      <div style={{ padding: '16px 20px', maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Sortie de stock</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>
          Sélectionnez les articles à sortir.
        </p>

        <input
          placeholder="🔍 Rechercher par référence, nom ou n° de touret..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', border: '1.5px solid var(--line)', borderRadius: '100px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 12 }}
        />

        {/* Filtres par catégorie */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }} className="no-scrollbar">
          {[
            { id: 'all', label: 'Tous', count: counts.all, color: 'var(--ink)' },
            { id: 'conso', label: '📦 Conso', count: counts.conso, color: 'var(--orange)' },
            { id: 'fibre', label: '🟢 Fibre', count: counts.fibre, color: 'var(--green)' },
            { id: 'cuivre', label: '🟠 Cuivre', count: counts.cuivre, color: '#D97706' },
          ].map((f) => {
            const active = catFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setCatFilter(f.id)}
                style={{
                  background: active ? f.color : 'white',
                  color: active ? 'white' : 'var(--ink-3)',
                  border: `1.5px solid ${active ? f.color : 'var(--line)'}`,
                  borderRadius: '100px',
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {f.label}
                <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg)', color: active ? 'white' : 'var(--ink-4)', padding: '1px 7px', borderRadius: '100px', fontSize: 11, fontWeight: 800 }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: 16, background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontWeight: 600, marginBottom: 16 }}>
            Erreur : {error}.
          </div>
        )}

        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <Empty icon="🔍" text={search ? 'Aucun résultat' : 'Aucun article disponible'} sub={search ? 'Essayez un autre terme.' : 'Tous les articles sont en rupture ou désactivés.'} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 8,
            paddingBottom: cart.length > 0 ? 120 : 20,
          }}>
            {filtered.map((it) => {
              const inCartLines = cart.filter((c) => c.ref === it.ref && c.type === it.type);
              const inCartTotal = inCartLines.reduce((s, x) => s + x.qty, 0);
              // Badge catégorie visible
              let catBadge = null;
              if (it.type === 'conso') catBadge = { label: 'CONSO', color: '#FF7900', bg: '#FFF5EB' };
              else if (norm(it.categorie) === 'fibre') catBadge = { label: 'FIBRE', color: '#00A86B', bg: '#E8F7F0' };
              else if (norm(it.categorie) === 'cuivre') catBadge = { label: 'CUIVRE', color: '#D97706', bg: '#FEF6E7' };
              return (
                <div key={`${it.type}-${it.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '1.5px solid ' + (inCartTotal > 0 ? 'var(--orange)' : 'var(--line)'), borderRadius: 'var(--radius)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      {catBadge && <span style={{
                        background: catBadge.bg,
                        color: catBadge.color,
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        letterSpacing: '0.05em',
                      }}>{catBadge.label}</span>}
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nom}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono">{it.ref}</span>
                      <span>·</span>
                      <span>{it.qty} {it.type === 'cable' ? 'm' : 'u.'}</span>
                      {it.type === 'cable' && <span>· {it.nb_tourets} touret(s)</span>}
                      {it.type === 'conso' && it.emplacement && (
                        <span style={{ color: 'var(--orange)', fontWeight: 700 }}>· 📍 {it.emplacement}</span>
                      )}
                      {it.est_critique && <Badge color="red">⚠ Critique</Badge>}
                      {inCartTotal > 0 && <Badge color="orange">🛒 {inCartTotal}{it.type === 'cable' ? 'm' : ''} dans le panier</Badge>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddClick(it)}
                    style={{
                      background: it.type === 'cable' ? 'var(--blue)' : 'var(--orange)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '100px',
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.type === 'cable' ? '🔌 Choisir' : '+ Ajouter'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sélecteur de touret */}
      {touretPicker && (
        <TouretPicker
          item={touretPicker.item}
          tourets={touretPicker.tourets}
          loading={touretPicker.loading}
          onClose={() => setTouretPicker(null)}
          onAdd={(touret, qty) => addCableToCart(touretPicker.item, touret, qty)}
        />
      )}

      {/* Cart sticky bar */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: 440, background: 'var(--ink)', color: 'white', borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-lg)', zIndex: 30, border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            🛒 {cart.length} ligne{cart.length > 1 ? 's' : ''}
          </span>
          <span style={{ background: 'var(--orange)', color: 'white', padding: '6px 14px', borderRadius: '100px', fontWeight: 700, fontSize: 13 }}>
            Voir le panier →
          </span>
        </button>
      )}

      {/* Cart fullscreen modal */}
      {cartOpen && (
        <CartModal
          cart={cart}
          note={note}
          setNote={setNote}
          onClose={() => setCartOpen(false)}
          onSetQty={setCartQty}
          onRemove={removeFromCart}
          onClear={clearCart}
          onValidate={handleValidate}
          validating={validating}
        />
      )}
    </Layout>
  );
}

// ===== TOURET PICKER =====
function TouretPicker({ item, tourets, loading, onClose, onAdd }) {
  const [selectedId, setSelectedId] = useState(null);
  const [qty, setQty] = useState('');

  const selected = tourets.find((t) => t.id === selectedId);

  function handleAdd() {
    if (!selected) return;
    onAdd(selected, parseInt(qty) || 0);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', width: '100%', maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column', animation: 'slide-up 0.25s cubic-bezier(0.2,0,0,1)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>🔌 Choisir un touret</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>{item.nom}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>{item.ref}</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '100px', background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {loading ? <PageLoader /> : tourets.length === 0 ? (
            <Empty icon="🎰" text="Aucun touret disponible" />
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
                Tourets disponibles ({tourets.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tourets.map((t) => {
                  const status = touretStatus(t);
                  const isSelected = selectedId === t.id;
                  const statusColors = { neuf: 'green', entame: 'amber', vide: 'red' };
                  const statusLabels = { neuf: '🆕 Neuf', entame: '🔄 Entamé', vide: '⚠ Vide' };
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedId(t.id); setQty(''); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        background: isSelected ? 'var(--orange-light)' : 'white',
                        border: `1.5px solid ${isSelected ? 'var(--orange)' : 'var(--line)'}`,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{t.ref_touret}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span>Initial : {t.initiale}m</span>
                          {t.emplacement && (
                            <>
                              <span>·</span>
                              <span style={{ color: 'var(--orange-dark)', fontWeight: 700 }}>📍 {t.emplacement}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: isSelected ? 'var(--orange-dark)' : 'var(--ink)' }}>{t.restante}m</div>
                        {status !== 'neuf' && <Badge color={statusColors[status]}>{statusLabels[status]}</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div style={{ marginTop: 18, padding: 16, background: 'var(--orange-light)', border: '1.5px solid var(--orange)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--orange-dark)', marginBottom: 8 }}>
                    Touret sélectionné : <span className="mono">{selected.ref_touret}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min="1"
                      max={selected.restante}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder={`Quantité en mètres (max ${selected.restante})`}
                      autoFocus
                      style={{ flex: 1, padding: 12, border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, outline: 'none' }}
                    />
                    <Button onClick={handleAdd} disabled={!qty || parseInt(qty) <= 0}>+ Ajouter</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== CART MODAL =====
function CartModal({ cart, note, setNote, onClose, onSetQty, onRemove, onClear, onValidate, validating }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slide-up 0.25s cubic-bezier(0.2,0,0,1)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>🛒 Panier</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{cart.length} ligne{cart.length > 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '100px', background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {cart.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.nom}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>
                  {item.ref}
                  {item.type === 'cable' && ` · 🎰 ${item.touretRef}`}
                  {' · dispo : '}{item.qtyDispo}{item.type === 'cable' ? 'm' : 'u.'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => onSetQty(idx, item.qty - 1)} style={qtyBtn}>−</button>
                <input
                  type="number"
                  min="1"
                  max={item.qtyDispo}
                  value={item.qty}
                  onChange={(e) => onSetQty(idx, parseInt(e.target.value) || 0)}
                  style={{ width: 56, padding: '6px 4px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center', fontSize: 14 }}
                />
                <button onClick={() => onSetQty(idx, item.qty + 1)} style={qtyBtn} disabled={item.qty >= item.qtyDispo}>+</button>
              </div>
              <button onClick={() => onRemove(idx)} style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>🗑</button>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6 }}>Note (optionnelle)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Intervention chez M. Dupont, contrat 12345..."
              rows={2}
              style={{ width: '100%', padding: 10, border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, resize: 'vertical', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: 'var(--bg)' }}>
          <Button variant="secondary" onClick={onClear} disabled={validating} style={{ flex: 1 }}>Vider</Button>
          <Button onClick={onValidate} disabled={validating || cart.length === 0} style={{ flex: 2 }}>
            {validating ? 'Validation...' : `✓ Valider la sortie`}
          </Button>
        </div>
      </div>
    </div>
  );
}

const qtyBtn = { width: 30, height: 30, borderRadius: '100px', background: 'var(--bg)', border: '1.5px solid var(--line)', cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit' };
