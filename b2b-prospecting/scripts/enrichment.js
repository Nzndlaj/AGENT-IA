// ============================================================
// ENRICHMENT HELPERS — Pour node "Code" N8N
// Fonctions utilitaires pour enrichir les données des leads
// ============================================================

/**
 * Nettoyer et normaliser les données d'un lead scrappé
 * Usage N8N : dans un node Code après le scraping
 */
function normalizeLead(rawLead) {
  return {
    first_name: cleanName(rawLead.first_name || rawLead.name?.split(' ')[0] || ''),
    last_name: cleanName(rawLead.last_name || rawLead.name?.split(' ').slice(1).join(' ') || ''),
    email: cleanEmail(rawLead.email || ''),
    linkedin_url: cleanLinkedIn(rawLead.linkedin_url || rawLead.linkedin || ''),
    phone: cleanPhone(rawLead.phone || rawLead.telephone || ''),
    job_title: rawLead.job_title || rawLead.title || rawLead.poste || '',
    seniority: detectSeniority(rawLead.job_title || rawLead.title || ''),
    department: detectDepartment(rawLead.job_title || rawLead.title || ''),
    company_name: rawLead.company_name || rawLead.company || rawLead.entreprise || '',
    company_domain: extractDomain(rawLead.company_domain || rawLead.website || rawLead.email || ''),
    company_size: rawLead.company_size || rawLead.employees || rawLead.taille || '',
    company_industry: rawLead.company_industry || rawLead.industry || rawLead.secteur || '',
    company_location: rawLead.company_location || rawLead.location || rawLead.ville || '',
    company_description: rawLead.company_description || rawLead.description || '',
    source: rawLead.source || 'unknown',
    source_query: rawLead.source_query || rawLead.search_query || ''
  };
}

function cleanName(name) {
  return name.trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function cleanEmail(email) {
  return email.trim().toLowerCase().replace(/\s/g, '');
}

function cleanLinkedIn(url) {
  if (!url) return '';
  url = url.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
  // Normaliser l'URL LinkedIn
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/);
  if (match) return `https://www.linkedin.com/in/${match[1]}/`;
  return url;
}

function cleanPhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

function extractDomain(input) {
  if (!input) return '';
  // Si c'est un email
  if (input.includes('@')) {
    const domain = input.split('@')[1];
    // Ignorer les domaines génériques
    const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'orange.fr', 'free.fr'];
    if (genericDomains.includes(domain)) return '';
    return domain;
  }
  // Si c'est une URL
  try {
    const url = new URL(input.startsWith('http') ? input : 'https://' + input);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function detectSeniority(title) {
  if (!title) return 'Unknown';
  const t = title.toLowerCase();
  if (/\b(ceo|cto|cmo|cfo|coo|founder|pdg|dg|président)\b/.test(t)) return 'C-Level';
  if (/\b(vp|vice.?president)\b/.test(t)) return 'VP';
  if (/\b(directeur|directrice|director|head)\b/.test(t)) return 'Director';
  if (/\b(manager|responsable|chef|lead)\b/.test(t)) return 'Manager';
  if (/\b(senior|sr)\b/.test(t)) return 'Senior';
  return 'Individual';
}

function detectDepartment(title) {
  if (!title) return 'Other';
  const t = title.toLowerCase();
  if (/\b(marketing|growth|acquisition|brand|content|seo|sem)\b/.test(t)) return 'Marketing';
  if (/\b(commercial|sales|vente|business dev|account exec|sdr|bdr)\b/.test(t)) return 'Sales';
  if (/\b(tech|dev|engineer|cto|it|data|product)\b/.test(t)) return 'Tech';
  if (/\b(rh|hr|people|talent|recrutement)\b/.test(t)) return 'HR';
  if (/\b(finance|cfo|comptab|accounting)\b/.test(t)) return 'Finance';
  if (/\b(ceo|coo|dg|pdg|founder|operations|général)\b/.test(t)) return 'Executive';
  return 'Other';
}

/**
 * Dédupliquer les leads par email et LinkedIn
 * Usage : après merge de plusieurs sources
 */
function deduplicateLeads(leads) {
  const seen = new Map();

  for (const lead of leads) {
    const key = lead.email || lead.linkedin_url || `${lead.first_name}_${lead.last_name}_${lead.company_name}`;
    if (!key) continue;

    if (seen.has(key)) {
      // Merge : garder les données les plus complètes
      const existing = seen.get(key);
      for (const [field, value] of Object.entries(lead)) {
        if (value && !existing[field]) {
          existing[field] = value;
        }
      }
    } else {
      seen.set(key, { ...lead });
    }
  }

  return Array.from(seen.values());
}

/**
 * Générer un pattern d'email probable à partir du nom et du domaine
 * Utile quand on a le nom + le site mais pas l'email
 */
function guessEmail(firstName, lastName, domain) {
  if (!firstName || !lastName || !domain) return [];

  const f = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const l = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return [
    `${f}.${l}@${domain}`,          // jean.dupont@company.com (le plus courant en FR)
    `${f[0]}.${l}@${domain}`,       // j.dupont@company.com
    `${f}${l}@${domain}`,           // jeandupont@company.com
    `${f[0]}${l}@${domain}`,        // jdupont@company.com
    `${f}@${domain}`,               // jean@company.com (petites boîtes)
    `${l}.${f}@${domain}`,          // dupont.jean@company.com
    `${f}-${l}@${domain}`,          // jean-dupont@company.com
  ];
}

// --- UTILISATION DANS N8N ---
// const items = $input.all();
// const normalized = items.map(item => ({ json: normalizeLead(item.json) }));
// const deduplicated = deduplicateLeads(normalized.map(n => n.json));
// return deduplicated.map(lead => ({ json: lead }));

if (typeof module !== 'undefined') {
  module.exports = { normalizeLead, deduplicateLeads, guessEmail, extractDomain };
}
