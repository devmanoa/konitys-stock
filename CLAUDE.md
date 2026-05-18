## 🔐 OBLIGATOIRE — Système de permissions Konitys (auto-bootstrap + auto-maintenance)

**Cette section définit un comportement AUTOMATIQUE que tu DOIS appliquer à chaque session, sans attendre une demande explicite du développeur.** Le référentiel complet est dans `docs/PERMISSIONS_APP_INTEGRATION.md` (ou `docs/PERMISSIONS_APP_INTEGRATION.md` si tu es lancé à la racine du monorepo).

> **App key canonique pour cette app : `stock`** — utiliser dans `schema.app = "stock"`, sur `data-app-key="stock"` côté header fédéré, et comme `APP_KEY=stock` côté backend.
>
> **Périmètre de ce CLAUDE.md** : frontend `client-stock/` (React + Vite). Le backend a son propre `CLAUDE.md` dans `server/`.

### Routine 1 — Au démarrage de CHAQUE session (obligatoire, silencieux si rien à faire)

**AVANT** de traiter la demande de l'utilisateur, exécute ces checks dans l'ordre :

1. **Vérifier l'état du câblage côté frontend** :
   - Le SDK `konitys-perms.js` est-il chargé (via `konitys-header.js` ou tag direct dans `index.html`) ?
   - Y a-t-il au moins un attribut `data-perm="stock:..."` dans les composants `.tsx` ?
   - Les pages sensibles ont-elles un guard `if (!__KONITYS_PERMS.has('pages.X.view'))` au mount ?

2. **Décision** :
   - Si les checks passent → setup OK, passe à la Routine 3 silencieusement.
   - Si un check échoue → **setup manquant ou incomplet**, exécute le BOOTSTRAP (Routine 2) avant de répondre à la demande de l'utilisateur. Informe-le à la fin de ce que tu as ajouté.

### Routine 2 — Bootstrap (uniquement si Routine 1 détecte un manque)

1. Lis intégralement `docs/PERMISSIONS_APP_INTEGRATION.md` (cherche-le d'abord à la racine du repo, sinon dans `docs/`, sinon dans `../docs/`).
2. Applique le contenu de la section « Prompt à coller tel quel à votre instance Claude Code » du document, pour la partie frontend :
   - **Découverte** : liste toutes les pages/routes frontend (`src/App.tsx`), tous les boutons d'action (`create/edit/delete/archive/submit`), tous les menus.
   - **Gating frontend** : pour chaque action sensible, ajoute `data-perm="stock:<key>"` sur le DOM, OU appelle `window.__KONITYS_PERMS.has('<key>')` dans la logique de rendu conditionnel React.
   - **Guards de page** : dans `App.tsx` (ou un composant `<ProtectedRoute>`), ajoute `if (!__KONITYS_PERMS.has('pages.<page>.view')) navigate('/403')` au mount.
   - **Page 403 standardisée** : créer une route `/403` qui consomme le thème synced depuis le gateway (voir doc point 3bis). Logique redirect :
     * compte n'a pas `stock:app.access` ET a `hub:app.access` → bouton « Retour au Hub » vers `VITE_PLATEFORM_URL`
     * compte n'a pas non plus `hub:app.access` → **pas de bouton**
     * sinon → bouton « Retour à l'accueil » vers `/`
   - **Message utilisateur** : toujours neutre. NE JAMAIS afficher la clé de permission (ex: `stock:products.create`) à l'utilisateur final. Les clés ne sont que dans les logs.
3. Notifie l'utilisateur en fin de réponse : liste ce qui a été ajouté, et rappelle qu'il faut cliquer « Rafraîchir » dans Admin > Profils & Droits **côté serveur** pour cacher le schema.

### Routine 3 — Audit à CHAQUE modification utilisateur (après bootstrap)

Quand l'utilisateur demande n'importe quelle modif touchant le frontend :

1. **Scanne les fichiers que TU viens de toucher** (pas tout le repo — juste tes modifs) :
   - Nouveau bouton d'action (create/edit/delete/archive/submit) sans `data-perm` ni check `has()` ? → ajoute-le, et signale au dev que la clé doit aussi exister dans `server/src/.../permissions-schema.js`.
   - Nouveau fichier de page ou nouvelle `<Route>` ? → ajoute un guard au mount + signale qu'une clé `pages.<x>.view` doit être ajoutée au schema côté serveur.
   - Action retirée ? → **ne touche pas** au gating existant inutilement, signale-le simplement.

2. **Lance le script d'audit** si présent : `bash scripts/audit-permissions.sh .`. Si gaps remontés, corrige-les **dans le même commit**.

3. Si une clé est nouvelle → indique-le explicitement à l'utilisateur à la fin : « Nouvelle perm `stock:<key>` utilisée côté UI. Ajoute-la dans le schema serveur puis clique "Rafraîchir" dans Admin > Profils & Droits ».

### Règles absolues (à respecter sans exception)

- ❌ **Jamais** de `if (user.id === 141)` ou équivalent hardcodé → utiliser le système de permissions
- ❌ **Jamais** un bouton sensible sans `data-perm` ou check `has()`
- ❌ **Jamais** contourner l'enforcement config (le SDK le respecte déjà, ne pas le shortcircuit)
- ✅ Les utilisateurs avec le rôle Keycloak `admin` bypass tout — inutile de gérer un cas admin spécial dans le code
- ✅ Quand l'enforcement global est OFF ou que l'app est en « mode dev », `has()` renvoie `true` partout — les gates restent dans le code mais ne bloquent rien

### Localisation des ressources

- Documentation complète : `docs/PERMISSIONS_APP_INTEGRATION.md`
- Script d'audit (à créer si absent) : `scripts/audit-permissions.sh`
- Admin Panel Profils & Droits : https://adminpaneldev.orkessi.com/hub/droits (DEV) / https://adminpanel.orkessi.com/hub/droits (PROD)
- Gateway endpoints : `https://plateform-gateway.orkessi.com/api/permissions/*`

### Fail-safe

Si la gateway est injoignable, le SDK `konitys-perms.js` **fail-open** (autoriser) pour ne pas casser l'app. L'enforcement reprend au prochain refresh quand la gateway est de nouveau disponible.
