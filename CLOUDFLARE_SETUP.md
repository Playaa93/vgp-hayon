# Setup Cloudflare pour VGP Inspect

## 1. Installer Wrangler

```bash
npm install -g wrangler
```

## 2. Se connecter

```bash
wrangler login
```

## 3. Créer le namespace KV

```bash
cd /Users/hzukic/Desktop/Applications/vgp
wrangler kv:namespace create VGP_DATA
```

Copie l'ID retourné et colle-le dans `wrangler.toml` à la ligne `id = ""`

## 4. Créer le bucket R2

```bash
wrangler r2 bucket create vgp-storage
```

## 5. Déployer le Worker

```bash
wrangler deploy
```

## 6. Configurer l'API Key

Dans l'app, génère une clé API unique (16+ caractères).
Elle sert d'identifiant utilisateur (pas besoin de login complexe).

## URL de l'API

Après déploiement : `https://vgp-api.<ton-account>.workers.dev`

Met cette URL dans les settings de l'app ou dans le code.
