# Usine à Reels "Classements & Comparaisons" — 100% gratuite

Pipeline : **n8n** (idéation + validation Telegram + publication) → **Supabase** (file d'attente + stockage) → **GitHub Actions** (montage vidéo ffmpeg + voix edge-tts).

Coût mensuel : ~1-2 € (API Claude pour générer les classements). Tout le reste est gratuit.

---

## Installation (une seule fois, ~20 minutes)

### 1. Supabase
1. Ouvre ton projet Supabase → **SQL Editor** → colle et exécute `supabase_schema.sql`.
   - Ça crée la table `ig_reels`, le bucket public `reels`, et insère un reel de test (statut `valide`).
2. Vérifie dans **Storage** que le bucket `reels` existe et est **public**.

### 2. GitHub
1. Crée un repo **privé** (ex: `reels-factory`) et pousse tout le contenu de ce dossier.
2. Dans le repo : **Settings → Secrets and variables → Actions → New repository secret** :
   - `SUPABASE_URL` = `https://TONPROJET.supabase.co`
   - `SUPABASE_SERVICE_KEY` = la clé `service_role` (Settings → API dans Supabase)
3. Crée un **token GitHub** pour que n8n puisse déclencher le rendu :
   - github.com → Settings → Developer settings → Fine-grained tokens
   - Accès : ton repo uniquement, permission **Actions: Read and write**

### 3. Premier test (sans n8n)
Récupère l'`id` du reel de test :
```sql
select id from ig_reels where statut = 'valide' limit 1;
```
Puis déclenche le rendu (remplace TOI/REPO, TON_TOKEN, UUID) :
```bash
curl -X POST \
  -H "Authorization: Bearer TON_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/TOI/REPO/actions/workflows/render.yml/dispatches \
  -d '{"ref":"main","inputs":{"reel_id":"UUID"}}'
```
~2-3 minutes plus tard : `statut = video_prete` et `video_url` rempli dans la table.
Ouvre l'URL → ta première vidéo.

### 4. Musique de fond (optionnel mais recommandé)
Dépose un MP3 **libre de droits** dans `assets/music.mp3` (ex: Pixabay Music,
son type "suspense/build-up"). Il sera mixé automatiquement à 12% de volume.

### 5. Police stylée (optionnel)
Dépose `assets/font-bold.ttf` et `assets/font-regular.ttf`
(ex: Montserrat ExtraBold depuis Google Fonts) pour remplacer DejaVu.

---

## Format du payload `donnees` (jsonb)

```json
{
  "titre_ecran": "TOP 10 ...",
  "hook": "Le n°1 va te choquer",
  "cta": "Abonne-toi, un classement tous les 2 jours",
  "voix": "fr-FR-HenriNeural",
  "accent": "#7c3aed",
  "items": [
    {"label": "Nom", "valeur": "390 km/h", "score": 100},
    {"label": "...", "valeur": "...", "score": 82}
  ]
}
```
- `items` : classés du **n°1 au n°10** (la vidéo les révèle du 10 vers le 1)
- `score` : 0-100, longueur relative de la barre
- Voix EN : `"voix": "en-US-ChristopherNeural"`
- Voix FR alternatives : `fr-FR-DeniseNeural` (femme), `fr-FR-RemyMultilingualNeural`

## Cycle des statuts
`idee` → (validation Telegram) → `valide` → `rendu_en_cours` → `video_prete`
→ (validation Telegram de la vidéo) → `publie` — ou `rejete` / `erreur`

## Workflows n8n à brancher ensuite
1. **Idéation** (cron hebdo) : Claude génère 8-10 classements → insert `ig_reels`
   en `idee` → boutons Telegram valider/rejeter → `valide`
2. **Rendu** (cron ou trigger) : cherche `statut=valide` → appel HTTP GitHub
   `workflow_dispatch` avec le `reel_id`
3. **Validation vidéo** : cherche `video_prete` → envoie la vidéo sur Telegram
   avec boutons Publier/Rejeter
4. **Publication** : Graph API `/media` (video_url, media_type=REELS) →
   `/media_publish` → `statut=publie`
