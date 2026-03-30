/**
 * Workflow 2: 📰 AGENT-IA - Digest Quotidien d'Actualités
 * ID: a3wHe12IXszsv0f6
 * URL: https://nz0439.app.n8n.cloud/workflow/a3wHe12IXszsv0f6
 *
 * Déclenchement: Lun-Ven à 8h00
 * NewsAPI → GPT-4o → Telegram + Gmail + Postgres
 */

const wf = workflow('📰 AGENT-IA - Digest Quotidien d\'Actualités');

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  name: 'Schedule 8h Lun-Ven',
  config: {
    rule: {
      interval: [{
        field: 'weeks',
        weeksInterval: 1,
        triggerAtDay: [1, 2, 3, 4, 5],
        triggerAtHour: 8,
        triggerAtMinute: 0
      }]
    }
  }
});

const fetchAllNews = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  name: 'Récupérer Actualités',
  config: {
    mode: 'runOnceForAllItems',
    jsCode: `const apiKey = $env.NEWSAPI_KEY || 'YOUR_KEY';
let frArticles = [], worldArticles = [];
try {
  const fr = await $helpers.httpRequest({ method: 'GET', url: 'https://newsapi.org/v2/top-headlines?country=fr&pageSize=10&apiKey=' + apiKey });
  frArticles = fr.articles || [];
} catch(e) {}
try {
  const world = await $helpers.httpRequest({ method: 'GET', url: 'https://newsapi.org/v2/top-headlines?q=economy+finance+geopolitics&language=fr&pageSize=10&apiKey=' + apiKey });
  worldArticles = world.articles || [];
} catch(e) {}
const frNews = frArticles.map(a => a.title + ': ' + (a.description || '')).join('\\n');
const worldNews = worldArticles.map(a => a.title + ': ' + (a.description || '')).join('\\n');
return [{ json: {
  digestPrompt: 'Crée un digest complet en français:\\n\\n=== ACTUALITÉS FRANÇAISES ===\\n' + frNews + '\\n\\n=== ACTUALITÉS MONDIALES ===\\n' + worldNews + '\\n\\nFormate avec des sections claires et émojis.',
  digestDate: new Date().toISOString().split('T')[0]
}}];`
  }
});

const aiDigestAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  name: 'Agent Digest IA',
  config: {
    promptType: 'define',
    text: expr("{{ $json.digestPrompt }}"),
    options: {
      systemMessage: `Tu es un expert en actualités géopolitiques, économiques et financières.
Structure ton digest:
🌍 FRANCE - Top 5 actualités françaises
💰 ÉCONOMIE & FINANCE - Marchés mondiaux
🌐 GÉOPOLITIQUE - Relations internationales
📊 RÉSUMÉ - 3 points clés

Sois concis, factuel et analytique. Réponds en français.`
    },
    subnodes: {
      model: languageModel({
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.3,
        name: 'GPT-4o Digest',
        config: {
          model: { __rl: true, mode: 'id', value: 'gpt-4o' },
          options: { maxTokens: 3000 }
        },
        credentials: { openAiApi: newCredential('OpenAI API') }
      })
    }
  }
});

const setDigestOutput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  name: 'Formater Digest',
  config: {
    mode: 'manual',
    assignments: {
      assignments: [
        { id: '1', name: 'digestContent', value: expr("{{ $json.output }}"), type: 'string' },
        { id: '2', name: 'digestDate', value: expr("{{ $('Récupérer Actualités').item.json.digestDate }}"), type: 'string' },
        { id: '3', name: 'telegramMessage', value: expr("{{ '📰 *DIGEST - ' + $('Récupérer Actualités').item.json.digestDate + '*\\n\\n' + $json.output }}"), type: 'string' }
      ]
    }
  }
});

const sendTelegram = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  name: 'Envoyer Digest Telegram',
  config: {
    resource: 'message',
    operation: 'sendMessage',
    chatId: expr("{{ $env.TELEGRAM_CHAT_ID }}"),
    text: expr("{{ $json.telegramMessage }}"),
    additionalFields: { parse_mode: 'Markdown' }
  },
  credentials: { telegramApi: newCredential('Telegram API') }
});

const sendEmailDigest = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  name: 'Envoyer Digest Email',
  config: {
    resource: 'message',
    operation: 'send',
    sendTo: expr("{{ $env.EMAIL_DIGEST }}"),
    subject: expr("{{ '📰 Digest Quotidien - ' + $json.digestDate }}"),
    emailType: 'text',
    message: expr("{{ $json.digestContent }}"),
    options: {}
  },
  credentials: { gmailOAuth2: newCredential('Gmail OAuth2') }
});

const saveDigestToDB = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  name: 'Sauvegarder en DB',
  config: {
    operation: 'insert',
    schema: { __rl: true, mode: 'name', value: 'public' },
    table: { __rl: true, mode: 'name', value: 'news_digest' },
    columns: 'autoMapInputData',
    options: {}
  },
  credentials: { postgres: newCredential('Postgres DB') }
});

wf.add(
  scheduleTrigger
    .to(fetchAllNews)
    .to(aiDigestAgent)
    .to(setDigestOutput)
    .to(sendTelegram)
    .to(sendEmailDigest)
    .to(saveDigestToDB)
);

export default wf;
