// ============================================================
// SCORING ENGINE — Lead Qualification B2B
// Utilisable dans un node "Code" N8N ou en standalone
// ============================================================

/**
 * Calcule le score d'un lead sur 100 points
 * @param {Object} lead - Données du lead
 * @returns {Object} - Score détaillé
 */
function scoreLead(lead) {
  const breakdown = {
    company_size: scoreCompanySize(lead.company_size),
    job_title: scoreJobTitle(lead.job_title, lead.seniority),
    industry: scoreIndustry(lead.company_industry),
    buying_signals: scoreBuyingSignals(lead.signals || []),
    accessibility: scoreAccessibility(lead)
  };

  const totalScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  // Disqualification immédiate
  if (isDisqualified(lead)) {
    return {
      score: 0,
      label: 'disqualified',
      breakdown,
      reasoning: getDisqualificationReason(lead),
      recommended_angle: null,
      priority: 0
    };
  }

  const label = totalScore >= 70 ? 'chaud' : totalScore >= 40 ? 'tiede' : 'froid';
  const priority = label === 'chaud' ? 1 : label === 'tiede' ? 2 : 3;

  return {
    score: Math.min(totalScore, 100),
    label,
    breakdown,
    reasoning: generateReasoning(lead, breakdown, label),
    recommended_angle: suggestAngle(lead, breakdown),
    priority
  };
}

// --- Fonctions de scoring par critère ---

function scoreCompanySize(size) {
  if (!size) return 3;
  const s = String(size).toLowerCase().replace(/\s/g, '');
  const sizeMap = {
    '1-10': 5, '1-9': 5,
    '11-50': 15, '10-49': 15,
    '51-200': 20, '50-199': 20, '51-250': 20,
    '201-500': 15, '200-499': 15, '201-1000': 12,
    '500+': 5, '501-1000': 5, '1001-5000': 3, '5001-10000': 2, '10001+': 2
  };

  for (const [key, val] of Object.entries(sizeMap)) {
    if (s.includes(key) || s === key) return val;
  }

  // Essayer de parser un nombre
  const num = parseInt(size);
  if (!isNaN(num)) {
    if (num <= 10) return 5;
    if (num <= 50) return 15;
    if (num <= 200) return 20;
    if (num <= 500) return 15;
    return 5;
  }

  return 3;
}

function scoreJobTitle(title, seniority) {
  if (!title) return 3;
  const t = title.toLowerCase();

  // C-Level
  if (/\b(ceo|cto|cmo|cfo|coo|cro|founder|co-founder|fondateur|co-fondateur|pdg|dg|directeur général|président)\b/.test(t)) {
    return 25;
  }
  // VP
  if (/\b(vp|vice.?president|vice-président)\b/.test(t)) return 22;
  // Director
  if (/\b(directeur|directrice|director|head of)\b/.test(t)) {
    if (/\b(commercial|sales|marketing|growth|revenue|business dev)\b/.test(t)) return 22;
    return 18;
  }
  // Manager
  if (/\b(manager|responsable|chef de|lead)\b/.test(t)) {
    if (/\b(commercial|sales|marketing|growth|acquisition|demand gen)\b/.test(t)) return 15;
    return 10;
  }
  // Spécialiste avec séniorité
  if (/\b(senior|sr\.)\b/.test(t)) return 8;
  // Junior / Stagiaire = disqualifiant
  if (/\b(stagiaire|intern|student|étudiant|junior|assistant)\b/.test(t)) return 0;

  return 5;
}

function scoreIndustry(industry) {
  if (!industry) return 3;
  const i = industry.toLowerCase();

  const industryScores = [
    { keywords: ['saas', 'software', 'logiciel', 'tech', 'technolog'], score: 20 },
    { keywords: ['agence', 'agency', 'digital', 'marketing', 'communication'], score: 18 },
    { keywords: ['e-commerce', 'ecommerce', 'retail', 'commerce en ligne'], score: 17 },
    { keywords: ['conseil', 'consulting', 'formation', 'training', 'services b2b', 'b2b'], score: 15 },
    { keywords: ['recrutement', 'staffing', 'rh', 'hr tech'], score: 14 },
    { keywords: ['fintech', 'finance', 'assurance', 'banque', 'immobilier', 'real estate'], score: 10 },
    { keywords: ['santé', 'health', 'medtech', 'pharma'], score: 8 },
    { keywords: ['industrie', 'manufacturing', 'btp', 'construction'], score: 5 },
    { keywords: ['education', 'enseignement', 'association', 'non-profit'], score: 3 }
  ];

  for (const { keywords, score } of industryScores) {
    if (keywords.some(k => i.includes(k))) return score;
  }

  return 5;
}

function scoreBuyingSignals(signals) {
  if (!signals || !Array.isArray(signals) || signals.length === 0) return 0;

  let score = 0;
  const signalScores = {
    'hiring_sales': 8,
    'hiring_marketing': 7,
    'fundraising': 7,
    'recent_funding': 7,
    'growing_team': 5,
    'new_website': 5,
    'active_linkedin': 4,
    'uses_similar_tools': 3,
    'job_posting_growth': 5,
    'recent_expansion': 5,
    'new_product_launch': 4,
    'conference_speaker': 3,
    'content_creator': 3
  };

  for (const signal of signals) {
    score += signalScores[signal] || 2;
  }

  return Math.min(score, 20); // Cap à 20
}

function scoreAccessibility(lead) {
  let score = 0;
  if (lead.email && lead.email_verified) score += 8;
  else if (lead.email) score += 4;
  if (lead.linkedin_url) score += 4;
  if (lead.phone) score += 3;
  return Math.min(score, 15);
}

// --- Disqualification ---

function isDisqualified(lead) {
  if (lead.opt_out) return true;
  const title = (lead.job_title || '').toLowerCase();
  if (/\b(stagiaire|intern|student|étudiant)\b/.test(title)) return true;
  const size = parseInt(lead.company_size);
  if (!isNaN(size) && size < 3 && !(lead.signals || []).length) return true;
  return false;
}

function getDisqualificationReason(lead) {
  if (lead.opt_out) return 'Lead opt-out — RGPD';
  const title = (lead.job_title || '').toLowerCase();
  if (/\b(stagiaire|intern|student|étudiant)\b/.test(title)) return 'Contact non-décideur (stagiaire/étudiant)';
  return 'Entreprise trop petite sans signaux d\'achat';
}

// --- Génération de contexte ---

function generateReasoning(lead, breakdown, label) {
  const parts = [];

  if (breakdown.job_title >= 20) parts.push(`Décideur (${lead.job_title})`);
  else if (breakdown.job_title >= 12) parts.push(`Contact pertinent (${lead.job_title})`);

  if (breakdown.company_size >= 15) parts.push(`Entreprise de taille idéale (${lead.company_size})`);

  if (breakdown.industry >= 15) parts.push(`Secteur prioritaire (${lead.company_industry})`);

  if (breakdown.buying_signals >= 8) parts.push('Signaux d\'achat détectés');

  if (breakdown.accessibility >= 8) parts.push('Email vérifié');

  if (parts.length === 0) parts.push('Profil standard, peu de signaux');

  return `${label.toUpperCase()} — ${parts.join(', ')}.`;
}

function suggestAngle(lead, breakdown) {
  const title = (lead.job_title || '').toLowerCase();
  const industry = (lead.company_industry || '').toLowerCase();

  if (/\b(ceo|founder|fondateur|dg|pdg)\b/.test(title)) {
    return 'ROI et croissance : comment automatiser l\'acquisition pour scaler sans multiplier les coûts RH';
  }
  if (/\b(cmo|marketing|growth)\b/.test(title)) {
    return 'Pipeline de leads qualifiés : automatiser la prospection pour se concentrer sur la conversion';
  }
  if (/\b(commercial|sales|vente)\b/.test(title)) {
    return 'Gain de temps : recevoir des RDV qualifiés sans prospecter manuellement';
  }
  if (/agence|agency/.test(industry)) {
    return 'Proposer la lead gen automatisée comme service à vos clients ou pour votre propre développement';
  }
  if (/saas|software/.test(industry)) {
    return 'Accélérer le pipeline outbound pour compléter l\'inbound et réduire le CAC';
  }
  return 'Automatiser la prospection commerciale pour gagner du temps et des clients';
}

// --- UTILISATION DANS N8N ---
// Dans un node "Code" N8N, collez ceci à la fin :

// Pour traiter un seul lead :
// const lead = $input.first().json;
// const result = scoreLead(lead);
// return [{ json: { ...lead, ...result } }];

// Pour traiter plusieurs leads :
// return $input.all().map(item => {
//   const result = scoreLead(item.json);
//   return { json: { ...item.json, ...result } };
// });

// --- EXPORT (pour usage Node.js standalone) ---
if (typeof module !== 'undefined') {
  module.exports = { scoreLead, scoreCompanySize, scoreJobTitle, scoreIndustry };
}
