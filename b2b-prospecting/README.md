# AGENT-IA — Prospection B2B Automatisée

Système complet d'acquisition de leads, qualification, outreach personnalisé et booking automatique de rendez-vous. Déployable sur N8N en quelques heures.

---

## Workflows N8N — Liens Directs

| # | Nom | ID N8N | Lien | Statut |
|---|-----|--------|------|--------|
| 1 | 🎯 Acquisition de Leads | `l5LtsKCxiVJXEg6Z` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/l5LtsKCxiVJXEg6Z) | Inactif — configurer les nodes |
| 2 | 📊 Qualification & Scoring | `4RTtMyG8SO8o82c1` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/4RTtMyG8SO8o82c1) | Inactif — configurer les nodes |
| 3 | 📧 Outreach & Follow-ups | `mU81EopFgct5juAU` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/mU81EopFgct5juAU) | Inactif — configurer les nodes |
| 4 | 💬 Gestion des Réponses | `rYJ7YfwORA1VyYvO` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/rYJ7YfwORA1VyYvO) | Inactif — configurer les nodes |
| 5 | 📅 Booking & Calendrier | `VedvqBzgSuhEi0g5` | [Ouvrir](https://nz0439.app.n8n.cloud/workflow/VedvqBzgSuhEi0g5) | Inactif — configurer les nodes |

### Import des Nodes dans chaque Workflow

Pour chaque workflow ci-dessus :

1. **Ouvrir** le workflow via le lien
2. **Copier** le contenu JSON du fichier correspondant dans `workflows/`
3. Dans N8N, cliquer sur le canvas vide → **Ctrl+V** (coller)
4. Les nodes apparaissent — **configurer les credentials** (Postgres, Gmail, OpenAI, etc.)
5. **Sauvegarder** puis **Activer**

---

## Architecture du Système

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT-IA B2B PROSPECTING                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  WORKFLOW 1   │    │  WORKFLOW 2   │    │  WORKFLOW 3   │              │
│  │  Acquisition  │───▶│ Qualification │───▶│   Outreach    │              │
│  │   de Leads    │    │  & Scoring    │    │  & Follow-up  │              │
│  └──────────────┘    └──────────────┘    └──────┬───────┘              │
│         │                    │                    │                      │
│         │                    │                    ▼                      │
│         │                    │           ┌──────────────┐              │
│         │                    │           │  WORKFLOW 4   │              │
│         │                    │           │  Réponses &   │              │
│         │                    │           │  Classification│              │
│         │                    │           └──────┬───────┘              │
│         │                    │                    │                      │
│         │                    │                    ▼                      │
│         │                    │           ┌──────────────┐              │
│         │                    │           │  WORKFLOW 5   │              │
│         │                    │           │   Booking &   │              │
│         │                    │           │  Calendrier   │              │
│         │                    │           └──────────────┘              │
│         │                    │                    │                      │
│         ▼                    ▼                    ▼                      │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                    POSTGRESQL (CRM)                       │          │
│  │  leads │ outreach_messages │ meetings │ campaigns │ logs  │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

FLUX DE DONNÉES :

Google Maps ─┐
LinkedIn ────┤──▶ Enrichissement ──▶ Scoring ──▶ GPT Message ──▶ Email
Apollo.io ───┘    (Apollo/Hunter)    (Local)     (gpt-4o-mini)   (Gmail/SMTP)
                                                                     │
                                                                     ▼
                                                              Réponse reçue
                                                                     │
                                                          ┌──────────┴──────────┐
                                                          │  GPT Classification  │
                                                          └──────────┬──────────┘
                                                                     │
                                          ┌──────────────────────────┼──────────────┐
                                          ▼                          ▼              ▼
                                    Intéressé               Pas intéressé     Désinscription
                                    → Auto-réponse          → Archive         → RGPD opt-out
                                    → Booking RDV
                                    → Google Calendar
                                    → Email confirmation
```

---

## Stack Technique

| Composant | Outil | Coût | Alternative |
|-----------|-------|------|-------------|
| **Orchestration** | N8N Cloud | 24€/mois (Starter) | N8N self-hosted (gratuit) |
| **Base de données** | PostgreSQL (Supabase) | Gratuit (500MB) | Railway, Neon |
| **Scraping** | SerpAPI | 50$/mois (5K recherches) | Apify (gratuit 5$/mois) |
| **Enrichissement** | Apollo.io | Gratuit (10K crédits/mois) | Hunter.io, Dropcontact |
| **Vérification email** | ZeroBounce | 16$/mois (2K vérifs) | NeverBounce, Reacher |
| **IA / LLM** | GPT-4o-mini (OpenAI) | ~5€/mois | Claude Haiku, Mistral |
| **Email** | Gmail + Google Workspace | 7€/mois | SMTP + Mailgun |
| **Calendrier** | Google Calendar | Inclus dans Workspace | Calendly (gratuit) |
| **Warmup email** | Lemwarm | 29€/mois | Instantly warmup |
| **Monitoring** | N8N built-in | Inclus | — |

### Estimation Coûts Mensuels

| Scénario | Leads/mois | Emails/mois | Coût estimé |
|----------|-----------|-------------|-------------|
| **Démarrage** | 200 | 600 | ~50€/mois |
| **Croissance** | 1 000 | 3 000 | ~120€/mois |
| **Scale** | 5 000 | 15 000 | ~300€/mois |

> Le scoring est 100% local (0€). GPT n'est appelé que pour les leads qualifiés (~30% du total), ce qui réduit les coûts API de 70%.

---

## Workflows Détaillés

### Workflow 1 — Acquisition de Leads
**Fichier :** `workflows/workflow1_lead_acquisition.json`
**Fréquence :** Lun-Ven 9h00

```
Déclencheur Cron (9h Lun-Ven)
    │
    ▼
Config Recherches (Code)
    │  Définir les requêtes Google Maps / LinkedIn
    │
    ▼
SerpAPI Google Maps (HTTP Request)
    │  Scraper les entreprises par requête
    │
    ▼
Parser Résultats (Code)
    │  Extraire : nom, site, téléphone, adresse, secteur
    │
    ▼
Apollo.io — Trouver Contacts (HTTP Request)
    │  Enrichir : nom, prénom, email, poste, LinkedIn
    │
    ▼
Fusionner Données (Code)
    │  Merger entreprise + contacts
    │
    ▼
Normaliser + Dédupliquer (Code)
    │  Nettoyer les données, supprimer doublons
    │
    ▼
Sauvegarder en BDD (Postgres)
    │  INSERT avec ON CONFLICT pour éviter doublons
    │
    ▼
Logger Activité (Postgres)
```

### Workflow 2 — Qualification & Scoring
**Fichier :** `workflows/workflow2_qualification_scoring.json`
**Fréquence :** Lun-Ven 9h30

```
Déclencheur Cron (9h30)
    │
    ▼
Récupérer Leads Non Qualifiés (Postgres)
    │  SELECT WHERE status = 'new' LIMIT 50
    │
    ▼
Scorer les Leads (Code — LOCAL, 0€)
    │  Scoring sur 100 pts : taille + poste + secteur + signaux + accessibilité
    │
    ▼
Lead Chaud ? (IF score >= 70)
    │
    ├── OUI → GPT Angle d'Approche (gpt-4o-mini, ~0.001€/lead)
    │         → Mettre à jour en BDD (status = 'qualified')
    │
    └── NON → Mettre à jour score en BDD
              → Si score >= 40 : status = 'qualified' (tiède)
              → Si score < 40 : reste 'new' (froid, nurturing)
```

### Workflow 3 — Outreach & Follow-ups
**Fichier :** `workflows/workflow3_outreach.json`
**Fréquence :** Lun-Ven 10h00

```
Déclencheur Cron (10h)
    │
    ▼
Leads à Contacter (Postgres)
    │  SELECT qualified + score >= 50 + pas opt-out + followup dû
    │
    ▼
Déterminer Step Séquence (Code)
    │  Step 1 = premier contact, Step 2 = follow-up, Step 3 = breakup
    │
    ▼
Premier Contact ? (IF step == 1)
    │
    ├── OUI → GPT Premier Email
    │         Objet A/B testing + corps personnalisé + mention RGPD
    │
    └── NON → GPT Follow-up
              Step 2 : relance avec valeur ajoutée
              Step 3 : breakup email (dernier message)
    │
    ▼
Préparer Email (Code)
    │  Parser JSON GPT + A/B testing aléatoire sur l'objet
    │
    ▼
Envoyer Email (Gmail)
    │
    ▼
Throttle Anti-Spam (Code)
    │  Délai 60s entre chaque email
    │
    ▼
Logger Message + MAJ Lead (Postgres)
    │  Sauvegarder le message + planifier prochain follow-up
```

### Workflow 4 — Gestion des Réponses
**Fichier :** `workflows/workflow4_response_handler.json`
**Fréquence :** Temps réel (polling Gmail chaque minute)

```
Gmail Trigger (polling 1 min)
    │
    ▼
Trouver le Lead (Postgres)
    │  Match par email de l'expéditeur
    │
    ▼
Lead Connu ? (IF trouvé en BDD)
    │
    ├── NON → Ignorer (pas un prospect)
    │
    └── OUI → GPT Analyser Réponse
              │  Classification : interested / not_interested / unsubscribe / etc.
              │
              ▼
         Router Action (Switch)
              │
              ├── UNSUBSCRIBE → RGPD Désinscription immédiate (opt_out = true)
              │
              ├── AUTO-REPLY OK → GPT Générer Réponse → Envoyer → Logger
              │     (interested, meeting_request, refer)
              │
              └── ESCALADE → Notifier Humain par email
                    (question complexe, doute, confiance < 0.7)
              │
              ▼
         Logger Réponse + MAJ Status Lead
```

### Workflow 5 — Booking & Calendrier
**Fichier :** `workflows/workflow5_booking.json`
**Fréquence :** Webhook (déclenché par workflow 4) + Cron 8h (rappels)

```
Webhook (prospect veut un RDV)
    │
    ▼
Lire Calendrier Google (7 jours)
    │
    ▼
Trouver Créneaux Libres (Code)
    │  Créneaux de 30 min, 9h-18h, Lun-Ven
    │
    ▼
Créer Event Google Calendar
    │  Avec Google Meet auto + invitation prospect
    │
    ▼
Sauvegarder RDV en BDD (Postgres)
    │
    ▼
Email Confirmation au prospect

--- Branche séparée ---

Cron 8h quotidien
    │
    ▼
Chercher RDV dans les 24h (Postgres)
    │
    ▼
Envoyer Email Rappel J-1
```

---

## Prompts IA

Tous les prompts sont dans le dossier `prompts/` :

| Fichier | Usage | Modèle | Coût estimé/appel |
|---------|-------|--------|-------------------|
| `qualification.md` | Scoring avancé + angle d'approche | gpt-4o-mini | ~0.001€ |
| `message_generation.md` | Emails personnalisés + follow-ups | gpt-4o-mini | ~0.002€ |
| `response_analysis.md` | Classification et auto-réponses | gpt-4o-mini | ~0.001€ |

> **Optimisation coûts :** Le scoring initial est 100% local (voir `scripts/scoring.js`). GPT n'est appelé que pour les leads qualifiés (score >= 70) pour l'angle d'approche, et pour tous les leads contactés pour la génération de message. Résultat : ~70% d'économie vs tout-GPT.

---

## Scripts Utilitaires

| Fichier | Description |
|---------|-------------|
| `scripts/scoring.js` | Engine de scoring local (0 API) — 5 critères, 100 pts |
| `scripts/enrichment.js` | Normalisation, déduplication, détection seniority |

---

## Plan de Déploiement (étape par étape)

### Phase 1 — Setup (Jour 1-2)

1. **Créer un compte N8N Cloud** (ou self-host avec Docker)
2. **Configurer PostgreSQL**
   - Créer une base sur Supabase (gratuit)
   - Exécuter `sql/init_tables.sql`
3. **Obtenir les API keys**
   - OpenAI : [platform.openai.com](https://platform.openai.com)
   - SerpAPI : [serpapi.com](https://serpapi.com) (100 recherches gratuites/mois)
   - Apollo.io : [apollo.io](https://apollo.io) (10K crédits gratuits/mois)
4. **Configurer Gmail / Google Workspace**
   - Créer un email dédié prospection (ex: julien@votreentreprise.com)
   - Activer l'API Gmail et Calendar dans Google Cloud Console
5. **Configurer les credentials N8N**
   - Postgres, OpenAI, Gmail OAuth2, Google Calendar OAuth2
6. **Configurer les variables d'environnement N8N**

```
SERPAPI_KEY=...
APOLLO_API_KEY=...
SENDER_NAME=Julien Martin
SENDER_TITLE=Growth Lead
SENDER_COMPANY=AgentIA
SENDER_EMAIL=julien@votreentreprise.com
DAILY_EMAIL_LIMIT=50
EMAIL_DELAY_SECONDS=60
ALERT_EMAIL=vous@votreentreprise.com
```

### Phase 2 — Import & Test (Jour 2-3)

7. **Importer les workflows** dans N8N (copier-coller le JSON)
8. **Remplacer les credential IDs** dans chaque workflow
9. **Tester chaque workflow individuellement** (bouton "Test workflow")
   - Workflow 1 : Vérifier que les leads arrivent en BDD
   - Workflow 2 : Vérifier les scores
   - Workflow 3 : Envoyer un email test à vous-même
   - Workflow 4 : Répondre à votre propre email test
   - Workflow 5 : Vérifier la création d'event Calendar
10. **Adapter les requêtes de recherche** dans workflow 1 (Config Recherches)

### Phase 3 — Warmup (Jour 3-10)

11. **Configurer le warmup email** (Lemwarm ou Instantly)
    - Laisser tourner 7-10 jours avant l'envoi de cold emails
    - Objectif : score de délivrabilité > 90%
12. **Envoyer 5-10 emails/jour** manuellement pour tester les messages
13. **Ajuster les prompts** selon les premiers retours

### Phase 4 — Launch (Jour 10+)

14. **Activer les workflows 1 et 2**
15. **Activer le workflow 3** avec une limite basse (10 emails/jour)
16. **Activer le workflow 4** (gestion réponses)
17. **Monter progressivement** le volume : 10 → 25 → 50 emails/jour
18. **Activer le workflow 5** quand les premiers RDV arrivent

### Phase 5 — Optimisation (Semaine 3+)

19. **Analyser les métriques** :
    - Taux d'ouverture cible : > 50%
    - Taux de réponse cible : > 10%
    - Taux de RDV/lead contacté : > 3%
20. **A/B tester les objets** (variant A vs B dans les logs)
21. **Ajuster le scoring** selon les leads qui convertissent réellement
22. **Affiner les prompts** avec les meilleurs messages

---

## RGPD — Conformité

Le système intègre la conformité RGPD nativement :

| Exigence | Implémentation |
|----------|----------------|
| **Base légale** | Intérêt légitime (art. 6.1.f) — prospection B2B |
| **Droit d'opposition** | Mention "STOP" dans chaque email + traitement auto |
| **Opt-out immédiat** | Workflow 4 : détection "unsubscribe" → opt_out = true |
| **Rétention limitée** | Champ `data_retention_until` (365 jours par défaut) |
| **Purge automatique** | Fonction SQL `purge_expired_data()` |
| **Minimisation** | On ne stocke que les données business publiques |
| **Transparence** | Signature claire : nom, poste, entreprise réels |

---

## Métriques & KPIs

Requêtes SQL utiles pour le suivi :

```sql
-- Dashboard pipeline
SELECT * FROM pipeline_dashboard;

-- Taux de réponse par campagne
SELECT
  c.name,
  c.stats->>'contacted' as contacted,
  c.stats->>'replied' as replied,
  c.stats->>'meetings' as meetings,
  ROUND(
    (c.stats->>'replied')::numeric / NULLIF((c.stats->>'contacted')::numeric, 0) * 100, 1
  ) as reply_rate
FROM campaigns c;

-- Performance A/B testing objets
SELECT
  om.subject,
  COUNT(*) as sent,
  COUNT(*) FILTER (WHERE om.status IN ('opened','replied')) as opened,
  COUNT(*) FILTER (WHERE om.replied_at IS NOT NULL) as replied,
  ROUND(COUNT(*) FILTER (WHERE om.replied_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100, 1) as reply_rate
FROM outreach_messages om
WHERE om.direction = 'outbound'
GROUP BY om.subject
ORDER BY reply_rate DESC;

-- Leads les plus chauds non contactés
SELECT first_name, last_name, job_title, company_name, score, score_label
FROM leads
WHERE status = 'qualified' AND score >= 70 AND opt_out = FALSE
  AND last_contacted_at IS NULL
ORDER BY score DESC;
```

---

## Améliorations Futures

### Court terme (Semaine 4-8)
- **A/B testing automatisé** : Tracker quel objet (A ou B) performe mieux, utiliser le gagnant
- **LinkedIn outreach** : Ajouter Phantombuster ou La Growth Machine pour le multicanal
- **Webhook Calendly** : Remplacer le booking maison par Calendly pour plus de fiabilité

### Moyen terme (Mois 2-3)
- **Scoring prédictif** : Entraîner un modèle ML sur les leads convertis pour affiner le scoring
- **Multicanal séquencé** : Email J0 → LinkedIn J2 → Email follow-up J5
- **Intégration CRM** : Sync bidirectionnelle avec HubSpot/Pipedrive
- **Domain rotation** : Utiliser plusieurs domaines email pour augmenter le volume

### Long terme (Mois 3+)
- **Intent data** : Intégrer Bombora/G2 pour détecter les leads en phase d'achat
- **AI voice agent** : Appels automatiques avec synthèse vocale pour les leads ultra-chauds
- **Self-learning prompts** : Fine-tuner le modèle sur les messages qui ont le meilleur taux de réponse
- **Dashboard temps réel** : Metabase ou Grafana connecté à PostgreSQL

---

## Structure des Fichiers

```
b2b-prospecting/
├── README.md                              ← Ce fichier
├── config/
│   └── settings.json                      ← Configuration (ICP, limites, RGPD)
├── prompts/
│   ├── qualification.md                   ← Prompt scoring + angle d'approche
│   ├── message_generation.md              ← Prompt emails + follow-ups + exemples
│   └── response_analysis.md               ← Prompt analyse réponses + auto-reply
├── scripts/
│   ├── scoring.js                         ← Engine de scoring local (Node.js / N8N Code)
│   └── enrichment.js                      ← Normalisation + dédup + helpers
├── sql/
│   └── init_tables.sql                    ← Schema PostgreSQL complet (7 tables + vues)
└── workflows/
    ├── workflow1_lead_acquisition.json     ← Scraping + enrichissement
    ├── workflow2_qualification_scoring.json ← Scoring + qualification
    ├── workflow3_outreach.json             ← Envoi emails + follow-ups
    ├── workflow4_response_handler.json     ← Classification + auto-réponses
    └── workflow5_booking.json             ← Prise de RDV + rappels
```
