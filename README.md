# 🍊 Orange Stock V2 — Application React

Application de gestion de stock multi-services / multi-magasins.
**React + Vite + Tailwind + Supabase.**

---

## 🚀 Démarrage rapide

### 1. Prérequis
- Node.js ≥ 18
- Un projet Supabase configuré (voir le dossier `sql/`)

### 2. Installation
```bash
npm install
```

### 3. Configuration Supabase
```bash
cp .env.example .env
```
Puis éditer `.env` avec vos clés (Supabase Dashboard → Project Settings → API) :
```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### 4. Lancer en développement
```bash
npm run dev
```
→ Ouvre http://localhost:5173

### 5. Build de production
```bash
npm run build
npm run preview
```

---

## 🔑 Connexion

| Identifiant (démo) | Rôle | Particularité |
|--------------------|------|---------------|
| `mathieu p` | Admin | Multi-service + multi-magasin (setup complet) |
| `julien b` | User | Changement de mot de passe forcé |
| `pierre m` | User | Mono-service / mono-magasin (setup sauté) |

Mot de passe initial : **`0000`**

> La saisie de l'identifiant est tolérante : `mathieu p`, `Mathieu P`, `MATHIEU_P` fonctionnent tous.

---

## 📁 Structure

```
src/
├── lib/
│   ├── supabase.js       # Client Supabase + référentiel services
│   └── helpers.js        # Utilitaires (dates, initiales, normalisation...)
├── contexts/
│   ├── AuthContext.jsx   # Authentification (login, bcrypt, session)
│   ├── SessionContext.jsx# Service + magasin actifs
│   └── ToastContext.jsx  # Notifications
├── hooks/
│   └── useStock.js       # Récupération du stock filtré par scope
├── components/
│   ├── Layout.jsx        # Header + navigation responsive
│   ├── SessionSelectors.jsx # Pastilles service/magasin
│   └── ui/index.jsx      # Kit UI (Button, Card, Badge, Spinner...)
├── pages/
│   ├── Login.jsx         # ✅ Complet (3 étapes)
│   ├── Sortie.jsx        # ✅ Câblé (liste + panier)
│   ├── Stock.jsx         # ✅ Câblé (onglets + critiques)
│   ├── Stats.jsx         # ✅ Câblé (KPI + top + journal)
│   ├── Admin.jsx         # ✅ Hub
│   ├── Commandes.jsx     # 🟡 Câblé (liste) — CRUD à enrichir
│   ├── Articles.jsx      # 🟡 Câblé (liste) — CRUD à enrichir
│   ├── Utilisateurs.jsx  # 🟡 Câblé (liste) — CRUD à enrichir
│   └── Magasins.jsx      # 🟡 Câblé (liste) — CRUD à enrichir
├── App.jsx               # Routing + protection des routes
└── main.jsx              # Point d'entrée
```

**Légende :** ✅ fonctionnel · 🟡 squelette câblé sur Supabase (lecture OK, écriture à enrichir)

---

## 🧩 Architecture technique

### Authentification
- **Pas de Supabase Auth** : table `users` maison + `bcryptjs` côté client
- Session stockée dans `sessionStorage`
- Identifiant `prenom_initiale` (ex `mathieu_p`)

### Filtrage par périmètre
Toutes les données sont filtrées par le couple **(service, magasin)** actif, stocké dans `SessionContext`. Le changement de périmètre via les pastilles du header rafraîchit automatiquement les pages (via les hooks `useStock` / `useScopedTable`).

### Style
Reprend les design tokens des prototypes HTML (couleurs Orange, police Manrope, rayons, ombres). Variables CSS dans `src/styles/index.css` + config Tailwind.

---

## 🔜 Pour enrichir les pages 🟡

Chaque page admin charge déjà ses données depuis Supabase. Pour les rendre complètes, il reste à ajouter les **actions d'écriture** :

- **Commandes** : création (`generer_numero_commande` RPC), édition lignes, réception partielle → `insert/update` sur `commandes` + `commande_lignes` + log dans `mouvements`
- **Articles** : CRUD `articles_conso` / `types_cable`, gestion tourets, import Excel
- **Utilisateurs** : création avec `generer_identifiant` RPC, hash bcrypt du MDP `0000`
- **Magasins** : CRUD `magasins` + `magasins_services`
- **Sortie** : valider le panier = décrémenter le stock + insérer dans `mouvements`

Le pattern est en place partout (hooks, contextes, UI kit), il suffit de suivre le modèle des pages ✅.

---

## 📦 Dépendances clés
- `@supabase/supabase-js` — client BDD
- `react-router-dom` — navigation
- `bcryptjs` — hash mot de passe
- `vite` + `@vitejs/plugin-react` — build
- `tailwindcss` — styles
