# AGENT-IA — Assistant Personnel Telegram Ultra-Avancé

Système de 3 workflows n8n formant un assistant IA personnel complet piloté via Telegram.

## Workflows

| # | Nom | ID | URL | Statut |
|---|-----|----|-----|--------|
| 1 | 🤖 Assistant Telegram | `5MlDBVpSGfYzm3UX` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/5MlDBVpSGfYzm3UX) | Inactif (configurer credentials) |
| 2 | 📰 Digest Quotidien | `a3wHe12IXszsv0f6` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/a3wHe12IXszsv0f6) | Inactif (configurer credentials) |
| 3 | 🗄️ Init Base de Données | `eWftCxbGtzkqzf43` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/eWftCxbGtzkqzf43) | Manuel (exécuter 1 fois) |

---

## Étapes de mise en service

### 1. Créer les credentials dans n8n (Settings → Credentials)

| Credential | Type n8n | Requis pour |
|------------|----------|-------------|
| `Telegram API` | Telegram API | Workflows 1 & 2 |
| `OpenAI API` | OpenAI API | Workflows 1 & 2 |
| `Gmail OAuth2` | Google OAuth2 (Gmail) | Workflows 1 & 2 |
| `Google Calendar OAuth2` | Google OAuth2 (Calendar) | Workflow 1 |
| `Postgres DB` | PostgreSQL | Workflows 1, 2 & 3 |
| `OpenAI Bearer Auth` | HTTP Bearer Auth | Workflow 1 (DALL-E) |

Pour `OpenAI Bearer Auth` : Type = "Header Auth", Header name = `Authorization`, Value = `Bearer sk-VOTRE_CLÉ`

### 2. Créer les variables d'environnement (Settings → Variables)

| Variable | Valeur |
|----------|--------|
| `NEWSAPI_KEY` | Clé API newsapi.org (gratuit) |
| `TELEGRAM_CHAT_ID` | Ton chat ID Telegram (via @userinfobot) |
| `EMAIL_DIGEST` | Ton adresse email pour le digest |

### 3. Initialiser la base de données

1. Ouvrir Workflow 3 : https://nz0439.app.n8n.cloud/workflow/eWftCxbGtzkqzf43
2. Configurer la credential **Postgres DB** dans le nœud "Créer Toutes les Tables"
3. Coller la requête SQL (voir `workflows/workflow3_init_db.js`)
4. Cliquer **Test workflow**

### 4. Activer les workflows

Une fois toutes les credentials configurées :
- Workflow 1 → toggle **Active** en haut à droite
- Workflow 2 → toggle **Active** en haut à droite

---

## Architecture Workflow 1 — Assistant Telegram

```
Telegram Trigger
    ↓
  [If: message vocal?]
  TRUE → Transcrire Audio (Whisper) → Données Vocale → AGENT-IA
  FALSE → Router Message (Code) → AGENT-IA
                                        ↓
                                  Envoyer Réponse (Telegram)
```

**Tools disponibles pour l'agent :**
- 📧 Envoyer Email (Gmail)
- 📧 Lire Emails (Gmail)
- 📅 Voir Agenda (Google Calendar)
- 📅 Créer Événement (Google Calendar)
- 👥 Chercher Contact (Postgres)
- 📰 Actualités News (NewsAPI)
- 🎨 Générer Image DALL-E

---

## Architecture Workflow 2 — Digest Quotidien

```
Schedule (Lun-Ven 8h00)
    ↓
Récupérer Actualités (Code: NewsAPI France + Monde)
    ↓
Agent Digest IA (GPT-4o)
    ↓
Formater Digest (Set)
    ↓
Envoyer Digest Telegram
    ↓
Envoyer Digest Email (Gmail)
    ↓
Sauvegarder en DB (Postgres)
```

---

## Base de données PostgreSQL

Tables créées par Workflow 3 :

```sql
contacts          -- Contacts (nom, email, téléphone, société)
messages_log      -- Historique des conversations Telegram
news_digest       -- Archive des digests quotidiens
chat_memory       -- Mémoire de conversation GPT (auto-gérée par n8n)
bank_transactions -- Transactions bancaires
```

---

## Configuration DALL-E (Génération d'images)

Dans le nœud **"Générer Image DALL-E"** du Workflow 1 :
- Ajouter la credential `OpenAI Bearer Auth`
- Type: Header Auth
- Header: `Authorization`
- Value: `Bearer sk-VOTRE_CLÉ_OPENAI`

---

## Obtenir ton Chat ID Telegram

1. Cherche `@userinfobot` sur Telegram
2. Envoie `/start`
3. Il te répond avec ton User ID — c'est ton Chat ID
