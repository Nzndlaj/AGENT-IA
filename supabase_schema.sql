-- ============================================================
-- Schéma Supabase : compte Instagram "classements & comparaisons"
-- À exécuter dans le SQL Editor de ton projet Supabase
-- ============================================================

create table if not exists ig_reels (
  id            uuid primary key default gen_random_uuid(),
  cree_le       timestamptz not null default now(),

  -- fr | en (le pipeline bilingue duplique la ligne, une par langue)
  compte        text not null default 'fr',

  -- top10 | duel | echelle | evolution  (v1 : top10)
  sous_format   text not null default 'top10',

  titre         text not null,

  -- Payload complet du reel (hook, items, voix, cta...) — voir README
  donnees       jsonb not null,

  -- idee -> valide -> rendu_en_cours -> video_prete -> publie -> rejete / erreur
  statut        text not null default 'idee',

  video_url     text,
  ig_media_id   text,
  publie_le     timestamptz,
  erreur        text,

  -- stats récupérées plus tard par le workflow analytics
  vues          integer,
  likes         integer,
  commentaires  integer
);

create index if not exists idx_ig_reels_statut on ig_reels (statut);
create index if not exists idx_ig_reels_compte on ig_reels (compte);

-- ============================================================
-- Bucket de stockage pour les vidéos rendues
-- (à créer aussi via l'interface : Storage > New bucket > "reels", public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;

-- ============================================================
-- Exemple d'insertion pour tester le rendu (un Top 10)
-- score = valeur relative 0-100 pour la longueur de la barre
-- items classés du n°1 au n°10 (le script les révèle en partant du 10)
-- ============================================================
insert into ig_reels (compte, sous_format, titre, donnees, statut) values (
  'fr',
  'top10',
  'Top 10 des animaux les plus rapides',
  '{
    "hook": "Le n°1 est plus rapide qu''une voiture sur autoroute",
    "titre_ecran": "TOP 10 ANIMAUX LES PLUS RAPIDES",
    "cta": "Abonne-toi, un classement tous les 2 jours",
    "voix": "fr-FR-HenriNeural",
    "accent": "#7c3aed",
    "items": [
      {"label": "Faucon pèlerin", "valeur": "390 km/h", "score": 100},
      {"label": "Aigle royal",    "valeur": "320 km/h", "score": 82},
      {"label": "Martinet",      "valeur": "170 km/h", "score": 44},
      {"label": "Guépard",       "valeur": "120 km/h", "score": 31},
      {"label": "Espadon",       "valeur": "110 km/h", "score": 28},
      {"label": "Antilocapre",   "valeur": "98 km/h",  "score": 25},
      {"label": "Lion",          "valeur": "80 km/h",  "score": 21},
      {"label": "Lévrier",       "valeur": "72 km/h",  "score": 18},
      {"label": "Lièvre",        "valeur": "70 km/h",  "score": 18},
      {"label": "Kangourou",     "valeur": "65 km/h",  "score": 17}
    ]
  }'::jsonb,
  'valide'
);
