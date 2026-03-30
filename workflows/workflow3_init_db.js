/**
 * Workflow 3: 🗄️ AGENT-IA - Initialisation Base de Données
 * ID: eWftCxbGtzkqzf43
 * URL: https://nz0439.app.n8n.cloud/workflow/eWftCxbGtzkqzf43
 *
 * À exécuter UNE SEULE FOIS pour créer toutes les tables.
 * Configurer la credential "Postgres DB" avant d'exécuter.
 *
 * Tables créées:
 * - contacts (id, name, email, phone, company, notes, created_at)
 * - messages_log (id, chat_id, user_id, username, input_type, user_message, agent_response, created_at)
 * - news_digest (id, category, title, content, source, published_at, created_at)
 * - chat_memory (id, session_id, message, created_at) + index
 * - bank_transactions (id, account, amount, currency, description, transaction_date, category, created_at)
 */

const wf = workflow('🗄️ AGENT-IA - Initialisation Base de Données');

const manualTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  name: 'Démarrer Init DB',
  config: {}
});

const initAllTables = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  name: 'Créer Toutes les Tables',
  config: {
    operation: 'executeQuery',
    // COLLER CETTE REQUÊTE SQL DANS LE NŒUD POSTGRES:
    query: `CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS messages_log (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(100),
  user_id VARCHAR(100),
  username VARCHAR(255),
  input_type VARCHAR(20) DEFAULT 'text',
  user_message TEXT,
  agent_response TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS news_digest (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100),
  title VARCHAR(500),
  content TEXT,
  source VARCHAR(255),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chat_memory (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_memory_session ON chat_memory(session_id);
CREATE TABLE IF NOT EXISTS bank_transactions (
  id SERIAL PRIMARY KEY,
  account VARCHAR(255),
  amount DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'EUR',
  description TEXT,
  transaction_date DATE,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);`,
    options: {}
  },
  credentials: { postgres: newCredential('Postgres DB') }
});

const confirmInit = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  name: 'Confirmation Init',
  config: {
    mode: 'manual',
    assignments: {
      assignments: [
        { id: '1', name: 'status', value: 'success', type: 'string' },
        { id: '2', name: 'message', value: 'Base de données AGENT-IA initialisée: contacts, messages_log, news_digest, chat_memory, bank_transactions', type: 'string' },
        { id: '3', name: 'timestamp', value: expr("{{ $now.toISO() }}"), type: 'string' }
      ]
    }
  }
});

wf.add(manualTrigger.to(initAllTables).to(confirmInit));

export default wf;
