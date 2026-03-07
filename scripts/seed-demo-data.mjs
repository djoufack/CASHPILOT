#!/usr/bin/env node
/**
 * Seed Demo Data for CashPilot
 * Generates realistic, coherent business data for all empty demo companies.
 * Each company gets a unique sector with matching clients, invoices, and expenses.
 *
 * Usage: node scripts/seed-demo-data.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rfzvrezrcigzmldgvntz.supabase.co';
const SUPABASE_ANON_KEY = '[SUPABASE_ANON_KEY_REDACTED]';

// ─── Accounts ────────────────────────────────────────────────────────────────
const ACCOUNTS = [
  {
    email: 'pilotage.fr.demo@cashpilot.cloud',
    password: 'PilotageFR#2026!',
    country: 'FR',
    currency: 'EUR',
    taxRate: 20,
    emptyCompanies: [
      { id: '30bba4f8-9ba2-f821-98ea-5855bd0915a0', name: 'CashPilot Demo France SAS', sector: 'consulting' },
      { id: '40af1635-ba9e-71d7-c40d-02a7d9895d0a', name: 'Portfolio SARL 2', sector: 'ecommerce' },
      { id: '5b7187e0-048a-b514-a432-3857be37abe8', name: 'Portfolio SARL 3', sector: 'it_dev' },
      { id: 'f853cfcc-a7bc-7637-1e7f-a5cb7b0ae9c2', name: 'Portfolio SARL 4', sector: 'construction' },
      { id: '86f175b7-1827-1bab-6500-c0748ddc52b4', name: 'Portfolio SARL 5', sector: 'restaurant' },
      { id: 'b69bd154-9ba8-ea20-a994-fd791ab4b49d', name: 'Portfolio SARL 6', sector: 'health' },
    ]
  },
  {
    email: 'pilotage.be.demo@cashpilot.cloud',
    password: 'PilotageBE#2026!',
    country: 'BE',
    currency: 'EUR',
    taxRate: 21,
    emptyCompanies: [
      { id: '8cc14a9e-6412-2a2a-541f-9f1b6b410447', name: 'CashPilot Demo Belgium SRL', sector: 'logistics' },
      { id: 'c863e896-bae0-8c2d-bdff-07d84047ff86', name: 'Portfolio BV 1', sector: 'design_agency' },
      { id: 'be71d1ae-2940-8cd9-a097-730e1a6f5743', name: 'Portfolio BV 2', sector: 'training' },
      { id: 'e8ef0139-2d5c-4dde-1d4c-d32016ebb9ac', name: 'Portfolio BV 3', sector: 'real_estate' },
      { id: 'e7a16a8e-8cf5-89fd-91a4-ae2ea112fb88', name: 'Portfolio BV 5', sector: 'food_industry' },
      { id: '43c2e5b8-a5aa-28e1-5a3a-12d4abed1741', name: 'Portfolio BV 6', sector: 'green_energy' },
    ]
  },
  {
    email: 'pilotage.ohada.demo@cashpilot.cloud',
    password: 'PilotageOHADA#2026!',
    country: 'CM',
    currency: 'XAF',
    taxRate: 19.25,
    emptyCompanies: [
      { id: '9749db02-2278-ad81-6154-eb45a69030b6', name: 'Portfolio SARL 1', sector: 'telecom' },
      { id: 'e1fbffe4-3a85-2a1b-5a48-69fdcf8411cf', name: 'Portfolio SARL 2', sector: 'agriculture' },
      { id: '42d8dad2-08fb-6568-9311-ab7e4097456b', name: 'Portfolio SARL 3', sector: 'mining' },
      { id: 'a956e7c6-e62e-57fc-cb6b-408c7b2e6380', name: 'Portfolio SARL 4', sector: 'import_export' },
      { id: '0d941d95-81e2-7c08-1036-ad06348a7a91', name: 'Portfolio SARL 5', sector: 'hotel' },
      { id: '06def6ed-6749-ce99-6baa-f0432a71c3da', name: 'Portfolio SARL 6', sector: 'transport' },
    ]
  }
];

// ─── Sector definitions with realistic data templates ────────────────────────
const SECTORS = {
  // === FR sectors ===
  consulting: {
    clients: [
      { company_name: 'Renault Group Digital', contact_name: 'Marie Dupont', email: 'mdupont@renault-digital.demo', city: 'Boulogne-Billancourt', postal_code: '92100' },
      { company_name: 'LVMH Finance Direction', contact_name: 'Thomas Laurent', email: 'tlaurent@lvmh-finance.demo', city: 'Paris', postal_code: '75008' },
      { company_name: 'Airbus Strategy Consulting', contact_name: 'Sophie Moreau', email: 'smoreau@airbus-strat.demo', city: 'Toulouse', postal_code: '31000' },
      { company_name: 'BNP Paribas Transformation', contact_name: 'Pierre Lefebvre', email: 'plefebvre@bnp-transfo.demo', city: 'Paris', postal_code: '75009' },
    ],
    invoiceDescriptions: ['Audit strategie digitale', 'Accompagnement transformation', 'Mission conseil direction generale', 'Diagnostic performance operationnelle'],
    expenseCategories: ['consulting', 'travel', 'software', 'rent'],
    expenseDescriptions: ['Deplacement client Toulouse', 'Licence outils BI', 'Loyer bureau Paris 2e', 'Formation certifiante equipe'],
    priceRange: [8000, 25000],
    expenseRange: [500, 4000],
  },
  ecommerce: {
    clients: [
      { company_name: 'Maison Colette Boutique', contact_name: 'Isabelle Roux', email: 'iroux@maison-colette.demo', city: 'Paris', postal_code: '75003' },
      { company_name: 'Vin Direct Express', contact_name: 'Jean-Marc Delacroix', email: 'jmdelacroix@vindirect.demo', city: 'Bordeaux', postal_code: '33000' },
      { company_name: 'PharmaClick France', contact_name: 'Caroline Mercier', email: 'cmercier@pharmaclick.demo', city: 'Lyon', postal_code: '69003' },
      { company_name: 'Tech Store Pro', contact_name: 'Nicolas Garnier', email: 'ngarnier@techstorepro.demo', city: 'Marseille', postal_code: '13001' },
    ],
    invoiceDescriptions: ['Creation site e-commerce Shopify', 'Integration passerelle paiement Stripe', 'Campagne marketing digital Q1', 'Optimisation SEO et conversion'],
    expenseCategories: ['marketing', 'software', 'shipping', 'telecom'],
    expenseDescriptions: ['Google Ads campagne', 'Abonnement Shopify Plus', 'Frais logistique entrepot', 'Hebergement serveurs cloud'],
    priceRange: [3000, 15000],
    expenseRange: [800, 3500],
  },
  it_dev: {
    clients: [
      { company_name: 'Societe Generale IT', contact_name: 'Francois Blanc', email: 'fblanc@sgit.demo', city: 'Paris La Defense', postal_code: '92400' },
      { company_name: 'Dassault Digital Factory', contact_name: 'Amelie Girard', email: 'agirard@dassault-df.demo', city: 'Velizy', postal_code: '78140' },
      { company_name: 'Orange Innovation Hub', contact_name: 'Matthieu Robert', email: 'mrobert@orange-innov.demo', city: 'Chatillon', postal_code: '92320' },
      { company_name: 'Capgemini Internal Tools', contact_name: 'Laura Simon', email: 'lsimon@capgemini-tools.demo', city: 'Paris', postal_code: '75013' },
    ],
    invoiceDescriptions: ['Developpement API microservices', 'Migration cloud AWS vers GCP', 'Sprint 3 - Application mobile React Native', 'Audit securite infrastructure'],
    expenseCategories: ['software', 'hardware', 'telecom', 'training'],
    expenseDescriptions: ['Licences JetBrains equipe', 'MacBook Pro developpeurs', 'AWS infrastructure mensuelle', 'Conference tech Berlin'],
    priceRange: [10000, 35000],
    expenseRange: [1000, 5000],
  },
  construction: {
    clients: [
      { company_name: 'Bouygues Immobilier Sud', contact_name: 'Alain Faure', email: 'afaure@bouygues-sud.demo', city: 'Montpellier', postal_code: '34000' },
      { company_name: 'Eiffage Genie Civil', contact_name: 'Michel Perrin', email: 'mperrin@eiffage-gc.demo', city: 'Nanterre', postal_code: '92000' },
      { company_name: 'Mairie de Bordeaux Urbanisme', contact_name: 'Catherine Lemoine', email: 'clemoine@mairie-bdx.demo', city: 'Bordeaux', postal_code: '33000' },
      { company_name: 'Nexity Renovation', contact_name: 'Philippe Andre', email: 'pandre@nexity-renov.demo', city: 'Lyon', postal_code: '69002' },
    ],
    invoiceDescriptions: ['Lot gros oeuvre phase 2', 'Etude de sol et fondations', 'Travaux second oeuvre bureaux', 'Maitrise d oeuvre residence'],
    expenseCategories: ['materials', 'equipment', 'insurance', 'subcontracting'],
    expenseDescriptions: ['Achat materiaux beton arme', 'Location grue mobile', 'Assurance chantier decennale', 'Sous-traitance electricite'],
    priceRange: [15000, 65000],
    expenseRange: [3000, 12000],
  },
  restaurant: {
    clients: [
      { company_name: 'Hotel Le Meurice Restauration', contact_name: 'Juliette Morel', email: 'jmorel@lemeurice.demo', city: 'Paris', postal_code: '75001' },
      { company_name: 'Groupe Accor Catering', contact_name: 'Stephane Dubois', email: 'sdubois@accor-catering.demo', city: 'Issy-les-Moulineaux', postal_code: '92130' },
      { company_name: 'Traiteur Lenotre Events', contact_name: 'Helene Chevalier', email: 'hchevalier@lenotre-events.demo', city: 'Paris', postal_code: '75016' },
      { company_name: 'Bistrot Paul Bert Group', contact_name: 'David Renaud', email: 'drenaud@paulbert.demo', city: 'Paris', postal_code: '75011' },
    ],
    invoiceDescriptions: ['Service traiteur gala 200 couverts', 'Prestation banquet mariage premium', 'Livraison plateaux-repas semaine 12', 'Menu degustation evenement corporate'],
    expenseCategories: ['supplies', 'rent', 'equipment', 'staff'],
    expenseDescriptions: ['Approvisionnement marche Rungis', 'Loyer cuisine centrale', 'Achat four professionnel Rational', 'Interim serveurs weekend'],
    priceRange: [4000, 18000],
    expenseRange: [1500, 6000],
  },
  health: {
    clients: [
      { company_name: 'Clinique Saint-Honore', contact_name: 'Dr Anne Lefranc', email: 'alefranc@clinique-sthonore.demo', city: 'Paris', postal_code: '75008' },
      { company_name: 'Groupe Ramsay Sante', contact_name: 'Vincent Masson', email: 'vmasson@ramsay-sante.demo', city: 'Paris', postal_code: '75017' },
      { company_name: 'Pharmacie Centrale Lyon', contact_name: 'Nathalie Bonnet', email: 'nbonnet@pharma-lyon.demo', city: 'Lyon', postal_code: '69001' },
      { company_name: 'Centre Bien-Etre Oceane', contact_name: 'Marine Duval', email: 'mduval@oceane-bienetre.demo', city: 'Nice', postal_code: '06000' },
    ],
    invoiceDescriptions: ['Equipement cabinet kinesitherapie', 'Fournitures medicales lot trimestriel', 'Formation protocoles sante digitale', 'Installation systeme dossiers patients'],
    expenseCategories: ['medical_supplies', 'rent', 'insurance', 'software'],
    expenseDescriptions: ['Materiel sterilisation Autoclave', 'Loyer cabinet medical', 'Assurance RC professionnelle', 'Logiciel gestion patients Doctolib Pro'],
    priceRange: [5000, 22000],
    expenseRange: [1000, 5000],
  },
  // === BE sectors ===
  logistics: {
    clients: [
      { company_name: 'Port of Antwerp Logistics', contact_name: 'Jan Vandenberghe', email: 'jvandenberghe@port-antwerp.demo', city: 'Antwerpen', postal_code: '2000' },
      { company_name: 'DHL Benelux Operations', contact_name: 'Katrien Peeters', email: 'kpeeters@dhl-bnl.demo', city: 'Mechelen', postal_code: '2800' },
      { company_name: 'Delhaize Supply Chain', contact_name: 'Wim Claes', email: 'wclaes@delhaize-sc.demo', city: 'Zellik', postal_code: '1731' },
      { company_name: 'Brussels Airport Cargo', contact_name: 'Sophie Willems', email: 'swillems@bru-cargo.demo', city: 'Zaventem', postal_code: '1930' },
    ],
    invoiceDescriptions: ['Gestion entrepot Q1 2026', 'Transport conteneurs maritime Asie', 'Solution tracking temps reel fleet', 'Audit chaine approvisionnement'],
    expenseCategories: ['fuel', 'maintenance', 'insurance', 'rent'],
    expenseDescriptions: ['Carburant flotte camions', 'Maintenance vehicules semestre', 'Assurance flotte transport', 'Location entrepot Zeebrugge'],
    priceRange: [8000, 30000],
    expenseRange: [2000, 8000],
  },
  design_agency: {
    clients: [
      { company_name: 'AB InBev Brand Studio', contact_name: 'Lotte Janssens', email: 'ljanssens@abinbev-brand.demo', city: 'Leuven', postal_code: '3000' },
      { company_name: 'Proximus Digital Experience', contact_name: 'Pieter De Wilde', email: 'pdewilde@proximus-dx.demo', city: 'Bruxelles', postal_code: '1030' },
      { company_name: 'Ville de Gand Communication', contact_name: 'Emma Martens', email: 'emartens@gent-comm.demo', city: 'Gent', postal_code: '9000' },
      { company_name: 'UCB Pharma Branding', contact_name: 'Thomas Hermans', email: 'thermans@ucb-brand.demo', city: 'Bruxelles', postal_code: '1070' },
    ],
    invoiceDescriptions: ['Refonte identite visuelle complete', 'Campagne publicitaire multi-canal', 'Design UX/UI application mobile', 'Production video corporate 4K'],
    expenseCategories: ['software', 'freelance', 'equipment', 'marketing'],
    expenseDescriptions: ['Suite Adobe Creative Cloud', 'Freelance motion designer', 'Ecran calibre Eizo ColorEdge', 'Impression supports marketing'],
    priceRange: [5000, 20000],
    expenseRange: [800, 4000],
  },
  training: {
    clients: [
      { company_name: 'Solvay Business School', contact_name: 'Marc Dumont', email: 'mdumont@solvay-bs.demo', city: 'Bruxelles', postal_code: '1050' },
      { company_name: 'Actiris Formation Pro', contact_name: 'Ingrid Leclercq', email: 'ileclercq@actiris-fp.demo', city: 'Bruxelles', postal_code: '1000' },
      { company_name: 'KBC Academy', contact_name: 'Bart Goossens', email: 'bgoossens@kbc-academy.demo', city: 'Antwerpen', postal_code: '2000' },
      { company_name: 'Colruyt Group Learning', contact_name: 'Nele Wouters', email: 'nwouters@colruyt-learn.demo', city: 'Halle', postal_code: '1500' },
    ],
    invoiceDescriptions: ['Formation leadership 3 jours', 'Programme Excel avance 20 participants', 'Coaching equipe management', 'Workshop innovation et design thinking'],
    expenseCategories: ['travel', 'materials', 'rent', 'catering'],
    expenseDescriptions: ['Deplacement formateurs Anvers', 'Manuels et supports imprimes', 'Location salle seminaire', 'Pauses cafe et dejeuners formation'],
    priceRange: [4000, 15000],
    expenseRange: [600, 3000],
  },
  real_estate: {
    clients: [
      { company_name: 'Immobel Development', contact_name: 'Christophe Lambert', email: 'clambert@immobel-dev.demo', city: 'Bruxelles', postal_code: '1000' },
      { company_name: 'Befimmo SA', contact_name: 'Annick Delvaux', email: 'adelvaux@befimmo.demo', city: 'Bruxelles', postal_code: '1050' },
      { company_name: 'Thomas & Piron Homes', contact_name: 'Didier Thomas', email: 'dthomas@tp-homes.demo', city: 'Liege', postal_code: '4000' },
      { company_name: 'Century 21 Benelux', contact_name: 'Veronique Dupuis', email: 'vdupuis@c21-bnl.demo', city: 'Namur', postal_code: '5000' },
    ],
    invoiceDescriptions: ['Gestion locative portefeuille Q1', 'Commission vente immeuble Ixelles', 'Expertise et evaluation patrimoine', 'Syndic copropriete annuel residence'],
    expenseCategories: ['legal', 'marketing', 'maintenance', 'insurance'],
    expenseDescriptions: ['Honoraires notaire acte', 'Publicite portails immobiliers', 'Travaux entretien parties communes', 'Assurance RC immobiliere'],
    priceRange: [6000, 35000],
    expenseRange: [1500, 7000],
  },
  food_industry: {
    clients: [
      { company_name: 'Leonidas Chocolatier', contact_name: 'Philippe Vanhoeck', email: 'pvanhoeck@leonidas.demo', city: 'Bruxelles', postal_code: '1070' },
      { company_name: 'Puratos Bakery Solutions', contact_name: 'Sarah Claessens', email: 'sclaessens@puratos.demo', city: 'Groot-Bijgaarden', postal_code: '1702' },
      { company_name: 'Spa Monopole', contact_name: 'Francois Henrard', email: 'fhenrard@spa-monopole.demo', city: 'Spa', postal_code: '4900' },
      { company_name: 'Vandemoortele NV', contact_name: 'An Verstraete', email: 'averstraete@vandemoortele.demo', city: 'Gent', postal_code: '9000' },
    ],
    invoiceDescriptions: ['Fourniture cacao premium lot 500kg', 'Installation ligne conditionnement', 'Audit qualite HACCP annuel', 'Emballages personnalises 50000 unites'],
    expenseCategories: ['raw_materials', 'equipment', 'certifications', 'transport'],
    expenseDescriptions: ['Matieres premieres cacao Afrique', 'Machine emballage sous vide', 'Certification ISO 22000 renouvellement', 'Transport frigorifique livraisons'],
    priceRange: [8000, 28000],
    expenseRange: [3000, 10000],
  },
  green_energy: {
    clients: [
      { company_name: 'Engie Electrabel Renouvelable', contact_name: 'Kevin Mertens', email: 'kmertens@engie-renouv.demo', city: 'Bruxelles', postal_code: '1000' },
      { company_name: 'Luminus Green', contact_name: 'Elise Franck', email: 'efranck@luminus-green.demo', city: 'Bruxelles', postal_code: '1210' },
      { company_name: 'Fluvius Energie', contact_name: 'Dirk Coppens', email: 'dcoppens@fluvius-energie.demo', city: 'Melle', postal_code: '9090' },
      { company_name: 'Eoly Energy', contact_name: 'Joke Desmedt', email: 'jdesmedt@eoly-energy.demo', city: 'Oostende', postal_code: '8400' },
    ],
    invoiceDescriptions: ['Installation panneaux solaires 100kWc', 'Etude faisabilite parc eolien', 'Maintenance turbines semestrielle', 'Audit energetique batiment tertiaire'],
    expenseCategories: ['equipment', 'permits', 'subcontracting', 'insurance'],
    expenseDescriptions: ['Panneaux photovoltaiques SunPower', 'Permis urbanisme parc eolien', 'Sous-traitance raccordement reseau', 'Assurance installation solaire'],
    priceRange: [12000, 45000],
    expenseRange: [4000, 15000],
  },
  // === OHADA sectors (XAF amounts) ===
  telecom: {
    clients: [
      { company_name: 'MTN Cameroun', contact_name: 'Paul Essomba', email: 'pessomba@mtn-cm.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Orange Cameroun SA', contact_name: 'Nadege Fouda', email: 'nfouda@orange-cm.demo', city: 'Yaounde', postal_code: '0000' },
      { company_name: 'Camtel Infrastructures', contact_name: 'Bernard Nkoulou', email: 'bnkoulou@camtel-infra.demo', city: 'Yaounde', postal_code: '0000' },
      { company_name: 'NextTel Mobile', contact_name: 'Aissatou Bello', email: 'abello@nexttel.demo', city: 'Douala', postal_code: '0000' },
    ],
    invoiceDescriptions: ['Installation antenne relais 4G zone rurale', 'Maintenance reseau fibre optique', 'Audit infrastructure telecom', 'Fourniture equipements BTS'],
    expenseCategories: ['equipment', 'transport', 'permits', 'maintenance'],
    expenseDescriptions: ['Antennes et modules radio', 'Transport materiel Douala-Maroua', 'Autorisation deploiement MINPOSTEL', 'Maintenance generateurs sites'],
    priceRange: [5000000, 18000000],
    expenseRange: [1500000, 6000000],
  },
  agriculture: {
    clients: [
      { company_name: 'SODECOTON Garoua', contact_name: 'Moussa Djibril', email: 'mdjibril@sodecoton.demo', city: 'Garoua', postal_code: '0000' },
      { company_name: 'Plantations du Haut Penja', contact_name: 'Jean-Pierre Mbappe', email: 'jpmbappe@php-penja.demo', city: 'Penja', postal_code: '0000' },
      { company_name: 'SOCAPALM Edea', contact_name: 'Therese Atangana', email: 'tatangana@socapalm.demo', city: 'Edea', postal_code: '0000' },
      { company_name: 'Cooperative Cacao Mbalmayo', contact_name: 'Emmanuel Ndi', email: 'endi@coop-cacao.demo', city: 'Mbalmayo', postal_code: '0000' },
    ],
    invoiceDescriptions: ['Fourniture engrais NPK 20 tonnes', 'Installation systeme irrigation goutte a goutte', 'Formation techniques agro-ecologiques', 'Analyse qualite recolte cacao'],
    expenseCategories: ['seeds', 'transport', 'equipment', 'labor'],
    expenseDescriptions: ['Semences certifiees hybrides', 'Transport recolte Douala port', 'Tracteur et materiel agricole', 'Main oeuvre saisonniere recolte'],
    priceRange: [3000000, 12000000],
    expenseRange: [800000, 4000000],
  },
  mining: {
    clients: [
      { company_name: 'Geovic Mining Cameroon', contact_name: 'Robert Tchatchoua', email: 'rtchatchoua@geovic-cm.demo', city: 'Yaounde', postal_code: '0000' },
      { company_name: 'CAMIRON SA', contact_name: 'Sylvie Nguema', email: 'snguema@camiron.demo', city: 'Kribi', postal_code: '0000' },
      { company_name: 'Sundance Resources Cameroon', contact_name: 'Marc Ebebiyene', email: 'mebebiyene@sundance-cm.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Cimencam Lafarge', contact_name: 'Georges Kamga', email: 'gkamga@cimencam.demo', city: 'Douala', postal_code: '0000' },
    ],
    invoiceDescriptions: ['Etude geologique prospection site', 'Location equipements forage 3 mois', 'Analyse echantillons mineraux laboratoire', 'Remise en etat environnemental site'],
    expenseCategories: ['equipment', 'fuel', 'permits', 'safety'],
    expenseDescriptions: ['Foreuse et compresseurs location', 'Carburant engins chantier', 'Permis exploitation miniere', 'Equipements securite EPI ouvriers'],
    priceRange: [8000000, 25000000],
    expenseRange: [2500000, 8000000],
  },
  import_export: {
    clients: [
      { company_name: 'UCCAO Export Cacao', contact_name: 'Alain Bomba', email: 'abomba@uccao.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Groupe SABC Distribution', contact_name: 'Beatrice Ewane', email: 'bewane@sabc-dist.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Port Autonome de Douala', contact_name: 'Joseph Manga', email: 'jmanga@pad-douala.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'China Harbour Engineering CM', contact_name: 'Wei Zhang', email: 'wzhang@chec-cm.demo', city: 'Douala', postal_code: '0000' },
    ],
    invoiceDescriptions: ['Dedouanement conteneurs port Douala', 'Transit marchandises Douala-Ndjamena', 'Courtage import machines industrielles', 'Logistique export bois precieux'],
    expenseCategories: ['customs', 'transport', 'storage', 'insurance'],
    expenseDescriptions: ['Droits de douane importation', 'Fret maritime Chine-Douala', 'Stockage conteneurs port', 'Assurance marchandises transit'],
    priceRange: [4000000, 15000000],
    expenseRange: [1200000, 5000000],
  },
  hotel: {
    clients: [
      { company_name: 'Hilton Yaounde', contact_name: 'Celestin Abena', email: 'cabena@hilton-yde.demo', city: 'Yaounde', postal_code: '0000' },
      { company_name: 'Sawa Hotel Douala', contact_name: 'Francoise Elame', email: 'felame@sawa-hotel.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Kribi Beach Resort', contact_name: 'Amira Hamadou', email: 'ahamadou@kribi-resort.demo', city: 'Kribi', postal_code: '0000' },
      { company_name: 'Pullman Douala Rabingha', contact_name: 'Leopold Fotso', email: 'lfotso@pullman-dla.demo', city: 'Douala', postal_code: '0000' },
    ],
    invoiceDescriptions: ['Renovation 30 chambres standard', 'Installation climatisation centrale', 'Fourniture linge hotelier premium', 'Systeme reservation en ligne PMS'],
    expenseCategories: ['supplies', 'maintenance', 'staff', 'utilities'],
    expenseDescriptions: ['Produits menagers et accueil', 'Entretien piscine et espaces verts', 'Salaires personnel hebergement', 'Electricite et eau mensuel'],
    priceRange: [4000000, 14000000],
    expenseRange: [1000000, 4500000],
  },
  transport: {
    clients: [
      { company_name: 'CAMRAIL Bollore', contact_name: 'Jacqueline Onana', email: 'jonana@camrail.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Brasseries du Cameroun Logistique', contact_name: 'Simon Ekotto', email: 'sekotto@brasseries-cm.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Dangote Cement Transport CM', contact_name: 'Ibrahim Moussa', email: 'imoussa@dangote-cm.demo', city: 'Douala', postal_code: '0000' },
      { company_name: 'Total Energies Cameroun Distrib', contact_name: 'Anne-Marie Samba', email: 'amsamba@total-cm.demo', city: 'Douala', postal_code: '0000' },
    ],
    invoiceDescriptions: ['Transport marchandises Douala-Yaounde 50T', 'Location flotte 10 camions 3 mois', 'Livraison ciment chantier Kribi', 'Convoi exceptionnel equipements industriels'],
    expenseCategories: ['fuel', 'maintenance', 'insurance', 'tolls'],
    expenseDescriptions: ['Gasoil flotte mensuel', 'Revision mecanique camions', 'Assurance vehicules commerciaux', 'Peages et taxes routieres'],
    priceRange: [3000000, 12000000],
    expenseRange: [800000, 3500000],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function randBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function roundTo(n, decimals = 2) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

const MONTHS = [
  { month: 1, date: '2026-01-15', dueDate: '2026-02-14' },
  { month: 2, date: '2026-02-12', dueDate: '2026-03-14' },
  { month: 3, date: '2026-03-05', dueDate: '2026-04-04' },
];

// ─── Main seed function ──────────────────────────────────────────────────────
async function seedAccount(account) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`\n=== Logging in as ${account.email} ===`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password
  });
  if (authError) { console.error('Login failed:', authError.message); return; }

  const userId = authData.user.id;
  console.log(`Logged in: ${userId}`);

  for (const company of account.emptyCompanies) {
    const sector = SECTORS[company.sector];
    if (!sector) { console.error(`Unknown sector: ${company.sector}`); continue; }

    console.log(`\n  --- Seeding "${company.name}" [${company.sector}] ---`);

    // Switch active company so RLS company_scope_guard allows inserts
    const { error: prefError } = await supabase.from('user_company_preferences').upsert({
      user_id: userId,
      active_company_id: company.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (prefError) {
      console.error(`    Failed to switch active company:`, prefError.message);
      continue;
    }
    console.log(`    Active company set to ${company.id}`);

    // 1. Create clients
    const clientIds = [];
    for (const tpl of sector.clients) {
      const clientId = uuid();
      clientIds.push(clientId);
      const { error } = await supabase.from('clients').insert({
        id: clientId,
        user_id: userId,
        company_id: company.id,
        company_name: tpl.company_name,
        contact_name: tpl.contact_name,
        email: tpl.email,
        address: `${randBetween(1, 120)} Rue du Commerce`,
        city: tpl.city,
        postal_code: tpl.postal_code,
        country: account.country,
        phone: account.country === 'CM' ? `+237 6 ${randBetween(10,99)} ${randBetween(10,99)} ${randBetween(10,99)} ${randBetween(10,99)}` :
               account.country === 'BE' ? `+32 ${randBetween(2,9)} ${randBetween(100,999)} ${randBetween(10,99)} ${randBetween(10,99)}` :
               `+33 ${randBetween(1,6)} ${randBetween(10,99)} ${randBetween(10,99)} ${randBetween(10,99)} ${randBetween(10,99)}`,
        payment_terms: '30 jours',
        preferred_currency: account.currency,
        notes: `Client demo - secteur ${company.sector}`,
        created_at: new Date('2026-01-02T08:00:00Z').toISOString(),
        updated_at: new Date('2026-01-02T08:00:00Z').toISOString(),
      });
      if (error) console.error(`    Client insert error (${tpl.company_name}):`, error.message);
      else console.log(`    + Client: ${tpl.company_name}`);
    }

    // 2. Create invoices (one per month Jan-Mar, varying statuses)
    const statuses = ['paid', 'sent', 'sent'];
    const paymentStatuses = ['paid', 'partial', 'unpaid'];

    for (let i = 0; i < 3; i++) {
      const m = MONTHS[i];
      const clientIdx = i % clientIds.length;
      const invoiceId = uuid();
      const totalHt = randBetween(sector.priceRange[0], sector.priceRange[1]);
      const taxAmount = roundTo(totalHt * account.taxRate / 100);
      const totalTtc = roundTo(totalHt + taxAmount);
      const status = statuses[i];
      const payStatus = paymentStatuses[i];
      const amountPaid = payStatus === 'paid' ? totalTtc :
                         payStatus === 'partial' ? roundTo(totalTtc * (0.3 + Math.random() * 0.4)) : 0;
      const balanceDue = roundTo(totalTtc - amountPaid);

      const prefix = account.country === 'CM' ? 'OHADA' : account.country;
      const invoiceNumber = `${prefix}-SEED-${company.id.substring(0, 4).toUpperCase()}-2026-${String(m.month).padStart(3, '0')}`;

      const { error: invError } = await supabase.from('invoices').insert({
        id: invoiceId,
        user_id: userId,
        company_id: company.id,
        client_id: clientIds[clientIdx],
        invoice_number: invoiceNumber,
        date: m.date,
        due_date: m.dueDate,
        status,
        total_ht: totalHt,
        tax_rate: account.taxRate,
        total_ttc: totalTtc,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_status: payStatus,
        notes: `${company.sector} demo invoice`,
        header_note: sector.invoiceDescriptions[i % sector.invoiceDescriptions.length],
        footer_note: 'Generated for CashPilot demo',
        terms_and_conditions: 'Paiement sous 30 jours.',
        invoice_type: 'service',
        currency: account.currency,
        reference: `REF-SEED-${company.id.substring(0, 4).toUpperCase()}-${m.month}`,
        created_at: `${m.date}T09:00:00Z`,
      });
      if (invError) { console.error(`    Invoice insert error:`, invError.message); continue; }

      // Invoice items (2 per invoice)
      const item1Total = roundTo(totalHt * 0.65);
      const item2Total = roundTo(totalHt - item1Total);
      const items = [
        {
          id: uuid(),
          invoice_id: invoiceId,
          item_type: 'service',
          description: sector.invoiceDescriptions[i % sector.invoiceDescriptions.length],
          quantity: 1,
          unit_price: item1Total,
          total: item1Total,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          hsn_code: '',
          created_at: `${m.date}T09:00:00Z`,
        },
        {
          id: uuid(),
          invoice_id: invoiceId,
          item_type: 'product',
          description: sector.invoiceDescriptions[(i + 1) % sector.invoiceDescriptions.length],
          quantity: randBetween(2, 5),
          unit_price: roundTo(item2Total / randBetween(2, 5)),
          total: item2Total,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          hsn_code: '',
          created_at: `${m.date}T09:10:00Z`,
        }
      ];

      const { error: itemsError } = await supabase.from('invoice_items').insert(items);
      if (itemsError) console.error(`    Invoice items error:`, itemsError.message);
      else console.log(`    + Invoice ${invoiceNumber}: ${totalTtc} ${account.currency} [${status}/${payStatus}]`);
    }

    // 3. Create a 4th invoice for the current period (March) with different client
    {
      const invoiceId = uuid();
      const totalHt = randBetween(sector.priceRange[0], sector.priceRange[1]);
      const taxAmount = roundTo(totalHt * account.taxRate / 100);
      const totalTtc = roundTo(totalHt + taxAmount);
      const prefix = account.country === 'CM' ? 'OHADA' : account.country;
      const invoiceNumber = `${prefix}-SEED-${company.id.substring(0, 4).toUpperCase()}-2026-004`;

      const { error: invError } = await supabase.from('invoices').insert({
        id: invoiceId,
        user_id: userId,
        company_id: company.id,
        client_id: clientIds[3 % clientIds.length],
        invoice_number: invoiceNumber,
        date: '2026-03-01',
        due_date: '2026-03-31',
        status: 'draft',
        total_ht: totalHt,
        tax_rate: account.taxRate,
        total_ttc: totalTtc,
        amount_paid: 0,
        balance_due: totalTtc,
        payment_status: 'unpaid',
        notes: `${company.sector} demo invoice - draft`,
        header_note: sector.invoiceDescriptions[3 % sector.invoiceDescriptions.length],
        footer_note: 'Generated for CashPilot demo',
        terms_and_conditions: 'Paiement sous 30 jours.',
        invoice_type: 'mixed',
        currency: account.currency,
        reference: `REF-SEED-${company.id.substring(0, 4).toUpperCase()}-4`,
        created_at: '2026-03-01T09:00:00Z',
      });

      if (!invError) {
        const itemTotal = totalHt;
        await supabase.from('invoice_items').insert({
          id: uuid(),
          invoice_id: invoiceId,
          item_type: 'service',
          description: sector.invoiceDescriptions[3 % sector.invoiceDescriptions.length],
          quantity: 1,
          unit_price: itemTotal,
          total: itemTotal,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          hsn_code: '',
          created_at: '2026-03-01T09:00:00Z',
        });
        console.log(`    + Invoice ${invoiceNumber}: ${totalTtc} ${account.currency} [draft]`);
      }
    }

    // 4. Create expenses (one per month Jan-Mar + one extra)
    for (let i = 0; i < 4; i++) {
      const expDate = i < 3 ? MONTHS[i].date : '2026-03-03';
      const amountHt = randBetween(sector.expenseRange[0], sector.expenseRange[1]);
      const taxAmt = roundTo(amountHt * account.taxRate / 100);
      const total = roundTo(amountHt + taxAmt);

      const { error: expError } = await supabase.from('expenses').insert({
        id: uuid(),
        user_id: userId,
        company_id: company.id,
        amount: total,
        amount_ht: amountHt,
        tax_rate: account.taxRate / 100,
        tax_amount: taxAmt,
        category: sector.expenseCategories[i % sector.expenseCategories.length],
        description: sector.expenseDescriptions[i % sector.expenseDescriptions.length],
        expense_date: expDate,
        payment_method: ['bank_transfer', 'credit_card', 'cash', 'bank_transfer'][i],
        refacturable: i === 0,
        created_at: `${expDate}T10:00:00Z`,
      });
      if (expError) console.error(`    Expense error:`, expError.message);
      else console.log(`    + Expense: ${sector.expenseDescriptions[i % sector.expenseDescriptions.length]} (${total} ${account.currency})`);
    }

    console.log(`  --- Done: "${company.name}" ---`);
  }

  await supabase.auth.signOut();
  console.log(`\n=== Logged out ${account.email} ===`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('CashPilot Demo Seed Script');
  console.log('='.repeat(60));

  for (const account of ACCOUNTS) {
    await seedAccount(account);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Seed complete!');
}

main().catch(console.error);
