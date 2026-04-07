-- ============================================================
-- AGENT-IA B2B PROSPECTING — Schema PostgreSQL
-- Exécuter ce script une seule fois pour initialiser la BDD
-- ============================================================

-- Table principale des leads
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    -- Identité
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    linkedin_url VARCHAR(500),
    phone VARCHAR(50),
    -- Poste
    job_title VARCHAR(200),
    seniority VARCHAR(50), -- 'C-Level', 'VP', 'Director', 'Manager', 'Individual'
    department VARCHAR(100), -- 'Marketing', 'Sales', 'Tech', 'HR', 'Finance'
    -- Entreprise
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    company_size VARCHAR(50), -- '1-10', '11-50', '51-200', '201-500', '500+'
    company_industry VARCHAR(100),
    company_revenue VARCHAR(50),
    company_location VARCHAR(255),
    company_linkedin VARCHAR(500),
    company_description TEXT,
    -- Scoring
    score INTEGER DEFAULT 0, -- 0-100
    score_label VARCHAR(20) DEFAULT 'froid', -- 'chaud', 'tiede', 'froid'
    score_details JSONB DEFAULT '{}',
    -- Statut pipeline
    status VARCHAR(50) DEFAULT 'new',
    -- new -> qualified -> contacted -> replied -> meeting_booked -> converted -> lost
    -- Source
    source VARCHAR(50), -- 'google_maps', 'linkedin', 'apollo', 'manual', 'referral'
    source_query TEXT, -- la recherche qui a trouvé ce lead
    -- RGPD
    consent_status VARCHAR(20) DEFAULT 'legitimate_interest',
    opt_out BOOLEAN DEFAULT FALSE,
    opt_out_date TIMESTAMP,
    data_retention_until DATE,
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_contacted_at TIMESTAMP,
    next_followup_at TIMESTAMP,
    assigned_to VARCHAR(100) DEFAULT 'auto',
    tags TEXT[] DEFAULT '{}',
    notes TEXT
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at);
CREATE INDEX IF NOT EXISTS idx_leads_opt_out ON leads(opt_out);

-- Séquences d'outreach (templates de campagnes)
CREATE TABLE IF NOT EXISTS outreach_sequences (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    channel VARCHAR(20) DEFAULT 'email', -- 'email', 'linkedin', 'multi'
    steps JSONB NOT NULL DEFAULT '[]',
    -- Ex: [{"step":1,"delay_days":0,"type":"email","template_id":1},
    --      {"step":2,"delay_days":3,"type":"email","template_id":2},
    --      {"step":3,"delay_days":5,"type":"linkedin","template_id":3}]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Templates de messages
CREATE TABLE IF NOT EXISTS message_templates (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER REFERENCES outreach_sequences(id),
    step_number INTEGER,
    channel VARCHAR(20) DEFAULT 'email',
    subject_template TEXT, -- avec variables {{first_name}}, {{company_name}}, etc.
    body_template TEXT,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    performance_stats JSONB DEFAULT '{"sent":0,"opened":0,"replied":0,"positive":0}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Messages envoyés (historique)
CREATE TABLE IF NOT EXISTS outreach_messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    sequence_id INTEGER REFERENCES outreach_sequences(id),
    step_number INTEGER,
    channel VARCHAR(20), -- 'email', 'linkedin'
    direction VARCHAR(10) DEFAULT 'outbound', -- 'outbound', 'inbound'
    subject TEXT,
    body TEXT,
    -- Tracking
    status VARCHAR(30) DEFAULT 'sent',
    -- sent -> delivered -> opened -> clicked -> replied
    sent_at TIMESTAMP DEFAULT NOW(),
    opened_at TIMESTAMP,
    replied_at TIMESTAMP,
    -- Analyse IA de la réponse
    reply_sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative', 'question', 'out_of_office'
    reply_intent VARCHAR(30), -- 'interested', 'not_interested', 'more_info', 'refer', 'unsubscribe'
    reply_body TEXT,
    ai_suggested_response TEXT,
    -- Metadata
    message_id VARCHAR(255), -- ID email pour tracking
    thread_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON outreach_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON outreach_messages(status);

-- Rendez-vous bookés
CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    calendar_event_id VARCHAR(255),
    meeting_type VARCHAR(50) DEFAULT 'discovery', -- 'discovery', 'demo', 'closing'
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    meeting_link VARCHAR(500),
    status VARCHAR(30) DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'
    notes TEXT,
    outcome TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Campagnes (pour A/B testing et analytics)
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    target_criteria JSONB, -- critères ICP
    sequence_id INTEGER REFERENCES outreach_sequences(id),
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
    stats JSONB DEFAULT '{"leads_total":0,"contacted":0,"replied":0,"meetings":0,"converted":0}',
    ab_variant VARCHAR(10), -- 'A', 'B' pour A/B testing
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Log d'activité (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'lead_created', 'email_sent', 'reply_received', 'meeting_booked'
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);

-- Vue pour le dashboard
CREATE OR REPLACE VIEW pipeline_dashboard AS
SELECT
    status,
    score_label,
    COUNT(*) as count,
    AVG(score) as avg_score,
    COUNT(*) FILTER (WHERE last_contacted_at > NOW() - INTERVAL '7 days') as contacted_last_7d,
    COUNT(*) FILTER (WHERE opt_out = TRUE) as opted_out
FROM leads
WHERE opt_out = FALSE
GROUP BY status, score_label
ORDER BY
    CASE status
        WHEN 'converted' THEN 1
        WHEN 'meeting_booked' THEN 2
        WHEN 'replied' THEN 3
        WHEN 'contacted' THEN 4
        WHEN 'qualified' THEN 5
        WHEN 'new' THEN 6
        WHEN 'lost' THEN 7
    END;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Fonction RGPD : purge des données expirées
CREATE OR REPLACE FUNCTION purge_expired_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM leads
    WHERE data_retention_until < CURRENT_DATE
    AND opt_out = TRUE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';
