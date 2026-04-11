/**
 * Workflow 1: CEO AI Agent - Principal
 * ID: FFJraa5AJ3xti4S7
 * URL: https://nz0439.app.n8n.cloud/workflow/FFJraa5AJ3xti4S7
 *
 * Agent IA CEO via Telegram. Voix/texte, GPT-4o, outils: bourse, emails,
 * agenda, banque, actualités, tâches, contacts, génération d'images DALL-E 3.
 * Détection et envoi automatique des images générées.
 *
 * Architecture:
 *   Trigger → ifElse(voice?)
 *     true  → getFile → download → Whisper → setVoice → fusionner
 *     false → Code Router (photo/text/doc) → fusionner
 *   fusionner → Ack → AI Agent → Extract Image URL → ifElse(hasImage?)
 *     true  → HTTP Download → Telegram sendPhoto
 *     false → Telegram sendText
 *
 * Fixes appliqués (2026-04-11):
 *   1. Outil Generer Image: ajout du mapping $fromAI('prompt') pour passer
 *      le prompt au sous-workflow DALL-E (était vide → aucune image générée)
 *   2. Extraire URL Image: regex élargi pour attraper les URLs DALL-E
 *      (blob.core.windows.net) en plus des formats markdown et extensions
 *   3. System prompt: instruction explicite d'inclure l'URL image en markdown
 *   4. Modèle: gpt-4 → gpt-4o (correspondant au nom du noeud)
 *
 * Variables d'environnement nécessaires:
 *   - TELEGRAM_BOT_TOKEN: token du bot Telegram (pour téléchargement audio)
 *
 * Credentials nécessaires:
 *   - Telegram API
 *   - OpenAI API
 *   - Gmail OAuth2
 *   - Google Calendar OAuth2 (via sous-workflow)
 *   - Postgres DB (via sous-workflows)
 */

const wf = workflow('CEO AI Agent - Principal');

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Tu es **ARIA** — Assistant de Révolution pour les Investissements et l'Administration — l'IA personnelle du dirigeant d'entreprise.

## Contexte
- Date & Heure: {{ $now.toFormat('dddd DD MMMM yyyy à HH:mm') }}
- Utilisateur: {{ $json.firstName }}
- Mode d'entrée: {{ $json.inputType }}

## Tes Capacités
📈 **Marchés & Finance**: Cours de bourse en temps réel, indices, cryptos, actions
📧 **Emails**: Lecture, résumé, recherche, envoi de mails
📅 **Agenda**: Consultation, création et gestion des RDV Google Calendar
🏦 **Banque**: Soldes de comptes, dernières transactions
📰 **Actualités**: Veille financière, économique et sectorielle
✅ **Tâches**: Gestion des tâches et projets
👤 **Contacts**: Recherche, ajout et gestion des contacts
🖼️ **Images**: Génération d'images avec DALL-E 3

## Règles
- Réponds **toujours en français** sauf demande contraire
- Sois **concis, direct et professionnel**
- Structure tes réponses avec des **emojis**
- Notation française pour les montants (1 000 000 €)
- Formate les variations boursières avec ▲ (hausse) ou ▼ (baisse)
- Maximum 4000 caractères par message
- Markdown compatible Telegram

## Gestion des Images Générées
Quand tu utilises l'outil de génération d'images:
- Inclus **TOUJOURS** l'URL de l'image retournée dans ta réponse
- Utilise le format markdown image: ![description](URL)
- Ajoute un court commentaire décrivant l'image

## Gestion des Contacts & Emails
Quand l'utilisateur dit 'envoie un mail à [Prénom]':
1. Utilise **Contacts DB** (action: lookup, nom: prénom)
2. Si trouvé → utilise **Envoyer Email Gmail** pour envoyer
3. Si introuvable → demande de préciser

Quand l'utilisateur dit 'ajoute [Prénom] avec l'email [email]':
1. Utilise **Contacts DB** avec action: ajouter, nom: prénom, email: adresse`;

// ═══════════════════════════════════════════════════════════════
// TRIGGER
// ═══════════════════════════════════════════════════════════════
const tgTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.1,
  name: '📱 Telegram Trigger',
  config: {
    updates: ['message'],
    additionalFields: {}
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// ═══════════════════════════════════════════════════════════════
// VOICE BRANCH: Get file → Download → Whisper → Set
// ═══════════════════════════════════════════════════════════════
const getVoiceFile = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: '📥 Récupérer Fichier Vocal',
  config: {
    resource: 'file',
    fileId: expr("{{ $json.message.voice.file_id }}"),
    additionalFields: {}
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

const downloadAudio = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  name: '⬇️ Télécharger Audio',
  config: {
    url: expr("{{ 'https://api.telegram.org/file/bot' + $env.TELEGRAM_BOT_TOKEN + '/' + $json.result.file_path }}"),
    options: { response: { response: { responseFormat: 'file' } } }
  }
});

const whisperTranscription = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.1,
  name: '🎤 Whisper Transcription',
  config: {
    resource: 'audio',
    operation: 'transcribe',
    options: {}
  },
  credentials: { openAiApi: newCredential('OpenAI API') }
});

const setVoiceInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  name: '✍️ Préparer Message Vocal',
  config: {
    assignments: {
      assignments: [
        { id: 'v1', name: 'userMessage', value: expr("{{ $json.text }}"), type: 'string' },
        { id: 'v2', name: 'chatId', value: expr("{{ $('📱 Telegram Trigger').item.json.message.chat.id }}"), type: 'number' },
        { id: 'v3', name: 'firstName', value: expr("{{ $('📱 Telegram Trigger').item.json.message.from.first_name }}"), type: 'string' },
        { id: 'v4', name: 'inputType', value: 'vocal', type: 'string' }
      ]
    },
    options: {}
  }
});

// ═══════════════════════════════════════════════════════════════
// NON-VOICE BRANCH: Code Router (handles text, photo, document)
// ═══════════════════════════════════════════════════════════════
const routeInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: '🔀 Router Message',
  config: {
    mode: 'runOnceForEachItem',
    jsCode: `const msg = $input.item.json.message;
let userMessage = '';
let inputType = 'texte';
const chatId = msg.chat.id;
const firstName = msg.from ? (msg.from.first_name || 'Utilisateur') : 'Utilisateur';

if (msg.photo && msg.photo.length > 0) {
  inputType = 'photo';
  userMessage = '[IMAGE REÇUE] ' + (msg.caption || 'Une image a été envoyée.');
} else if (msg.document) {
  inputType = 'document';
  userMessage = '[DOCUMENT REÇU] Nom: ' + msg.document.file_name +
    ' | Type: ' + msg.document.mime_type +
    ' | ' + (msg.caption || 'Analyse ce document.');
} else {
  userMessage = msg.text || msg.caption || 'Message vide';
}

return [{ json: { userMessage, inputType, chatId, firstName } }];`
  }
});

// ═══════════════════════════════════════════════════════════════
// CONVERGENCE + ACKNOWLEDGMENT
// ═══════════════════════════════════════════════════════════════
const fusionner = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: '🔗 Fusionner Messages',
  config: {
    mode: 'runOnceForEachItem',
    jsCode: 'return $input.item;'
  }
});

const ack = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: '⏳ Accusé de Réception',
  config: {
    chatId: expr("{{ $json.chatId }}"),
    text: expr("{{ '⏳ *Analyse en cours...*\\n_Je consulte vos données, ' + $json.firstName + '._' }}"),
    additionalFields: { appendAttribution: false, parse_mode: 'Markdown' }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// ═══════════════════════════════════════════════════════════════
// AI TOOLS (9 outils)
// ═══════════════════════════════════════════════════════════════
const bourseTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Bourse Marches',
  config: {
    description: 'Cours de bourse temps réel. Actions, indices, ETF, cryptos.',
    workflowId: { __rl: true, value: '7rPPrp5PYEvjZ9r9', mode: 'list' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        symbol: expr("{{ $fromAI('symbol', '', 'string') }}"),
        action: expr("{{ $fromAI('action', '', 'string') }}")
      },
      matchingColumns: [],
      schema: [
        { id: 'symbol', displayName: 'symbol', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
        { id: 'action', displayName: 'action', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
      ]
    }
  }
});

const emailsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Emails Gmail',
  config: {
    description: 'Gérer les emails professionnels.',
    workflowId: { __rl: true, value: 'Ca5Qu5otHhZ49TZj', mode: 'list' },
    workflowInputs: { mappingMode: 'defineBelow', value: { action: '', query: '', maxResults: '' } }
  }
});

const agendaTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Agenda Google',
  config: {
    description: "Gérer l'agenda Google Calendar.",
    workflowId: { __rl: true, value: 'KWRlaPxWZTSYd1W4', mode: 'list' },
    workflowInputs: { mappingMode: 'defineBelow', value: { action: '', title: '', startDateTime: '', endDateTime: '', attendees: '', daysAhead: '' } }
  }
});

const banqueTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Compte Bancaire',
  config: {
    description: 'Consulter les comptes bancaires.',
    workflowId: { __rl: true, value: 'Y7lvRuHN6iVEtGvu', mode: 'list' },
    workflowInputs: { mappingMode: 'defineBelow', value: {} }
  }
});

const actualitesTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Actualites',
  config: {
    description: 'Dernières actualités économiques et géopolitiques.',
    workflowId: { __rl: true, value: '38RWCtothZ00qQRK', mode: 'list' },
    workflowInputs: { mappingMode: 'defineBelow', value: { topic: '', maxArticles: '', language: '' } }
  }
});

const tachesTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Taches Projets',
  config: {
    description: 'Gérer les tâches et projets Notion.',
    workflowId: { __rl: true, value: '743HLfdMCjESOkJx', mode: 'list' },
    workflowInputs: { mappingMode: 'defineBelow', value: {} }
  }
});

const gmailSendTool = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  name: 'Envoyer Email Gmail',
  config: {
    descriptionType: 'manual',
    toolDescription: "Envoie un email via Gmail. Utilise TOUJOURS Contacts DB AVANT.",
    sendTo: expr("{{ $fromAI('To', '', 'string') }}"),
    subject: expr("{{ $fromAI('Subject', '', 'string') }}"),
    message: expr("{{ $fromAI('Message', '', 'string') }}"),
    options: { appendAttribution: false }
  },
  credentials: { gmailOAuth2: newCredential('Gmail OAuth2') }
});

// ★ FIX PRINCIPAL: prompt mappé via $fromAI (avant: value vide, schema vide)
const imageGenTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Generer Image',
  config: {
    description: "Générer une image avec DALL-E 3. Retourne l'URL. Inclus TOUJOURS l'URL en markdown: ![desc](URL)",
    workflowId: { __rl: true, value: 'K42AR1vlBO7XAgBc', mode: 'list' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        prompt: expr("{{ $fromAI('prompt', 'Detailed image description in English', 'string') }}")
      },
      matchingColumns: [],
      schema: [
        { id: 'prompt', displayName: 'prompt', required: true, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
      ]
    }
  }
});

const contactsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  name: 'Outil Contacts DB',
  config: {
    description: "Contacts entreprise: lookup, ajouter, list. Utilise AVANT d'envoyer un email.",
    workflowId: { __rl: true, value: 'Lu6F0Zu2umppUT0M', mode: 'list' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        action: expr("{{ $fromAI('action', 'lookup, ajouter, ou list', 'string') }}"),
        nom: expr("{{ $fromAI('nom', '', 'string') }}"),
        email: expr("{{ $fromAI('email', '', 'string') }}")
      },
      matchingColumns: [],
      schema: [
        { id: 'action', displayName: 'action', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
        { id: 'nom', displayName: 'nom', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
        { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
      ]
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// AI AGENT (GPT-4o + mémoire + 9 outils)
// ═══════════════════════════════════════════════════════════════
const aiAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  name: '🤖 CEO AI Agent',
  config: {
    promptType: 'define',
    text: expr("{{ $json.userMessage }}"),
    options: {
      systemMessage: expr(SYSTEM_PROMPT),
      maxIterations: 25,
      returnIntermediateSteps: false
    },
    subnodes: {
      model: languageModel({
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.3,
        name: '🧠 GPT-4o',
        config: {
          model: { __rl: true, value: 'gpt-4o', mode: 'id' },
          options: { maxTokens: 4096, temperature: 0.3, topP: 0.95, frequencyPenalty: 0 }
        },
        credentials: { openAiApi: newCredential('OpenAI API') }
      }),
      memory: memory({
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        version: 1.3,
        name: '🧬 Mémoire Conversation',
        config: {
          sessionIdType: 'customKey',
          sessionKey: expr("{{ $json.chatId }}"),
          contextWindowLength: 100
        }
      }),
      tools: [bourseTool, emailsTool, agendaTool, banqueTool,
              actualitesTool, tachesTool, gmailSendTool, imageGenTool, contactsTool]
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// ★ FIX: EXTRACTION D'IMAGE (regex élargi pour URLs DALL-E)
// ═══════════════════════════════════════════════════════════════
const extractImage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: '🔍 Extraire URL Image',
  config: {
    mode: 'runOnceForEachItem',
    jsCode: `const output = $input.item.json.output || '';

// 1. Markdown image syntax: ![alt](url)
const mdMatch = output.match(/!\\[[^\\]]*\\]\\((https?:[^)]+)\\)/);
if (mdMatch) {
  const url = mdMatch[1];
  const textOnly = output.replace(/!\\[[^\\]]*\\]\\(https?:[^)]+\\)/g, '').trim();
  return { json: { output: textOnly || 'Image générée', imageUrl: url, hasImage: true } };
}

// 2. DALL-E / Azure blob URLs (format: blob.core.windows.net/...)
const dalleMatch = output.match(/(https?:\\/\\/[^\\s)"']*blob\\.core\\.windows\\.net[^\\s)"']+)/);
if (dalleMatch) {
  const url = dalleMatch[1];
  const textOnly = output.replace(url, '').trim();
  return { json: { output: textOnly || 'Image générée', imageUrl: url, hasImage: true } };
}

// 3. OpenAI image URLs
const oaiMatch = output.match(/(https?:\\/\\/[^\\s)"']*openai[^\\s)"']+\\.(?:png|jpg|jpeg|gif|webp)[^\\s)"']*)/);
if (oaiMatch) {
  const url = oaiMatch[1];
  const textOnly = output.replace(url, '').trim();
  return { json: { output: textOnly || 'Image générée', imageUrl: url, hasImage: true } };
}

// 4. Any URL ending with image extension
const extMatch = output.match(/(https?:\\/\\/[^\\s)"']+\\.(?:png|jpg|jpeg|gif|webp)(?:[?#][^\\s)"']*)?)/);
if (extMatch) {
  const url = extMatch[1];
  const textOnly = output.replace(url, '').trim();
  return { json: { output: textOnly || 'Image générée', imageUrl: url, hasImage: true } };
}

// 5. No image found
return { json: { output, imageUrl: '', hasImage: false } };`
  }
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT: Télécharger image + Envoyer Photo / Envoyer Texte
// ═══════════════════════════════════════════════════════════════
const downloadImage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  name: '⬇️ Télécharger Image',
  config: {
    url: expr("{{ $json.imageUrl }}"),
    options: { response: { response: { responseFormat: 'file' } } }
  }
});

const sendPhoto = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: '📸 Envoyer Photo Telegram',
  config: {
    operation: 'sendPhoto',
    chatId: expr("{{ $('🔗 Fusionner Messages').item.json.chatId }}"),
    binaryData: true,
    additionalFields: {
      caption: expr("{{ $('🔍 Extraire URL Image').item.json.output.substring(0, 1024) }}"),
      parse_mode: 'Markdown'
    }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

const sendText = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: '📤 Réponse Texte Telegram',
  config: {
    chatId: expr("{{ $('🔗 Fusionner Messages').item.json.chatId }}"),
    text: expr("{{ $('🔍 Extraire URL Image').item.json.output.length > 4096 ? $('🔍 Extraire URL Image').item.json.output.substring(0, 4050) + '...' : $('🔍 Extraire URL Image').item.json.output }}"),
    additionalFields: {
      appendAttribution: false,
      disable_web_page_preview: true,
      parse_mode: 'Markdown'
    }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// ═══════════════════════════════════════════════════════════════
// ASSEMBLAGE
// ═══════════════════════════════════════════════════════════════
wf.add(
  tgTrigger.to(
    ifElse({
      conditions: {
        conditions: [{
          leftValue: expr("{{ $json.message.voice ? 'true' : 'false' }}"),
          rightValue: 'true',
          operator: { type: 'string', operation: 'equals' }
        }]
      }
    })
    .onTrue(getVoiceFile.to(downloadAudio).to(whisperTranscription).to(setVoiceInput).to(fusionner))
    .onFalse(routeInput.to(fusionner))
  )
);

fusionner.to(ack).to(aiAgent);
aiAgent.to(extractImage);

extractImage.to(
  ifElse({
    conditions: {
      conditions: [{
        leftValue: expr("{{ $json.hasImage }}"),
        rightValue: true,
        operator: { type: 'boolean', operation: 'true' }
      }]
    }
  })
  .onTrue(downloadImage.to(sendPhoto))
  .onFalse(sendText)
);

export default wf;
