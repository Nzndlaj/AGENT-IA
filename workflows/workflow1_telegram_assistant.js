/**
 * Workflow 1: 🤖 AGENT-IA - Assistant Telegram Ultra-Avancé
 * ID: 5MlDBVpSGfYzm3UX
 * URL: https://nz0439.app.n8n.cloud/workflow/5MlDBVpSGfYzm3UX
 *
 * Features:
 * - Telegram trigger (text, voice, image)
 * - Voice: If node → OpenAI Whisper transcription → Set node
 * - Photo/Text: Code node router avec transmission des données binaires (vision)
 * - GPT-4o AI Agent avec mémoire Postgres (multimodal + vision)
 * - Tools: Gmail (send+read), Google Calendar (read+create),
 *          Postgres contacts, NewsAPI, DALL-E 3
 * - Génération d'image: DALL-E 3 avec envoi photo Telegram direct
 *
 * Variables d'environnement nécessaires:
 * - NEWSAPI_KEY: clé API newsapi.org
 *
 * Credentials nécessaires:
 * - Telegram API
 * - OpenAI API
 * - Gmail OAuth2
 * - Google Calendar OAuth2
 * - Postgres DB
 * - OpenAI Bearer Auth (pour DALL-E)
 */

const wf = workflow('🤖 AGENT-IA - Assistant Telegram Ultra-Avancé');

const SYSTEM_PROMPT = `Tu es AGENT-IA, un assistant personnel ultra-avancé parlant français.
Tu as accès aux outils suivants:
- Envoyer Email: envoie des emails via Gmail
- Lire Emails: lit les emails Gmail
- Voir Agenda: consulte Google Calendar
- Créer Événement: ajoute un événement au calendrier
- Chercher Contact: recherche dans la base de données
- Actualités News: récupère les dernières nouvelles
- Générer Image DALL-E: crée des images avec DALL-E 3 et retourne une URL d'image
- Analyser Images: tu peux voir et analyser les images envoyées par l'utilisateur (vision GPT-4o)

Réponds TOUJOURS en français. Sois concis, précis et utile. Utilise des émojis.
Quand tu génères une image avec DALL-E, inclus obligatoirement l'URL complète de l'image dans ta réponse.`;

const tgTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.2,
  name: 'Telegram Trigger',
  config: {
    updates: ['message', 'callback_query'],
    additionalFields: { download: true, imageSize: 'large' }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// === BRANCHE VOIX: If → Whisper → Set → Agent ===
const transcribeVoice = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.1,
  name: 'Transcrire Audio',
  config: {
    resource: 'audio',
    operation: 'transcribe',
    binaryPropertyName: 'data',
    options: { language: 'fr' }
  },
  credentials: { openAiApi: newCredential('OpenAI API') }
});

const setVoiceInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  name: 'Données Vocale',
  config: {
    mode: 'manual',
    assignments: {
      assignments: [
        { id: '1', name: 'inputText', value: expr("{{ $json.text }}"), type: 'string' },
        { id: '2', name: 'inputType', value: 'voice', type: 'string' },
        { id: '3', name: 'chatId', value: expr("{{ $('Telegram Trigger').item.json.message.chat.id.toString() }}"), type: 'string' },
        { id: '4', name: 'userId', value: expr("{{ $('Telegram Trigger').item.json.message.from.id.toString() }}"), type: 'string' },
        { id: '5', name: 'username', value: expr("{{ $('Telegram Trigger').item.json.message.from.first_name || 'User' }}"), type: 'string' }
      ]
    }
  }
});

// === BRANCHE PHOTO/TEXTE: Code node avec passage des données binaires pour la vision ===
const routeInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: 'Router Message',
  config: {
    mode: 'runOnceForAllItems',
    jsCode: `const msg = $input.item.json.message;
let inputText = '';
let inputType = 'text';
const outputItem = { json: {} };

if (msg.photo && msg.photo.length > 0) {
  inputType = 'photo';
  inputText = msg.caption || 'Analysez cette image en détail';
  // Transmission des données binaires pour la vision GPT-4o
  if ($input.item.binary) {
    outputItem.binary = $input.item.binary;
  }
} else {
  inputType = 'text';
  inputText = msg.text || msg.caption || 'Message vide';
}

outputItem.json = {
  inputText,
  inputType,
  chatId: msg.chat.id.toString(),
  userId: msg.from.id.toString(),
  username: msg.from.first_name || 'Utilisateur'
};

return [outputItem];`
  }
});

// === TOOLS ===
const gmailSendTool = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  name: 'Envoyer Email',
  config: {
    resource: 'message',
    operation: 'send',
    sendTo: expr("{{ $fromAI('to', 'Email recipient', 'string') }}"),
    subject: expr("{{ $fromAI('subject', 'Email subject', 'string') }}"),
    emailType: 'html',
    message: expr("{{ $fromAI('body', 'Email body content', 'string') }}"),
    options: {}
  },
  credentials: { gmailOAuth2: newCredential('Gmail OAuth2') }
});

const gmailReadTool = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  name: 'Lire Emails',
  config: {
    resource: 'message',
    operation: 'getAll',
    returnAll: false,
    limit: 10,
    options: {}
  },
  credentials: { gmailOAuth2: newCredential('Gmail OAuth2') }
});

const calendarGetTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  name: 'Voir Agenda',
  config: {
    resource: 'event',
    operation: 'getAll',
    calendar: { __rl: true, mode: 'list', value: 'primary' },
    returnAll: false,
    limit: 20,
    options: {}
  },
  credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') }
});

const calendarCreateTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  name: 'Créer Événement',
  config: {
    resource: 'event',
    operation: 'create',
    calendar: { __rl: true, mode: 'list', value: 'primary' },
    start: expr("{{ $fromAI('start', 'Start datetime ISO8601', 'string') }}"),
    end: expr("{{ $fromAI('end', 'End datetime ISO8601', 'string') }}"),
    additionalFields: {
      summary: expr("{{ $fromAI('title', 'Event title', 'string') }}"),
      description: expr("{{ $fromAI('description', 'Event description', 'string') }}")
    }
  },
  credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') }
});

const dbSearchTool = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  name: 'Chercher Contact',
  config: {
    operation: 'executeQuery',
    query: expr("{{ 'SELECT * FROM contacts WHERE name ILIKE \\'%' + $fromAI('search', 'Name or email to search', 'string') + '%\\' LIMIT 10' }}"),
    options: {}
  },
  credentials: { postgres: newCredential('Postgres DB') }
});

const newsApiTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  name: 'Actualités News',
  config: {
    method: 'GET',
    url: 'https://newsapi.org/v2/top-headlines',
    sendQuery: true,
    queryParameters: {
      parameters: [
        { name: 'country', value: expr("{{ $fromAI('country', 'Country code: fr, us', 'string') }}") },
        { name: 'category', value: expr("{{ $fromAI('category', 'Category: business, general, technology', 'string') }}") },
        { name: 'pageSize', value: '10' },
        { name: 'apiKey', value: expr("{{ $env.NEWSAPI_KEY }}") }
      ]
    },
    options: {}
  }
});

const imageGenTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  name: 'Générer Image DALL-E',
  config: {
    method: 'POST',
    url: 'https://api.openai.com/v1/images/generations',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendBody: true,
    contentType: 'json',
    specifyBody: 'json',
    jsonBody: expr("{{ JSON.stringify({ model: 'dall-e-3', prompt: $fromAI('prompt', 'Detailed image description in English', 'string'), n: 1, size: '1024x1024' }) }}"),
    options: {}
  },
  credentials: { httpBearerAuth: newCredential('OpenAI Bearer Auth') }
});

// === AGENT IA (GPT-4o multimodal avec vision) ===
const aiAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  name: 'AGENT-IA',
  config: {
    promptType: 'define',
    text: expr("{{ $json.inputText }}"),
    options: { systemMessage: SYSTEM_PROMPT },
    subnodes: {
      model: languageModel({
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.3,
        name: 'GPT-4o',
        config: {
          model: { __rl: true, mode: 'id', value: 'gpt-4o' },
          options: {
            maxTokens: 2000,
            allowImageUploads: true
          }
        },
        credentials: { openAiApi: newCredential('OpenAI API') }
      }),
      memory: memory({
        type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
        version: 1.3,
        name: 'Mémoire Conversation',
        config: {
          sessionIdType: 'customKey',
          sessionKey: expr("{{ $json.chatId }}"),
          tableName: 'chat_memory',
          contextWindowLength: 20
        },
        credentials: { postgres: newCredential('Postgres DB') }
      }),
      tools: [gmailSendTool, gmailReadTool, calendarGetTool, calendarCreateTool, dbSearchTool, newsApiTool, imageGenTool]
    }
  }
});

// === TRAITEMENT DE LA RÉPONSE: détection URL image générée ===
const traiterReponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: 'Traiter Réponse',
  config: {
    mode: 'runOnceForAllItems',
    jsCode: `const output = $input.item.json.output || '';

// Détecter les URLs d'images générées par DALL-E
const urlRegex = /https:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|webp)(?:\?[^\s<>"]*)?/gi;
const dalleRegex = /https:\/\/oaidalleapiprodscus[^\s<>"]+/gi;

let imageUrl = null;
const dalleMatch = output.match(dalleRegex);
if (dalleMatch) {
  imageUrl = dalleMatch[0];
} else {
  const urlMatch = output.match(urlRegex);
  if (urlMatch) {
    imageUrl = urlMatch[0];
  }
}

// Récupérer le chatId depuis les branches amont
let chatId = '';
try { chatId = $('Router Message').item.json.chatId; } catch(e) {}
if (!chatId) {
  try { chatId = $('Données Vocale').item.json.chatId; } catch(e) {}
}

return [{
  json: {
    output,
    imageUrl,
    hasImage: !!imageUrl,
    chatId
  }
}];`
  }
});

// === ENVOI IMAGE: Telegram sendPhoto pour les images générées ===
const sendImageTelegram = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: 'Envoyer Image',
  config: {
    resource: 'message',
    operation: 'sendPhoto',
    chatId: expr("{{ $json.chatId }}"),
    file: expr("{{ $json.imageUrl }}"),
    additionalFields: {
      caption: expr("{{ $json.output.replace(/https:\\/\\/[^\\s]+/g, '').trim() }}")
    }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// === ENVOI TEXTE: Telegram sendMessage pour les réponses texte ===
const sendResponse = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: 'Envoyer Réponse',
  config: {
    resource: 'message',
    operation: 'sendMessage',
    chatId: expr("{{ $json.chatId }}"),
    text: expr("{{ $json.output }}"),
    additionalFields: {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// === ASSEMBLAGE ===
wf.add(
  tgTrigger.to(
    ifElse({
      conditions: {
        conditions: [{
          leftValue: expr("{{ $json.message.voice ? true : false }}"),
          operator: { type: 'boolean', operation: 'true' },
          rightValue: ''
        }]
      }
    })
    .onTrue(transcribeVoice.to(setVoiceInput).to(aiAgent))
    .onFalse(routeInput.to(aiAgent))
  )
);

// Après l'agent: détecter image ou texte, puis envoyer selon le cas
aiAgent.to(
  traiterReponse.to(
    ifElse({
      conditions: {
        conditions: [{
          leftValue: expr("{{ $json.hasImage }}"),
          operator: { type: 'boolean', operation: 'true' },
          rightValue: ''
        }]
      }
    })
    .onTrue(sendImageTelegram)
    .onFalse(sendResponse)
  )
);

export default wf;
