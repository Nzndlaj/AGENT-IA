/**
 * Workflow 1: AGENT-IA - Assistant Telegram avec Envoi de Photos
 * ID: 5MlDBVpSGfYzm3UX
 * URL: https://nz0439.app.n8n.cloud/workflow/5MlDBVpSGfYzm3UX
 *
 * Features:
 * - Telegram trigger (text, voice, image)
 * - Voice: IF node -> OpenAI Whisper -> Set -> Agent
 * - Photo/Text: Code router -> Agent
 * - GPT-4o AI Agent avec memoire Postgres
 * - Tools: Gmail (send+read), Google Calendar (read+create),
 *          Postgres contacts, NewsAPI, DALL-E 3
 * - NOUVEAU: Detection automatique d'URL image dans la reponse de l'agent
 *            -> Envoi comme Photo Telegram (sendPhoto) avec caption
 *            -> Sinon envoi comme Texte (sendMessage)
 *
 * Variables d'environnement necessaires:
 * - NEWSAPI_KEY: cle API newsapi.org
 *
 * Credentials necessaires:
 * - Telegram API
 * - OpenAI API
 * - Gmail OAuth2
 * - Google Calendar OAuth2
 * - Postgres DB
 * - OpenAI Bearer Auth (pour DALL-E)
 */

import { workflow, node, trigger, newCredential, ifElse, languageModel, memory, tool, expr } from '@n8n/workflow-sdk';

const SYSTEM_PROMPT = `Tu es AGENT-IA, un assistant personnel ultra-avance parlant francais.
Tu as acces aux outils suivants:
- Envoyer Email: envoie des emails via Gmail
- Lire Emails: lit les emails Gmail
- Voir Agenda: consulte Google Calendar
- Creer Evenement: ajoute un evenement au calendrier
- Chercher Contact: recherche dans la base de donnees
- Actualites News: recupere les dernieres nouvelles
- Generer Image DALL-E: cree des images avec DALL-E 3

IMPORTANT: Quand tu generes une image avec DALL-E, inclus l URL complete de l image dans ta reponse, elle sera automatiquement envoyee comme photo.

Reponds TOUJOURS en francais. Sois concis, precis et utile. Utilise des emojis.`;

const tgTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.2,
  config: {
    name: 'Telegram Trigger',
    parameters: {
      updates: ['message', 'callback_query'],
      additionalFields: { download: true, imageSize: 'large' }
    },
    credentials: { telegramApi: newCredential('Telegram API') },
    position: [100, 300]
  },
  output: [{ message: { chat: { id: 123 }, from: { id: 1, first_name: 'User' }, text: 'Bonjour', voice: null } }]
});

const checkIfVoice = ifElse({
  version: 2.2,
  config: {
    name: 'Est Message Vocal',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{
          id: 'cond-voice',
          leftValue: expr('{{ $json.message.voice ? true : false }}'),
          operator: { type: 'boolean', operation: 'true' },
          rightValue: ''
        }],
        combinator: 'and'
      }
    },
    position: [320, 300]
  }
});

const transcribeVoice = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.1,
  config: {
    name: 'Transcrire Audio',
    parameters: {
      resource: 'audio',
      operation: 'transcribe',
      binaryPropertyName: 'data',
      options: { language: 'fr' }
    },
    credentials: { openAiApi: newCredential('OpenAI API') },
    position: [540, 180]
  },
  output: [{ text: 'Texte transcrit' }]
});

const setVoiceInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Donnees Vocale',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: '1', name: 'inputText', value: expr('{{ $json.text }}'), type: 'string' },
          { id: '2', name: 'inputType', value: 'voice', type: 'string' },
          { id: '3', name: 'chatId', value: expr("{{ $('Telegram Trigger').item.json.message.chat.id.toString() }}"), type: 'string' },
          { id: '4', name: 'userId', value: expr("{{ $('Telegram Trigger').item.json.message.from.id.toString() }}"), type: 'string' },
          { id: '5', name: 'username', value: expr("{{ $('Telegram Trigger').item.json.message.from.first_name || 'User' }}"), type: 'string' }
        ]
      }
    },
    position: [760, 180]
  },
  output: [{ inputText: 'Texte', inputType: 'voice', chatId: '123', userId: '1', username: 'User' }]
});

const routeInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Router Message',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const msg = $input.item.json.message;\nlet inputText = '';\nlet inputType = 'text';\nif (msg.photo && msg.photo.length > 0) {\n  inputType = 'photo';\n  inputText = '[IMAGE RECUE] ' + (msg.caption || 'Analysez cette image en detail');\n} else {\n  inputType = 'text';\n  inputText = msg.text || msg.caption || 'Message vide';\n}\nreturn [{ json: {\n  inputText, inputType,\n  chatId: msg.chat.id.toString(),\n  userId: msg.from.id.toString(),\n  username: msg.from.first_name || 'Utilisateur'\n}}];"
    },
    position: [540, 420]
  },
  output: [{ inputText: 'Bonjour', inputType: 'text', chatId: '123', userId: '1', username: 'User' }]
});

const gmailSendTool = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  config: {
    name: 'Envoyer Email',
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr("{{ $fromAI('to', 'Email recipient', 'string') }}"),
      subject: expr("{{ $fromAI('subject', 'Email subject', 'string') }}"),
      emailType: 'html',
      message: expr("{{ $fromAI('body', 'Email body content', 'string') }}"),
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail OAuth2') },
    position: [760, 720]
  }
});

const gmailReadTool = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  config: {
    name: 'Lire Emails',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: false,
      limit: 10
    },
    credentials: { gmailOAuth2: newCredential('Gmail OAuth2') },
    position: [860, 720]
  }
});

const calendarGetTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Voir Agenda',
    parameters: {
      resource: 'event',
      operation: 'getAll',
      calendar: { __rl: true, mode: 'list', value: 'primary' },
      returnAll: false,
      limit: 20,
      options: {}
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') },
    position: [960, 720]
  }
});

const calendarCreateTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Creer Evenement',
    parameters: {
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
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') },
    position: [1060, 720]
  }
});

const dbSearchTool = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: 'Chercher Contact',
    parameters: {
      operation: 'executeQuery',
      query: expr("{{ 'SELECT * FROM contacts WHERE name ILIKE \\'%' + $fromAI('search', 'Name or email to search', 'string') + '%\\' LIMIT 10' }}"),
      options: {}
    },
    credentials: { postgres: newCredential('Postgres DB') },
    position: [1160, 720]
  }
});

const newsApiTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'Actualites News',
    parameters: {
      method: 'GET',
      url: 'https://newsapi.org/v2/top-headlines',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'country', value: expr("{{ $fromAI('country', 'Country code: fr, us', 'string') }}") },
          { name: 'category', value: expr("{{ $fromAI('category', 'Category: business, general, technology', 'string') }}") },
          { name: 'pageSize', value: '10' },
          { name: 'apiKey', value: expr('{{ $env.NEWSAPI_KEY }}') }
        ]
      },
      options: {}
    },
    position: [1260, 720]
  }
});

const imageGenTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'Generer Image DALL-E',
    parameters: {
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
    credentials: { httpBearerAuth: newCredential('OpenAI Bearer Auth') },
    position: [1360, 720]
  }
});

const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-4o',
    parameters: {
      model: { __rl: true, mode: 'id', value: 'gpt-4o' },
      options: { maxTokens: 2000 }
    },
    credentials: { openAiApi: newCredential('OpenAI API') },
    position: [760, 620]
  }
});

const chatMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.3,
  config: {
    name: 'Memoire Conversation',
    parameters: {
      sessionIdType: 'customKey',
      sessionKey: expr('{{ $json.chatId }}'),
      tableName: 'chat_memory',
      contextWindowLength: 20
    },
    credentials: { postgres: newCredential('Postgres DB') },
    position: [860, 620]
  }
});

const aiAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AGENT-IA',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.inputText }}'),
      options: { systemMessage: SYSTEM_PROMPT }
    },
    subnodes: {
      model: openAiModel,
      memory: chatMemory,
      tools: [gmailSendTool, gmailReadTool, calendarGetTool, calendarCreateTool, dbSearchTool, newsApiTool, imageGenTool]
    },
    position: [980, 300]
  },
  output: [{ output: 'Voici votre image: https://oaidalleapiprodscus.blob.core.windows.net/private/xxx.png' }]
});

const detectImage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Detecter Image',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const item = $input.item.json;\nconst output = item.output || '';\n\nlet chatId = '';\ntry { chatId = $('Donnees Vocale').item.json.chatId; } catch(e) {}\nif (!chatId) { try { chatId = $('Router Message').item.json.chatId; } catch(e) {} }\n\nconst dalleRegex = /https?:\\/\\/oaidalleapiprodscus\\.blob\\.core\\.windows\\.net\\/[^\\s<>\"\\)]+/gi;\nconst imgRegex = /https?:\\/\\/[^\\s<>\"\\)]+\\.(?:png|jpg|jpeg|gif|webp)(?:\\?[^\\s<>\"\\)]*)?/gi;\n\nconst dalleMatches = output.match(dalleRegex);\nconst imgMatches = output.match(imgRegex);\n\nlet imageUrl = null;\nif (dalleMatches && dalleMatches.length > 0) imageUrl = dalleMatches[0];\nelse if (imgMatches && imgMatches.length > 0) imageUrl = imgMatches[0];\n\nlet caption = output.replace(dalleRegex, '').replace(imgRegex, '').replace(/\\n{3,}/g, '\\n\\n').trim();\nif (!caption) caption = 'Image generee par DALL-E 3';\nif (caption.length > 1024) caption = caption.substring(0, 1021) + '...';\n\nreturn [{ json: { output, imageUrl, hasImage: imageUrl !== null, caption, chatId } }];"
    },
    position: [1200, 300]
  },
  output: [{ output: 'Voici votre image', imageUrl: 'https://oaidalleapiprodscus.blob.core.windows.net/private/xxx.png', hasImage: true, caption: 'Voici votre image', chatId: '123' }]
});

const checkHasImage = ifElse({
  version: 2.2,
  config: {
    name: 'Contient Image',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{
          id: 'cond-has-image',
          leftValue: expr('{{ $json.hasImage }}'),
          operator: { type: 'boolean', operation: 'true' },
          rightValue: ''
        }],
        combinator: 'and'
      }
    },
    position: [1420, 300]
  }
});

const sendPhoto = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Envoyer Photo',
    parameters: {
      resource: 'message',
      operation: 'sendPhoto',
      chatId: expr('{{ $json.chatId }}'),
      binaryData: false,
      file: expr('{{ $json.imageUrl }}'),
      additionalFields: {
        caption: expr('{{ $json.caption }}'),
        parse_mode: 'Markdown'
      }
    },
    credentials: { telegramApi: newCredential('Telegram API') },
    position: [1640, 200]
  },
  output: [{ ok: true }]
});

const sendMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Envoyer Texte',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chatId }}'),
      text: expr('{{ $json.output }}'),
      additionalFields: {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }
    },
    credentials: { telegramApi: newCredential('Telegram API') },
    position: [1640, 400]
  },
  output: [{ ok: true }]
});

export default workflow('5MlDBVpSGfYzm3UX', 'AGENT-IA - Assistant Telegram avec Photos')
  .add(tgTrigger)
  .to(checkIfVoice
    .onTrue(transcribeVoice.to(setVoiceInput).to(aiAgent))
    .onFalse(routeInput.to(aiAgent))
  )
  .add(aiAgent)
  .to(detectImage)
  .to(checkHasImage
    .onTrue(sendPhoto)
    .onFalse(sendMessage)
  );
