# Le Scribouill'art — Éditeur (PWA)

Ce dossier contient une PWA (Progressive Web App) installable (Windows / Android via Chrome/Edge).

## Utiliser en local (Windows)

1. Double-clique sur `serve.bat`
2. Ouvre **http://localhost:5173/index.html** dans Edge/Chrome
3. Installe l’app : menu ⋯ → **Installer cette application** (ou icône d’installation dans la barre d’adresse)

> Remarque : la PWA ne s’installe pas correctement en double-cliquant directement `index.html` (mode `file://`).

## Offline

- Le *coeur* (HTML/CSS/JS) est mis en cache via `service-worker.js`.
- Les contenus externes (ex: YouTube) nécessitent Internet.

## Partage avec des amis

### Option A (simple) : héberger
- Héberge ce dossier (GitHub Pages, Netlify, etc.)
- Tes amis ouvrent l’URL et cliquent **Installer**.

#### Déployer sur GitHub Pages (recommandé)

1. Crée un dépôt GitHub (ex: `publication-pwa`)
2. Mets **tout le contenu de ce dossier** dans le dépôt, puis pousse (commit + push)
3. Sur GitHub : **Settings → Pages**
	 - **Build and deployment** : “Deploy from a branch”
	 - **Branch** : `main` + `/ (root)`
4. Attends 1–2 minutes, puis ouvre l’URL fournie par GitHub Pages
5. Ouvre directement `.../index.html` puis installe l’app (Chrome/Edge)

Notes importantes :
- Sur GitHub Pages, l’URL ressemble souvent à `https://<user>.github.io/<repo>/...`.
	Les chemins relatifs (ce projet utilise `./`) sont adaptés.
- Si tu laisses des liens/images vers `../index.html` ou `../images/...`, ils seront **cassés**
	si ces fichiers ne sont pas présents dans le dépôt. Soit tu ajoutes ces dossiers/fichiers,
	soit tu enlèves/ajustes ces liens dans `index.html`.

### Option B : zip + serveur local
- Zippe le dossier
- Tes amis dézippent et lancent `serve.bat`, puis installent depuis `http://localhost:5173/index.html`

## Vérifier que la PWA est OK

- Dans Chrome/Edge : DevTools → **Application**
	- **Manifest** : vérifie que `manifest.webmanifest` est détecté
	- **Service Workers** : vérifie que `service-worker.js` est “Activated”
- La première visite doit être en ligne pour mettre en cache. Ensuite l’app peut se lancer sans connexion
	(sauf contenu externe comme YouTube).

## Publication Play Store (plus tard) — principe

Le chemin classique est : **PWA → TWA (Trusted Web Activity) → Play Store**.

Étapes (vue d’ensemble) :
1. Avoir un site en **https** (obligatoire pour une vraie publication)
2. Générer une app Android wrapper via Bubblewrap (TWA)
3. Signer l’app + publier sur la Play Console

Je peux te guider pas à pas quand tu en seras là.
