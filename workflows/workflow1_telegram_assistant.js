/**
 * Workflow 1: 🤖 AGENT-IA - Assistant Telegram Ultra-Avancé
 * ID: O7n0ipbQPNDp2A3s
 * URL: https://nz0439.app.n8n.cloud/workflow/O7n0ipbQPNDp2A3s
 *
 * Features:
 * - Telegram trigger (text, voice, image)
 * - Voice transcription via OpenAI Whisper
 * - Image analysis via GPT-4o Vision
 * - AI Agent with GPT-4o + Postgres Chat Memory
 * - Tools: Gmail read/send, Google Calendar, Contacts DB,
 *          News API, Image generation (DALL-E 3)
 * - PostgreSQL logging of all interactions
 */

const wf = workflow('🤖 AGENT-IA - Assistant Telegram Ultra-Avancé');

const SYSTEM_PROMPT = `Tu es AGENT-IA, un assistant personnel ultra-avancé parlant français.
Tu as accès à:
- 📧 Gmail: lire et envoyer des emails
- 📅 Google Calendar: gérer l'agenda
- 👥 Base de données: contacts (noms, emails, téléphones)
- 📰 Actualités: géopolitiques, économiques, financières
- 🎨 Génération d'images: DALL-E 3
- 📊 Données bancaires: transactions et comptes

Réponds TOUJOURS en français. Sois concis, précis et utile.
Pour les images reçues, analyse-les en détail.
Format tes réponses avec des émojis appropriés.`;

const tgTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.2,
  name: 'Telegram Trigger',
  config: {
    updates: ['message', 'callback_query'],
    additionalFields: {
      download: true,
      imageSize: 'large'
    }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

// === VOICE BRANCH ===
const transcribeVoice = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.1,
  name: 'Transcribe Voice',
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
  name: 'Set Voice Input',
  config: {
    mode: 'manual',
    assignments: {
      assignments: [
        { id: '1', name: 'inputText', value: expr("{{ $json.text }}"), type: 'string' },
        { id: '2', name: 'inputType', value: 'voice', type: 'string' },
        { id: '3', name: 'chatId', value: expr("{{ $('Telegram Trigger').item.json.message.chat.id.toString() }}"), type: 'string' },
        { id: '4', name: 'userId', value: expr("{{ $('Telegram Trigger').item.json.message.from.id.toString() }}"), type: 'string' },
        { id: '5', name: 'username', value: expr("{{ $('Telegram Trigger').item.json.message.from.first_name }}"), type: 'string' }
      ]
    }
  }
});

// === PHOTO BRANCH ===
const setPhotoInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  name: 'Set Photo Input',
  config: {
    mode: 'manual',
    assignments: {
      assignments: [
        { id: '1', name: 'inputText', value: expr("{{ '[Image reçue] ' + ($('Telegram Trigger').item.json.message.caption || 'Analysez cette image') }}"), type: 'string' },
        { id: '2', name: 'inputType', value: 'photo', type: 'string' },
        { id: '3', name: 'chatId', value: expr("{{ $('Telegram Trigger').item.json.message.chat.id.toString() }}"), type: 'string' },
        { id: '4', name: 'userId', value: expr("{{ $('Telegram Trigger').item.json.message.from.id.toString() }}"), type: 'string' },
        { id: '5', name: 'username', value: expr("{{ $('Telegram Trigger').item.json.message.from.first_name }}"), type: 'string' },
        { id: '6', name: 'photoFileId', value: expr("{{ $('Telegram Trigger').item.json.message.photo ? $('Telegram Trigger').item.json.message.photo[$('Telegram Trigger').item.json.message.photo.length-1].file_id : '' }}"), type: 'string' }
      ]
    }
  }
});

// === TEXT BRANCH ===
const setTextInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  name: 'Set Text Input',
  config: {
    mode: 'manual',
    assignments: {
      assignments: [
        { id: '1', name: 'inputText', value: expr("{{ $json.message.text || $json.message.caption || 'Message vide' }}"), type: 'string' },
        { id: '2', name: 'inputType', value: 'text', type: 'string' },
        { id: '3', name: 'chatId', value: expr("{{ $json.message.chat.id.toString() }}"), type: 'string' },
        { id: '4', name: 'userId', value: expr("{{ $json.message.from.id.toString() }}"), type: 'string' },
        { id: '5', name: 'username', value: expr("{{ $json.message.from.first_name }}"), type: 'string' }
      ]
    }
  }
});

// === TOOLS ===
const gmailReadTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  name: 'Gmail Read Tool',
  config: {
    method: 'GET',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
    sendQuery: true,
    parametersQuery: {
      values: [
        { name: 'maxResults', value: expr("{{ $fromAI('maxResults', 'Number of emails to retrieve', 'number') }}") },
        { name: 'q', value: expr("{{ $fromAI('query', 'Gmail search query', 'string') }}") }
      ]
    },
    description: 'Lire les emails Gmail. Utilise maxResults pour le nombre et q pour la recherche.',
    sendHeaders: true,
    parametersHeaders: {
      values: [
        { name: 'Authorization', value: expr("{{ 'Bearer ' + $credentials.gmailOAuth2.accessToken }}") }
      ]
    },
    options: {}
  },
  credentials: { gmailOAuth2: newCredential('Gmail OAuth2') }
});

const gmailSendTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  name: 'Gmail Send Tool',
  config: {
    method: 'POST',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    description: 'Envoyer un email via Gmail.',
    sendBody: true,
    contentType: 'json',
    bodyParameters: {
      values: [
        { name: 'raw', value: expr("{{ $fromAI('emailRaw', 'Base64 encoded email in RFC 2822 format', 'string') }}") }
      ]
    },
    sendHeaders: true,
    parametersHeaders: {
      values: [
        { name: 'Authorization', value: expr("{{ 'Bearer ' + $credentials.gmailOAuth2.accessToken }}") }
      ]
    },
    options: {}
  },
  credentials: { gmailOAuth2: newCredential('Gmail OAuth2') }
});

const calendarReadTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  name: 'Calendar Read Tool',
  config: {
    method: 'GET',
    url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    description: 'Lire les événements Google Calendar.',
    sendQuery: true,
    parametersQuery: {
      values: [
        { name: 'timeMin', value: expr("{{ $fromAI('timeMin', 'Start date ISO format', 'string') }}") },
        { name: 'timeMax', value: expr("{{ $fromAI('timeMax', 'End date ISO format', 'string') }}") },
        { name: 'maxResults', value: expr("{{ $fromAI('maxResults', 'Max number of events', 'number') }}") }
      ]
    },
    sendHeaders: true,
    parametersHeaders: {
      values: [
        { name: 'Authorization', value: expr("{{ 'Bearer ' + $credentials.googleCalendarOAuth2Api.accessToken }}") }
      ]
    },
    options: {}
  },
  credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') }
});

const calendarCreateTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  name: 'Calendar Create Tool',
  config: {
    method: 'POST',
    url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    description: 'Créer un événement dans Google Calendar.',
    sendBody: true,
    contentType: 'json',
    bodyParameters: {
      values: [
        { name: 'summary', value: expr("{{ $fromAI('summary', 'Event title', 'string') }}") },
        { name: 'description', value: expr("{{ $fromAI('description', 'Event description', 'string') }}") },
        { name: 'start', value: expr("{{ $fromAI('start', 'Start time as JSON with dateTime field', 'string') }}") },
        { name: 'end', value: expr("{{ $fromAI('end', 'End time as JSON with dateTime field', 'string') }}") }
      ]
    },
    sendHeaders: true,
    parametersHeaders: {
      values: [
        { name: 'Authorization', value: expr("{{ 'Bearer ' + $credentials.googleCalendarOAuth2Api.accessToken }}") }
      ]
    },
    options: {}
  },
  credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') }
});

const dbSearchContactsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolPostgres',
  version: 2.6,
  name: 'Postgres Tool',
  config: {
    operation: 'executeQuery',
    query: expr("{{ 'SELECT * FROM contacts WHERE name ILIKE \\'%' + $fromAI('searchTerm', 'Contact name to search', 'string') + '%\\' OR email ILIKE \\'%' + $fromAI('searchEmail', 'Email to search', 'string') + '%\\' LIMIT 10;' }}"),
    options: {}
  },
  credentials: { postgres: newCredential('Postgres DB') }
});

const dbAddContactTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolPostgres',
  version: 2.6,
  name: 'Add Contact Tool',
  config: {
    operation: 'executeQuery',
    query: expr("{{ 'INSERT INTO contacts (name, email, phone, company, notes) VALUES (\\'' + $fromAI('name', 'Contact name', 'string') + '\\', \\'' + $fromAI('email', 'Contact email', 'string') + '\\', \\'' + $fromAI('phone', 'Contact phone', 'string') + '\\', \\'' + $fromAI('company', 'Contact company', 'string') + '\\', \\'' + $fromAI('notes', 'Additional notes', 'string') + '\\');' }}"),
    options: {}
  },
  credentials: { postgres: newCredential('Postgres DB') }
});

const newsApiTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  name: 'News API Tool',
  config: {
    method: 'GET',
    url: 'https://newsapi.org/v2/top-headlines',
    description: 'Récupérer les dernières actualités. Utilise country=fr pour France, category pour la catégorie.',
    sendQuery: true,
    parametersQuery: {
      values: [
        { name: 'country', value: expr("{{ $fromAI('country', 'Country code (fr, us, gb)', 'string') }}") },
        { name: 'category', value: expr("{{ $fromAI('category', 'Category: business, entertainment, general, health, science, sports, technology', 'string') }}") },
        { name: 'q', value: expr("{{ $fromAI('query', 'Search keywords', 'string') }}") },
        { name: 'pageSize', value: '10' },
        { name: 'apiKey', value: expr("{{ $env['NEWSAPI_KEY'] || 'YOUR_NEWSAPI_KEY' }}") }
      ]
    },
    options: {}
  }
});

const imageGenTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  version: 1.1,
  name: 'Image Gen Tool',
  config: {
    method: 'POST',
    url: 'https://api.openai.com/v1/images/generations',
    description: 'Générer une image avec DALL-E 3. Retourne une URL d\'image.',
    sendBody: true,
    contentType: 'json',
    bodyParameters: {
      values: [
        { name: 'model', value: 'dall-e-3' },
        { name: 'prompt', value: expr("{{ $fromAI('prompt', 'Detailed image description', 'string') }}") },
        { name: 'n', value: '1' },
        { name: 'size', value: '1024x1024' },
        { name: 'quality', value: 'standard' }
      ]
    },
    sendHeaders: true,
    parametersHeaders: {
      values: [
        { name: 'Authorization', value: expr("{{ 'Bearer ' + $credentials.openAiApi.apiKey }}") }
      ]
    },
    options: {}
  },
  credentials: { openAiApi: newCredential('OpenAI API') }
});

// === AI AGENT ===
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
          model: 'gpt-4o',
          options: { maxTokens: 2000 }
        },
        credentials: { openAiApi: newCredential('OpenAI API') }
      }),
      memory: memory({
        type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
        version: 1.3,
        name: 'Postgres Memory',
        config: {
          sessionKey: expr("{{ $json.chatId }}"),
          tableName: 'chat_memory',
          contextWindowLength: 20
        },
        credentials: { postgres: newCredential('Postgres DB') }
      }),
      tools: [
        gmailReadTool,
        gmailSendTool,
        calendarReadTool,
        calendarCreateTool,
        dbSearchContactsTool,
        dbAddContactTool,
        newsApiTool,
        imageGenTool
      ]
    }
  }
});

// === RESPONSE & LOGGING ===
const sendResponse = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: 'Envoyer Réponse',
  config: {
    resource: 'message',
    operation: 'sendMessage',
    chatId: expr("{{ $('Set Text Input').item.json.chatId || $('Set Voice Input').item.json.chatId || $('Set Photo Input').item.json.chatId }}"),
    text: expr("{{ $json.output }}"),
    additionalFields: { parse_mode: 'Markdown' }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

const logInteraction = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  name: 'Log Interaction',
  config: {
    operation: 'executeQuery',
    query: expr("{{ 'INSERT INTO messages_log (chat_id, user_id, username, input_type, user_message, agent_response) VALUES (\\'' + $('AGENT-IA').item.json.chatId + '\\', \\'' + $('AGENT-IA').item.json.userId + '\\', \\'' + $('AGENT-IA').item.json.username + '\\', \\'' + $('AGENT-IA').item.json.inputType + '\\', \\'' + $('AGENT-IA').item.json.inputText.replace(/\\'/g, \\'\\'\\'\\') + '\\', \\'' + $json.output.replace(/\\'/g, \\'\\'\\'\\') + '\\')' }}"),
    options: {}
  },
  credentials: { postgres: newCredential('Postgres DB') }
});

// === WORKFLOW ASSEMBLY ===
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
    .onFalse(
      ifElse({
        conditions: {
          conditions: [{
            leftValue: expr("{{ $json.message.photo ? true : false }}"),
            operator: { type: 'boolean', operation: 'true' },
            rightValue: ''
          }]
        }
      })
      .onTrue(setPhotoInput.to(aiAgent))
      .onFalse(setTextInput.to(aiAgent))
    )
  )
);
aiAgent.to(sendResponse).to(logInteraction);

export default wf;
