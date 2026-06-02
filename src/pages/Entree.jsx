import { useState } from 'react';
import Layout from '../components/Layout';
import { useStock } from '../hooks/useStock';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useSession } from '../contexts/SessionContext';
import { PageLoader, Empty, Badge, Button } from '../components/ui';
import { validateEntree } from '../hooks/useEntree';

export default function Entree() {
  const { items, loading, error, refetch } = useStock();
  const { toast } = useToast();
  const { user } = useAuth();
  const { service, magasin } = useSession();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  // Uniquement les consommables actifs (pas les câbles)
  const filtered = items.filter((it) => {
    if (it.type !== 'conso') return false;
    if (!it.actif) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (it.ref + ' ' + it.nom).toLowerCase().includes(q);
  });

  function addToCart(item) {
    setCart((c) => {
      const existing = c.find((x) => x.ref === item.ref);
      if (existing) {
        return c.map((x) => (x === existing ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...c, { ref: item.ref, nom: item.nom, qty: 1, qtyDispo: item.qty }];
    });
  }

  function setCartQty(ref, qty) {
    setCart((c) => c.map((x) => {
      if (x.ref !== ref) return x;
      const newQty = Math.max(0, qty);
      return { ...x, qty: newQty };
    }).filter((x) => x.qty > 0));
  }

  function removeFromCart(ref) {
    setCart((c) => c.filter((x) => x.ref !== ref));
  }

  function clearCart() {
    setCart([]);
  }

  async function handleValidate() {
    if (cart.length === 0) return;
    setValidating(true);
    const res = await validateEntree({
      cart,
      service,
      magasin,
      userId: user.id,
    });
    setValidating(false);
    if (res.ok) {
      toast(`✓ Entrée validée : ${cart.length} ligne(s)`, 'success');
      clearCart();
      setCartOpen(false);
      refetch();
    } else {
      toast(res.error, 'error');
    }
  }

  const totalItems = cart.reduce((s, x) => s + x.qty, 0);

  return (
    <Layout brandTitle="Entrée" brandSub="Stock">
      <div style={{ padding: '16px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Retour de matériel</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>
          Réintégrez au stock le matériel non utilisé par le technicien.
        </p>

        <input
          placeholder="🔍 Rechercher un article..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1.5px solid var(--line)',
            borderRadius: '100px',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            outline: 'none',
            marginBottom: 16,
          }}
        />

        {error && (
          <div style={{ padding: 16, background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius)', fontWeight: 600, marginBottom: 16 }}>
            Erreur de chargement : {error}.
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <Empty
            icon="📥"
            text={search ? 'Aucun résultat' : 'Aucun consommable dans ce périmètre'}
            sub={search ? 'Essayez un autre terme.' : 'Créez des articles depuis la page Admin → Articles.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: cart.length > 0 ? 120 : 20 }}>
            {filtered.map((it) => {
              const inCart = cart.find((c) => c.ref === it.ref);
              return (
                <div
                  key={`conso-${it.ref}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'white',
                    border: '1.5px solid ' + (inCart ? 'var(--green)' : 'var(--line)'),
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{it.nom}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                      <span className="mono">{it.ref}</span>
                      <span>·</span>
                      <span>Stock actuel : {it.qty} u.</span>
                      {inCart && <Badge color="green">📥 +{inCart.qty} à rentrer</Badge>}
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(it)}
                    style={{
                      background: inCart ? 'var(--green-light)' : 'var(--green)',
                      color: inCart ? 'var(--green)' : 'white',
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
                    {inCart ? '+ 1' : '+ Rentrer'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart sticky bar */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 40px)',
            maxWidth: 440,
            background: 'var(--ink)',
            color: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 30,
            border: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            📥 {totalItems} unité{totalItems > 1 ? 's' : ''} ({cart.length} ligne{cart.length > 1 ? 's' : ''})
          </span>
          <span style={{ background: 'var(--green)', color: 'white', padding: '6px 14px', borderRadius: '100px', fontWeight: 700, fontSize: 13 }}>
            Voir le retour →
          </span>
        </button>
      )}

      {/* Cart fullscreen modal */}
      {cartOpen && (
        <CartModal
          cart={cart}
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

// ===== CART MODAL =====
function CartModal({ cart, onClose, onSetQty, onRemove, onClear, onValidate, validating }) {
  const totalItems = cart.reduce((s, x) => s + x.qty, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slide-up 0.25s cubic-bezier(0.2,0,0,1)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>📥 Retour au stock</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{totalItems} unité{totalItems > 1 ? 's' : ''} · {cart.length} ligne{cart.length > 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '100px', background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>

        {/* Lines */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {cart.map((item) => (
            <div key={item.ref} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.nom}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>{item.ref} · stock actuel : {item.qtyDispo} u.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => onSetQty(item.ref, item.qty - 1)} style={qtyBtn}>−</button>
                <input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(e) => onSetQty(item.ref, parseInt(e.target.value) || 0)}
                  style={{ width: 56, padding: '6px 4px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center', fontSize: 14 }}
                />
                <button onClick={() => onSetQty(item.ref, item.qty + 1)} style={qtyBtn}>+</button>
              </div>
              <button onClick={() => onRemove(item.ref)} style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: '100px', width: 32, height: 32, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>🗑</button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: 'var(--bg)' }}>
          <Button variant="secondary" onClick={onClear} disabled={validating} style={{ flex: 1 }}>Vider</Button>
          <Button onClick={onValidate} disabled={validating || cart.length === 0} style={{ flex: 2 }}>
            {validating ? 'Validation...' : `✓ Valider l'entrée (${totalItems})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

const qtyBtn = {
  width: 30,
  height: 30,
  borderRadius: '100px',
  background: 'var(--bg)',
  border: '1.5px solid var(--line)',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 14,
  fontFamily: 'inherit',
};
