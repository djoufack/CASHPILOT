-- ============================================================================
-- COMPREHENSIVE DEMO SEED MIGRATION — PART 1
-- ============================================================================
--
-- Purpose: Seed ALL 21 companies (3 users x 7 companies each) with rich,
-- realistic demo data covering every module of CashPilot.
--
-- Users:
--   FR   : a6985aad-8ae5-21d1-a773-511d32b71b24  (France, EUR, TVA 20%)
--   BE   : e3b36145-b3ab-bab9-4101-68b5fe900811  (Belgium, EUR, TVA 21%)
--   OHADA: eb70d17b-9562-59ed-f783-89327e65a7c1  (Cameroon, XAF, TVA 18%)
--
-- Each user has 1 main company + 6 portfolio companies = 7 companies.
-- ALL 21 companies receive identical data density.
--
-- Part 1 contains:
--   A. File header (this comment)
--   B. Phase 1: Cleanup (replica mode — disable triggers during DELETE)
--   C. Phase 2: Re-enable triggers
--   D. Phase 3: Helper function _seed_demo_company() declaration
--   E. Suppliers (7 per company)
--   F. Service categories (4 per user, user-level)
--   G. Services (8 per user, user-level)
--   H. Clients (7 per company)
--
-- Part 2 will add: invoices, invoice_items, payments, expenses, quotes,
--   products, product_categories, supplier_orders, purchase_orders,
--   projects, tasks, bank data, receivables, payables, credit_notes, etc.
--
-- Part 3 will: call the function for all 21 companies, then drop it.
-- ============================================================================


-- ============================================================================
-- PHASE 1: CLEANUP (replica mode — no reverse triggers during DELETE)
-- ============================================================================
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_company_ids UUID[];
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
    'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
    'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
  ];
BEGIN
  -- Collect ALL company IDs for the 3 demo users (main + portfolio)
  SELECT ARRAY_AGG(c.id) INTO v_company_ids
  FROM company c
  WHERE c.user_id = ANY(v_user_ids);

  IF v_company_ids IS NULL THEN
    RAISE NOTICE 'No companies found for demo users — nothing to clean';
    RETURN;
  END IF;

  RAISE NOTICE 'Cleaning % companies for 3 demo users', array_length(v_company_ids, 1);

  -- 1. Accounting entries (no FK children)
  DELETE FROM accounting_entries WHERE company_id = ANY(v_company_ids);

  -- 2. Supplier invoice chain
  DELETE FROM supplier_invoice_line_items WHERE invoice_id IN (
    SELECT id FROM supplier_invoices WHERE company_id = ANY(v_company_ids)
  );
  DELETE FROM supplier_invoices WHERE company_id = ANY(v_company_ids);

  -- 3. Credit note chain
  DELETE FROM credit_note_items WHERE credit_note_id IN (
    SELECT id FROM credit_notes WHERE company_id = ANY(v_company_ids)
  );
  DELETE FROM credit_notes WHERE company_id = ANY(v_company_ids);

  -- 4. Project chain (timesheets → subtasks → tasks → projects)
  DELETE FROM timesheets WHERE task_id IN (
    SELECT t.id FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids))
  );
  DELETE FROM subtasks WHERE task_id IN (
    SELECT t.id FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids))
  );
  DELETE FROM tasks WHERE project_id IN (
    SELECT id FROM projects
    WHERE client_id IN (SELECT id FROM clients WHERE company_id = ANY(v_company_ids))
  );
  DELETE FROM projects WHERE client_id IN (
    SELECT id FROM clients WHERE company_id = ANY(v_company_ids)
  );

  -- 5. Bank chain
  DELETE FROM bank_transactions WHERE company_id = ANY(v_company_ids);
  DELETE FROM bank_connections WHERE company_id = ANY(v_company_ids);

  -- 6. Receivables & Payables
  DELETE FROM receivables WHERE company_id = ANY(v_company_ids);
  DELETE FROM payables WHERE company_id = ANY(v_company_ids);

  -- 7. Financial documents
  DELETE FROM quotes WHERE company_id = ANY(v_company_ids);
  DELETE FROM payments WHERE company_id = ANY(v_company_ids);
  DELETE FROM invoice_items WHERE invoice_id IN (
    SELECT id FROM invoices WHERE company_id = ANY(v_company_ids)
  );
  DELETE FROM invoices WHERE company_id = ANY(v_company_ids);

  -- 8. Expenses
  DELETE FROM expenses WHERE company_id = ANY(v_company_ids);

  -- 9. Supply chain
  DELETE FROM supplier_order_items WHERE order_id IN (
    SELECT id FROM supplier_orders WHERE company_id = ANY(v_company_ids)
  );
  DELETE FROM supplier_orders WHERE company_id = ANY(v_company_ids);
  DELETE FROM purchase_orders WHERE company_id = ANY(v_company_ids);

  -- 10. Products & categories
  DELETE FROM products WHERE company_id = ANY(v_company_ids);
  DELETE FROM product_categories WHERE company_id = ANY(v_company_ids);

  -- 11. Supplier products chain
  DELETE FROM supplier_products WHERE company_id = ANY(v_company_ids);
  DELETE FROM supplier_product_categories WHERE company_id = ANY(v_company_ids);
  DELETE FROM supplier_services WHERE company_id = ANY(v_company_ids);

  -- 12. Suppliers
  DELETE FROM suppliers WHERE company_id = ANY(v_company_ids);

  -- 13. Clients (must be after projects, invoices, etc.)
  DELETE FROM clients WHERE company_id = ANY(v_company_ids);

  -- 14. Services & categories (user-level, no company_id)
  DELETE FROM services WHERE user_id = ANY(v_user_ids) AND description LIKE '%seed%';
  DELETE FROM service_categories WHERE user_id = ANY(v_user_ids) AND description LIKE '%seed%';

  RAISE NOTICE 'Cleanup complete for all demo companies';
END $$;


-- ============================================================================
-- PHASE 2: RE-ENABLE TRIGGERS
-- ============================================================================
SET session_replication_role = 'origin';


-- ============================================================================
-- PHASE 3: HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION _seed_demo_company(
  p_uid    UUID,
  p_cid    UUID,
  p_country TEXT,
  p_currency TEXT,
  p_cname  TEXT,
  p_seq    INT DEFAULT 1  -- company sequence (1..7) within user, for unique names
) RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_client_ids    UUID[] := ARRAY[]::UUID[];
  v_supplier_ids  UUID[] := ARRAY[]::UUID[];
  v_svc_cat_ids   UUID[] := ARRAY[]::UUID[];
  v_svc_ids       UUID[] := ARRAY[]::UUID[];
  v_prd_cat_ids   UUID[] := ARRAY[]::UUID[];
  v_prd_ids       UUID[] := ARRAY[]::UUID[];
  v_sup_prd_ids   UUID[] := ARRAY[]::UUID[];
  v_invoice_ids   UUID[] := ARRAY[]::UUID[];
  v_project_ids   UUID[] := ARRAY[]::UUID[];
  v_task_ids      UUID[] := ARRAY[]::UUID[];
  v_bank_conn_id  UUID;
  v_id            UUID;
  v_i             INT;
  v_idx           INT;  -- offset index into name pools
  v_rate          NUMERIC;
  v_mul           NUMERIC;
  v_pfx           TEXT;
  v_cid4          TEXT;
  v_base          NUMERIC;
  v_tax           NUMERIC;
  v_ttc           NUMERIC;
  -- Client name pools (49 per country = 7 companies × 7 clients)
  v_client_names_fr  TEXT[] := ARRAY[
    'Agence Digitale Lumiere','Cabinet Conseil Horizon','Start-up Innovation Lab',
    'Industrie Automobile Prestige','Banque Regionale du Sud','Hopital Central Metropole',
    'Universite Tech Avenir','Groupe Immobilier Riviera','Assurances Mutuelle Alliance',
    'Transport Maritime Atlantique','Epicerie Fine Gastronomie','Laboratoire Biomed Sante',
    'Studio Creatif Aurore','Reseau Energie Verte','Clinique Veterinaire Pasteur',
    'Maison Edition Plume','Cooperative Agricole Soleil','Centre Formation Pro Avenir',
    'Garage Automobile Elite','Brasserie Artisanale Terroir','Architectes Associes Dupont',
    'Vignoble Chateau Bellevue','Societe Generale Informatique','Cabinet Expertise Comptable',
    'Menuiserie Tradition Bois','Hotel Boutique Parisien','Patisserie Gourmande Ciel',
    'Librairie Internationale Globe','Agence Immobiliere Prestige','Pharmacie Centrale Plus',
    'Imprimerie Moderne Express','Bureau Etudes Techniques','Societe Nettoyage Propre',
    'Fleuriste Jardin Royal','Cabinet Avocats Justice','Restaurant Etoile Michelin',
    'Opticien Vision Parfaite','Salon Beaute Harmonie','Garage Pneus Champion',
    'Electricite Generale Martin','Plomberie Services Pro','Taxi Rapide Metropole',
    'Bijouterie Or et Diamant','Fromagerie Terroir France','Cordonnerie Artisan Luxe',
    'Pressing Express Clean','Boulangerie Pain Dore','Serrurerie Securite Max',
    'Agence Voyage Horizons'
  ];
  v_client_names_be  TEXT[] := ARRAY[
    'Digital Agency Brussels','Consulting Partners NV','Tech Venture Capital',
    'Pharma Research Institute','Financial Services Group','Healthcare Group Europe',
    'Education Institute Pro','Chocolaterie Bruxelloise','Brasserie Abbaye Trappiste',
    'Port Logistics Antwerp','Diamond Trading House','Biotech Innovations Leuven',
    'Design Studio Ghent','Renewable Energy Flanders','Veterinary Clinic Ardennes',
    'Publishing House Wallonia','Agricultural Coop Brabant','Training Academy Brussels',
    'Auto Repair Expertise','Artisan Brewery Liege','Architecture Bureau Namur',
    'Wine Import Benelux','IT Solutions Bruxelles','Accounting Firm Partners',
    'Woodcraft Traditions','Hotel Amigo Premium','Patisserie Belge Royale',
    'International Bookshop','Real Estate Investments','Pharmacy Central Benelux',
    'Print Express Belgium','Engineering Consultants','Cleaning Services Pro',
    'Floral Design Studio','Law Firm Advocates','Restaurant Gastronomique',
    'Optical Center Vision','Beauty Spa Wellness','Tire Center Champion',
    'Electrical Works Euro','Plumbing Solutions Plus','Taxi Service Brussels',
    'Jewelry Diamond Expert','Cheese Import Europe','Leather Craft Atelier',
    'Dry Cleaning Express','Bakery Pain Quotidien','Locksmith Security Plus',
    'Travel Agency Horizons'
  ];
  v_client_names_oh TEXT[] := ARRAY[
    'Groupe Industriel Sahel','Commerce Import-Export','Services Telecom Plus',
    'Agro Business International','Microfinance Plus SARL','Clinique Moderne Centrale',
    'Institut Formation Elite','Transport Urbain Express','Assurances Vie Afrique',
    'Societe Miniere Cameroun','Epicerie Marche Central','Labo Analyses Medicales',
    'Studio Photo Professionnel','Energie Solaire Sahel','Clinique Animale Tropicale',
    'Editions Africaines Plume','Cooperative Cacao Premium','Centre Langues Bilingue',
    'Garage Auto Prestige','Brasserie Locale Tradition','Architectes Modernes Afrique',
    'Plantation Cafe Export','Informatique Solutions Pro','Cabinet Comptable Expert',
    'Menuiserie Bois Tropical','Hotel Residence Palace','Patisserie Douala Sucree',
    'Librairie Savoir Plus','Agence Immobiliere Soleil','Pharmacie Populaire Sante',
    'Imprimerie Rapide Plus','Bureau Ingenierie Civil','Societe Nettoyage Urbain',
    'Fleuriste Jardin Tropical','Cabinet Juridique Conseil','Restaurant Maquis Etoile',
    'Optique Vue Claire','Salon Coiffure Elegance','Garage Pneus Africa',
    'Electricite Batiment Pro','Plomberie Sanitaire Plus','Moto Taxi Rapide',
    'Bijouterie Or Artisanal','Fromagerie Locale Frais','Cordonnerie Artisanale',
    'Pressing Moderne Clean','Boulangerie Pain Chaud','Serrurerie Depannage Express',
    'Agence Voyages Decouverte'
  ];
  -- Supplier name pools (49 per country)
  v_supplier_names_fr  TEXT[] := ARRAY[
    'TechParts France','CloudServ Europe','Imprimerie Nationale',
    'LogiTrans Express','Conseil RH Partners','SecurIT Systems',
    'GreenEnergy Solutions','Fournitures Bureau Pro','Materiel Informatique Plus',
    'Logiciel Gestion Cloud','Papeterie Centrale','Nettoyage Industriel Net',
    'Securite Gardiennage Pro','Telecom Solutions SAS','Mobilier Design Office',
    'Restauration Collective Chef','Maintenance Technique Pro','Publicite Media Connect',
    'Formation Digitale Expert','Emballage Packaging Plus','Climatisation Confort Air',
    'Peinture Batiment Pro','Dechets Recyclage Vert','Textile Uniformes Pro',
    'Signalisation Routiere','Amenagement Paysager','Audit Qualite Conseil',
    'Location Vehicules Fleet','Assurance Pro Entreprise','Nettoyage Vitrerie Crystal',
    'Plomberie Batiment SAS','Electricite Tertiaire','Menuiserie Agencement',
    'Serrurerie Pro Securite','Jardinage Espaces Verts','Demenagement Express France',
    'Catering Evenementiel','Traduction Services Pro','Courrier Express Rapide',
    'Fournitures Medicales','Equipement Industriel','Outillage Professionnel',
    'Materiaux Construction','Produits Chimiques Lab','Consommables Impression',
    'Services Juridiques Pro','Comptabilite Externalisee','Recrutement Talent Plus',
    'Veille Technologique SAS'
  ];
  v_supplier_names_be  TEXT[] := ARRAY[
    'CompuParts Belgium','DataCenter BeLux','Print & Pack BVBA',
    'TransEuro Logistics','HR Consult Group','CyberGuard Europe',
    'EcoPower Belgium','Office Supplies NV','IT Hardware Benelux',
    'Cloud Software Partners','Paper Wholesale BVBA','Industrial Cleaning Pro',
    'Security Guard Services','Telecom Belgium NV','Office Furniture Design',
    'Catering Services Group','Technical Maintenance','Advertising Media Group',
    'Digital Training Academy','Packaging Solutions EU','HVAC Climate Control',
    'Building Paint Services','Recycling Green Europe','Textile Workwear Pro',
    'Road Signage Belgium','Landscape Architecture','Quality Audit Consult',
    'Fleet Vehicle Rental','Business Insurance NV','Window Cleaning Crystal',
    'Plumbing Commercial','Electrical Contractors','Joinery Fit-Out NV',
    'Locksmith Pro Security','Garden Maintenance','Moving Services Express',
    'Event Catering Premium','Translation Bureau EU','Express Courier Benelux',
    'Medical Supplies NV','Industrial Equipment','Professional Tools BVBA',
    'Construction Materials','Chemical Lab Products','Printing Consumables',
    'Legal Services Partners','Outsourced Accounting','Recruitment Talent EU',
    'Tech Watch Consulting'
  ];
  v_supplier_names_oh TEXT[] := ARRAY[
    'AfriTech Solutions','InfoParts Cameroun','Bureau Plus SARL',
    'AfriLog Transport','RH Afrique Conseil','SecurAfrique SARL',
    'SolairePlus Cameroun','Fournitures Bureau Sahel','Materiel Info Tropiques',
    'Logiciel Cloud Afrique','Papeterie Centrale SARL','Nettoyage Industriel Afrique',
    'Gardiennage Securite Plus','Telecom Afrique Connect','Mobilier Bureau Import',
    'Restauration Collective Tropicale','Maintenance Technique Afrique','Media Publicite Sahel',
    'Formation Continue Afrique','Emballage Export SARL','Climatisation Tropicale',
    'Peinture Batiment Afrique','Recyclage Dechets Vert','Uniformes Textiles Pro',
    'Signalisation Urbaine','Espaces Verts Jardinage','Audit Conseil Afrique',
    'Location Vehicules Afrique','Assurance Entreprise SARL','Vitrerie Nettoyage Pro',
    'Plomberie Batiment SARL','Electricite Generale Plus','Menuiserie Bois Afrique',
    'Serrurerie Depannage Pro','Jardinage Tropical','Demenagement Rapide Afrique',
    'Traiteur Evenements','Traduction Bilingue Pro','Courrier Express Afrique',
    'Fournitures Medicales SARL','Equipement Industriel Pro','Outillage Professionnel Plus',
    'Materiaux BTP Afrique','Produits Chimiques SARL','Consommables Bureau Plus',
    'Services Juridiques SARL','Comptabilite Gestion Pro','Recrutement Talents Afrique',
    'Veille Technologique SARL'
  ];
  -- Contact name pools (49 per country — for clients)
  v_client_contacts_fr TEXT[] := ARRAY[
    'Marie Dupont','Pierre Lefebvre','Sophie Garnier','Antoine Mercier','Claire Bonnet',
    'Julien Perrin','Aurelie Martin','Thomas Blanc','Nathalie Rousseau','Francois Morel',
    'Helene Girard','David Lefevre','Christine Lambert','Maxime Fournier','Sandrine Duval',
    'Laurent Petit','Veronique Simon','Sebastien Michel','Brigitte Leroy','Guillaume Roux',
    'Monique Andre','Stephane Bertrand','Valerie Moreau','Philippe Garcia','Caroline Thomas',
    'Herve Robert','Sylvie Richard','Olivier Durand','Patricia Dubois','Emmanuel Henry',
    'Celine Masson','Yves Fontaine','Mireille Chevalier','Damien Legrand','Nadia Lemoine',
    'Romain Gautier','Laetitia Marchand','Xavier Renaud','Florence Picard','Mathieu Arnaud',
    'Isabelle Faure','Hugo Pelletier','Dominique Clement','Vincent Leclerc','Agnes Dumas',
    'Benoit Carpentier','Elise Noel','Patrick Guerin','Delphine Moulin'
  ];
  v_client_contacts_be TEXT[] := ARRAY[
    'Luc Janssens','Emma Claes','Marc Willems','Laura Verhoeven','Thomas Hendricks',
    'Nathalie Lemaire','Wim Jacobs','Sofie Vandenberge','Pieter Wouters','Annelies Maes',
    'Karel De Smet','Julie Peeters','Bart Mertens','Inge Dupont','Tom Claessens',
    'Charlotte Goossens','Jan Hermans','Katrien Michiels','Dirk Pauwels','Lies Martens',
    'Geert Cools','An Devos','Koen Stevens','Hilde Bogaerts','Joris Lenaerts',
    'Griet Janssen','Stef Nijs','Elke Smet','Raf Willems','Tine Aerts',
    'Bram Vermeersch','Sarah Declercq','Wout Leemans','Femke Van Damme','Yves Dumont',
    'Nele Hendriks','Filip Baert','Mieke Verbeke','Dieter Schepers','Leen De Wolf',
    'Ruben Vanderstraeten','Joke Smeets','Bert Claeys','Hanne Geerts','Nico Thijs',
    'Eva Lambrechts','Sven Desmet','Ilse Van Hoeck','Tim Moons'
  ];
  v_client_contacts_oh TEXT[] := ARRAY[
    'Paul Atangana','Fatou Diallo','Ibrahim Toure','Aminata Coulibaly','Oumar Bah',
    'Aissata Diarra','Mamadou Sylla','Jean-Pierre Nguema','Mariama Sow','Abdoulaye Keita',
    'Hadja Barry','Seydou Traore','Fatoumata Camara','Moussa Diop','Binta Conde',
    'Ousmane Ndiaye','Aissatou Balde','Amadou Sangare','Fanta Konate','Ibrahima Diallo',
    'Kadiatou Toure','Souleymane Cisse','Mariam Sidibe','Lamine Dembele','Rokia Keita',
    'Boubacar Haidara','Oumou Traore','Modibo Coulibaly','Awa Diarra','Cheick Sylla',
    'Fatoumata Bah','Mamoudou Sow','Nene Barry','Thierno Diallo','Aminata Sangare',
    'Sekou Konate','Djeinaba Camara','Oumar Cisse','Hawa Sidibe','Abdou Dembele',
    'Mariame Traore','Saidou Keita','Fatimatou Balde','Hamidou Ndiaye','Oumou Diop',
    'Youssouf Conde','Kadija Haidara','Issa Coulibaly','Salimata Toure'
  ];
  -- Contact name pools for suppliers
  v_supplier_contacts_fr TEXT[] := ARRAY[
    'Jean Moreau','Camille Roux','Alain Bernard','Lucie Marchand','Nicolas Fabre',
    'Isabelle Laurent','Thierry Dubois','Anne-Marie Collet','Rene Perret','Martine Bonhomme',
    'Frederic Vasseur','Colette Prevost','Gilles Boucher','Michele Poirier','Raymond Giraud',
    'Jocelyne Maillard','Bernard Delorme','Agnes Tessier','Henri Leconte','Francoise Vidal',
    'Marc Chauvin','Denise Barbier','Claude Ferreira','Suzanne Thibault','Roland Besson',
    'Jacqueline Marechal','Didier Jacquet','Odette Brunet','Serge Guillot','Catherine Pons',
    'Pascal Navarro','Yvette Collin','Roger Blanchard','Paulette Mercier','Michel Lecomte',
    'Genevieve Riou','Andre Bousquet','Simone Leclercq','Georges Sanchez','Lucienne Gaudin',
    'Jacques Cordier','Josiane Dufour','Robert Meunier','Jeannine Picard','Louis Martinez',
    'Marguerite Roy','Yves Dumont','Danielle Caron','Pierre-Louis Fabre'
  ];
  v_supplier_contacts_be TEXT[] := ARRAY[
    'Pieter De Smet','Anne Maes','Tom Peeters','Sofie Vandenberge','Karel Wouters',
    'Joris Mertens','Elise Dumont','Hans Claessens','Maria Goossens','Dirk Hermans',
    'Katrien Stevens','Bart Bogaerts','Griet Lenaerts','Jan Cools','Charlotte Devos',
    'Wim Pauwels','Lies Nijs','Koen Smet','Hilde Aerts','Stef Vermeersch',
    'An Declercq','Geert Leemans','Tine Van Damme','Raf Hendriks','Femke Baert',
    'Bram Verbeke','Nele Schepers','Filip De Wolf','Sarah Vanderstraeten','Dieter Smeets',
    'Leen Claeys','Ruben Geerts','Joke Thijs','Wout Lambrechts','Hanne Desmet',
    'Bert Van Hoeck','Mieke Moons','Sven Vos','Ilse Peters','Nico Janssens',
    'Eva Willems','Tim Jacobs','Julie Martens','Tom Michiels','Annelies Dupont',
    'Karel Lemaire','Inge Hendricks','Marc Wouters','Laura Peeters'
  ];
  v_supplier_contacts_oh TEXT[] := ARRAY[
    'Amadou Ndiaye','Binta Camara','Moussa Keita','Ousmane Diop','Aissatou Sow',
    'Seydou Traore','Mariama Barry','Jean-Claude Ondo','Fatou Sangare','Abdoulaye Cisse',
    'Hadja Sidibe','Lamine Dembele','Fatoumata Keita','Boubacar Haidara','Oumou Traore',
    'Modibo Coulibaly','Awa Diarra','Cheick Sylla','Fatoumata Bah','Mamoudou Sow',
    'Nene Barry','Thierno Diallo','Aminata Sangare','Sekou Konate','Djeinaba Camara',
    'Oumar Cisse','Hawa Sidibe','Abdou Dembele','Mariame Traore','Saidou Keita',
    'Fatimatou Balde','Hamidou Ndiaye','Oumou Diop','Youssouf Conde','Kadija Haidara',
    'Issa Coulibaly','Salimata Toure','Mamadou Diallo','Rokia Kone','Ibrahima Balde',
    'Kadiatou Sow','Souleymane Camara','Mariam Traore','Fanta Sidibe','Moussa Dembele',
    'Binta Keita','Oumar Haidara','Aminata Cisse','Seydou Diarra'
  ];
  v_paid          NUMERIC;
  v_status        TEXT;
  v_pay_status    TEXT;
BEGIN
  -- ---------------------------------------------------------------
  -- Set region-specific parameters
  -- ---------------------------------------------------------------
  IF p_country = 'FR' THEN
    v_rate := 20; v_mul := 1; v_pfx := 'FR';
  ELSIF p_country = 'BE' THEN
    v_rate := 21; v_mul := 1; v_pfx := 'BE';
  ELSE
    v_rate := 18; v_mul := 655; v_pfx := 'OH';
  END IF;

  v_cid4 := substring(p_cid::text, 1, 4);

  -- =================================================================
  -- E. SUPPLIERS (7 per company — unique names via p_seq offset)
  -- =================================================================
  FOR v_i IN 1..7 LOOP
    v_id := gen_random_uuid();
    v_supplier_ids := v_supplier_ids || v_id;
    v_idx := (p_seq - 1) * 7 + v_i;  -- unique index 1..49

    INSERT INTO suppliers (
      id, user_id, company_name, contact_person, email, phone,
      address, city, country, currency, status, supplier_type,
      payment_terms, company_id
    ) VALUES (
      v_id, p_uid,
      -- company_name: unique per company via v_idx into 49-name pool
      CASE p_country
        WHEN 'FR' THEN v_supplier_names_fr[v_idx]
        WHEN 'BE' THEN v_supplier_names_be[v_idx]
        ELSE v_supplier_names_oh[v_idx]
      END,
      -- contact_person: unique per company via v_idx
      CASE p_country
        WHEN 'FR' THEN v_supplier_contacts_fr[v_idx]
        WHEN 'BE' THEN v_supplier_contacts_be[v_idx]
        ELSE v_supplier_contacts_oh[v_idx]
      END,
      -- email (unique via v_idx)
      'supplier-' || v_idx || '@demo.cashpilot.cloud',
      -- phone (unique via v_idx)
      CASE p_country
        WHEN 'FR' THEN '+33 1 ' || (40 + v_idx)::text || ' ' || LPAD(((v_idx * 11) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 13) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 17) % 100)::text, 2, '0')
        WHEN 'BE' THEN '+32 2 ' || (50 + v_idx)::text || ' ' || LPAD(((v_idx * 12) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 14) % 100)::text, 2, '0')
        ELSE '+237 6 ' || (70 + v_idx)::text || ' ' || LPAD(((v_idx * 15) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 19) % 100)::text, 2, '0')
      END,
      -- address (cycle through 7 addresses)
      (ARRAY[
        CASE p_country WHEN 'FR' THEN '12 Avenue des Champs-Elysees' WHEN 'BE' THEN '45 Avenue Louise'         ELSE '8 Rue de la Republique' END,
        CASE p_country WHEN 'FR' THEN '7 Rue du Faubourg Saint-Honore' WHEN 'BE' THEN '23 Rue de la Loi'      ELSE '15 Boulevard de la Liberte' END,
        CASE p_country WHEN 'FR' THEN '34 Boulevard Haussmann' WHEN 'BE' THEN '67 Grand Place'                 ELSE '22 Avenue Charles de Gaulle' END,
        CASE p_country WHEN 'FR' THEN '89 Quai de la Seine'   WHEN 'BE' THEN '12 Place du Luxembourg'          ELSE '5 Rue Foch' END,
        CASE p_country WHEN 'FR' THEN '15 Rue de Rivoli'      WHEN 'BE' THEN '34 Rue du Marche aux Herbes'     ELSE '31 Avenue Kennedy' END,
        CASE p_country WHEN 'FR' THEN '56 Avenue Montaigne'   WHEN 'BE' THEN '78 Boulevard Anspach'            ELSE '44 Rue Nachtigal' END,
        CASE p_country WHEN 'FR' THEN '21 Rue de la Paix'     WHEN 'BE' THEN '9 Rue Neuve'                     ELSE '17 Boulevard du 20 Mai' END
      ])[((v_idx - 1) % 7) + 1] || ' ' || v_idx::text,
      -- city (cycle through 7 cities)
      (ARRAY[
        CASE p_country WHEN 'FR' THEN 'Paris'      WHEN 'BE' THEN 'Bruxelles'  ELSE 'Douala' END,
        CASE p_country WHEN 'FR' THEN 'Lyon'       WHEN 'BE' THEN 'Anvers'     ELSE 'Yaounde' END,
        CASE p_country WHEN 'FR' THEN 'Marseille'  WHEN 'BE' THEN 'Gand'       ELSE 'Libreville' END,
        CASE p_country WHEN 'FR' THEN 'Bordeaux'   WHEN 'BE' THEN 'Liege'      ELSE 'Bamako' END,
        CASE p_country WHEN 'FR' THEN 'Toulouse'   WHEN 'BE' THEN 'Namur'      ELSE 'Abidjan' END,
        CASE p_country WHEN 'FR' THEN 'Nantes'     WHEN 'BE' THEN 'Charleroi'  ELSE 'Dakar' END,
        CASE p_country WHEN 'FR' THEN 'Strasbourg' WHEN 'BE' THEN 'Louvain'    ELSE 'Lome' END
      ])[((v_idx - 1) % 7) + 1],
      -- country, currency, status
      p_country, p_currency, 'active',
      -- supplier_type (cycle)
      (ARRAY['product', 'service', 'both', 'product', 'service', 'both', 'product'])[((v_idx - 1) % 7) + 1],
      -- payment_terms (cycle)
      (ARRAY['Net 30', 'Net 45', 'Net 60', 'Net 30', 'Net 15', 'Net 45', 'Net 60'])[((v_idx - 1) % 7) + 1],
      -- company_id
      p_cid
    );
  END LOOP;

  -- =================================================================
  -- F. SERVICE CATEGORIES (4 per user — user-level, NO company_id)
  -- Skip if already created for this user (idempotent across companies)
  -- =================================================================
  IF NOT EXISTS (
    SELECT 1 FROM service_categories
    WHERE user_id = p_uid AND description LIKE '%seed%'
    LIMIT 1
  ) THEN
    FOR v_i IN 1..4 LOOP
      v_id := gen_random_uuid();
      v_svc_cat_ids := v_svc_cat_ids || v_id;

      INSERT INTO service_categories (id, user_id, name, description)
      VALUES (
        v_id, p_uid,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Conseil & Audit'
                         WHEN 'BE' THEN 'Consulting & Audit'
                         ELSE 'Conseil & Formation' END,
          CASE p_country WHEN 'FR' THEN 'Developpement IT'
                         WHEN 'BE' THEN 'Software Development'
                         ELSE 'Integration Systemes' END,
          CASE p_country WHEN 'FR' THEN 'Marketing Digital'
                         WHEN 'BE' THEN 'Digital Marketing'
                         ELSE 'Communication Digitale' END,
          CASE p_country WHEN 'FR' THEN 'Support & Maintenance'
                         WHEN 'BE' THEN 'IT Support'
                         ELSE 'Assistance Technique' END
        ])[v_i],
        'Comprehensive seed data'
      );
    END LOOP;
  ELSE
    -- Retrieve existing category IDs for linking services
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_svc_cat_ids
    FROM service_categories
    WHERE user_id = p_uid AND description LIKE '%seed%';
  END IF;

  -- =================================================================
  -- G. SERVICES (8 per user — user-level, NO company_id)
  -- Skip if already created for this user (idempotent across companies)
  -- =================================================================
  IF NOT EXISTS (
    SELECT 1 FROM services
    WHERE user_id = p_uid AND description LIKE '%seed%'
    LIMIT 1
  ) THEN
    FOR v_i IN 1..8 LOOP
      v_id := gen_random_uuid();
      v_svc_ids := v_svc_ids || v_id;

      INSERT INTO services (
        id, user_id, service_name, description, category_id,
        pricing_type, hourly_rate, unit, is_active
      ) VALUES (
        v_id, p_uid,
        -- service_name
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Audit diagnostic complet'
                         WHEN 'BE' THEN 'Full compliance audit'
                         ELSE 'Audit organisationnel approfondi' END,
          CASE p_country WHEN 'FR' THEN 'Conseil strategique direction'
                         WHEN 'BE' THEN 'Executive strategic consulting'
                         ELSE 'Conseil strategique PME' END,
          CASE p_country WHEN 'FR' THEN 'Developpement web sur mesure'
                         WHEN 'BE' THEN 'Custom web application'
                         ELSE 'Developpement application web' END,
          CASE p_country WHEN 'FR' THEN 'Integration API & systemes'
                         WHEN 'BE' THEN 'API & system integration'
                         ELSE 'Integration API partenaires' END,
          CASE p_country WHEN 'FR' THEN 'Formation equipe technique'
                         WHEN 'BE' THEN 'Technical team training'
                         ELSE 'Formation utilisateurs finaux' END,
          CASE p_country WHEN 'FR' THEN 'Gestion de projet agile'
                         WHEN 'BE' THEN 'Agile project management'
                         ELSE 'Pilotage projet numerique' END,
          CASE p_country WHEN 'FR' THEN 'Support technique prioritaire'
                         WHEN 'BE' THEN 'Priority tech support'
                         ELSE 'Assistance technique N2/N3' END,
          CASE p_country WHEN 'FR' THEN 'Analyse donnees & reporting'
                         WHEN 'BE' THEN 'Data analytics & BI'
                         ELSE 'Analyse donnees decisionnelle' END
        ])[v_i],
        -- description (for cleanup)
        'Comprehensive seed data',
        -- category_id: distribute 8 services across 4 categories (2 each)
        v_svc_cat_ids[((v_i - 1) / 2) + 1],
        -- pricing_type
        'hourly',
        -- hourly_rate (region-adjusted)
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 150 WHEN 'BE' THEN 160 ELSE 80 END,
          CASE p_country WHEN 'FR' THEN 200 WHEN 'BE' THEN 210 ELSE 100 END,
          CASE p_country WHEN 'FR' THEN 120 WHEN 'BE' THEN 130 ELSE 70 END,
          CASE p_country WHEN 'FR' THEN 130 WHEN 'BE' THEN 140 ELSE 75 END,
          CASE p_country WHEN 'FR' THEN 100 WHEN 'BE' THEN 110 ELSE 60 END,
          CASE p_country WHEN 'FR' THEN 140 WHEN 'BE' THEN 150 ELSE 85 END,
          CASE p_country WHEN 'FR' THEN  90 WHEN 'BE' THEN 100 ELSE 55 END,
          CASE p_country WHEN 'FR' THEN 160 WHEN 'BE' THEN 170 ELSE 90 END
        ])[v_i]::numeric * v_mul,
        -- unit
        'heure',
        -- is_active
        true
      );
    END LOOP;
  ELSE
    -- Retrieve existing service IDs for linking invoice items, etc.
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_svc_ids
    FROM services
    WHERE user_id = p_uid AND description LIKE '%seed%';
  END IF;

  -- =================================================================
  -- H. CLIENTS (7 per company — unique names via p_seq offset)
  -- =================================================================
  FOR v_i IN 1..7 LOOP
    v_id := gen_random_uuid();
    v_client_ids := v_client_ids || v_id;
    v_idx := (p_seq - 1) * 7 + v_i;  -- unique index 1..49

    INSERT INTO clients (
      id, user_id, company_name, contact_name, email, phone,
      address, city, postal_code, country, preferred_currency, company_id
    ) VALUES (
      v_id, p_uid,
      -- company_name: unique per company via v_idx into 49-name pool
      CASE p_country
        WHEN 'FR' THEN v_client_names_fr[v_idx]
        WHEN 'BE' THEN v_client_names_be[v_idx]
        ELSE v_client_names_oh[v_idx]
      END,
      -- contact_name: unique per company via v_idx
      CASE p_country
        WHEN 'FR' THEN v_client_contacts_fr[v_idx]
        WHEN 'BE' THEN v_client_contacts_be[v_idx]
        ELSE v_client_contacts_oh[v_idx]
      END,
      -- email (unique via v_idx)
      'client-' || v_idx || '@demo.cashpilot.cloud',
      -- phone (unique via v_idx)
      CASE p_country
        WHEN 'FR' THEN '+33 1 ' || (40 + v_idx)::text || ' ' || LPAD(((v_idx * 7 + 10) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 3 + 20) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 9) % 100)::text, 2, '0')
        WHEN 'BE' THEN '+32 2 ' || (50 + v_idx)::text || ' ' || LPAD(((v_idx * 8 + 11) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 5 + 15) % 100)::text, 2, '0')
        ELSE '+237 6 ' || (90 + v_idx)::text || ' ' || LPAD(((v_idx * 6 + 12) % 100)::text, 2, '0') || ' ' || LPAD(((v_idx * 4 + 18) % 100)::text, 2, '0')
      END,
      -- address (cycle through 7 addresses)
      (ARRAY[
        CASE p_country WHEN 'FR' THEN '3 Place de la Concorde'    WHEN 'BE' THEN '10 Rue de la Loi'           ELSE '5 Avenue Ahmadou Ahidjo' END,
        CASE p_country WHEN 'FR' THEN '17 Rue Saint-Honore'       WHEN 'BE' THEN '25 Boulevard du Regent'     ELSE '12 Rue Douala Manga Bell' END,
        CASE p_country WHEN 'FR' THEN '42 Avenue de lOpera'       WHEN 'BE' THEN '38 Place Flagey'            ELSE '20 Boulevard de la Liberte' END,
        CASE p_country WHEN 'FR' THEN '8 Rue de la Bourse'        WHEN 'BE' THEN '52 Chaussee de Waterloo'    ELSE '7 Avenue Charles Atangana' END,
        CASE p_country WHEN 'FR' THEN '25 Boulevard des Italiens'  WHEN 'BE' THEN '14 Rue Haute'              ELSE '33 Rue Ivy' END,
        CASE p_country WHEN 'FR' THEN '61 Rue du Commerce'         WHEN 'BE' THEN '71 Avenue de Tervueren'    ELSE '18 Avenue Monseigneur Vogt' END,
        CASE p_country WHEN 'FR' THEN '9 Place Vendome'            WHEN 'BE' THEN '5 Rue des Sablons'         ELSE '41 Rue de Nachtigal' END
      ])[((v_idx - 1) % 7) + 1],
      -- city (cycle through 7 cities)
      (ARRAY[
        CASE p_country WHEN 'FR' THEN 'Paris'       WHEN 'BE' THEN 'Bruxelles'  ELSE 'Douala' END,
        CASE p_country WHEN 'FR' THEN 'Lyon'        WHEN 'BE' THEN 'Anvers'     ELSE 'Yaounde' END,
        CASE p_country WHEN 'FR' THEN 'Marseille'   WHEN 'BE' THEN 'Gand'       ELSE 'Libreville' END,
        CASE p_country WHEN 'FR' THEN 'Bordeaux'    WHEN 'BE' THEN 'Liege'      ELSE 'Abidjan' END,
        CASE p_country WHEN 'FR' THEN 'Toulouse'    WHEN 'BE' THEN 'Namur'      ELSE 'Bamako' END,
        CASE p_country WHEN 'FR' THEN 'Nantes'      WHEN 'BE' THEN 'Charleroi'  ELSE 'Dakar' END,
        CASE p_country WHEN 'FR' THEN 'Strasbourg'  WHEN 'BE' THEN 'Louvain'    ELSE 'Lome' END
      ])[((v_idx - 1) % 7) + 1],
      -- postal_code (cycle through 7)
      (ARRAY[
        CASE p_country WHEN 'FR' THEN '75001' WHEN 'BE' THEN '1000' ELSE 'BP 1000' END,
        CASE p_country WHEN 'FR' THEN '69001' WHEN 'BE' THEN '2000' ELSE 'BP 2000' END,
        CASE p_country WHEN 'FR' THEN '13001' WHEN 'BE' THEN '9000' ELSE 'BP 3000' END,
        CASE p_country WHEN 'FR' THEN '33000' WHEN 'BE' THEN '4000' ELSE 'BP 4000' END,
        CASE p_country WHEN 'FR' THEN '31000' WHEN 'BE' THEN '5000' ELSE 'BP 5000' END,
        CASE p_country WHEN 'FR' THEN '44000' WHEN 'BE' THEN '6000' ELSE 'BP 6000' END,
        CASE p_country WHEN 'FR' THEN '67000' WHEN 'BE' THEN '3000' ELSE 'BP 7000' END
      ])[((v_idx - 1) % 7) + 1],
      -- country, preferred_currency, company_id
      p_country, p_currency, p_cid
    );
  END LOOP;

  -- =================================================================
  -- END OF PART 1 — function continues in Part 2
  -- The variables v_client_ids, v_supplier_ids, v_svc_cat_ids, v_svc_ids
  -- are populated and available for Part 2 to use.
  -- =================================================================

  -- [Assembled from Part 2]
    -- ================================================================
    -- A. PRODUCT CATEGORIES (3 per company)
    -- ================================================================
    FOR v_i IN 1..3 LOOP
      v_id := gen_random_uuid();
      v_prd_cat_ids[v_i] := v_id;

      INSERT INTO product_categories (id, user_id, name, description, company_id)
      VALUES (
        v_id, p_uid,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Licences logicielles'
                    WHEN 'BE' THEN 'Software Licenses'
                    ELSE 'Logiciels & Licences' END,
          CASE p_country WHEN 'FR' THEN 'Materiel informatique'
                    WHEN 'BE' THEN 'Hardware & Equipment'
                    ELSE 'Equipements IT' END,
          CASE p_country WHEN 'FR' THEN 'Consommables'
                    WHEN 'BE' THEN 'Office Supplies'
                    ELSE 'Fournitures Bureau' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Licences SaaS, on-premise et abonnements logiciels'
                    WHEN 'BE' THEN 'SaaS, on-premise and software subscriptions'
                    ELSE 'Licences logicielles et abonnements cloud' END,
          CASE p_country WHEN 'FR' THEN 'Serveurs, postes de travail, peripheriques reseau'
                    WHEN 'BE' THEN 'Servers, workstations, networking peripherals'
                    ELSE 'Serveurs, ordinateurs et equipements reseau' END,
          CASE p_country WHEN 'FR' THEN 'Papeterie, cartouches, petit materiel de bureau'
                    WHEN 'BE' THEN 'Stationery, cartridges and small office items'
                    ELSE 'Papeterie, consommables et fournitures diverses' END
        ])[v_i],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- B. PRODUCTS (7 per company)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      v_id := gen_random_uuid();
      v_prd_ids[v_i] := v_id;

      v_base := (ARRAY[
        CASE p_country WHEN 'FR' THEN 2500 WHEN 'BE' THEN 2800 ELSE 1500 END,
        CASE p_country WHEN 'FR' THEN 1800 WHEN 'BE' THEN 2000 ELSE 1000 END,
        CASE p_country WHEN 'FR' THEN 3200 WHEN 'BE' THEN 3500 ELSE 2000 END,
        CASE p_country WHEN 'FR' THEN 4500 WHEN 'BE' THEN 5000 ELSE 3000 END,
        CASE p_country WHEN 'FR' THEN 1500 WHEN 'BE' THEN 1700 ELSE 900 END,
        CASE p_country WHEN 'FR' THEN 2800 WHEN 'BE' THEN 3100 ELSE 1800 END,
        CASE p_country WHEN 'FR' THEN 900  WHEN 'BE' THEN 1000 ELSE 600 END
      ])[v_i]::numeric * v_mul;

      INSERT INTO products (
        id, user_id, product_name, description, category_id,
        unit_price, purchase_price, unit, stock_quantity,
        min_stock_level, is_active, supplier_id, company_id
      ) VALUES (
        v_id, p_uid,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Licence CRM Pro'
                    WHEN 'BE' THEN 'CRM Pro License'
                    ELSE 'Licence CRM Pro' END,
          CASE p_country WHEN 'FR' THEN 'Pack Formation 10h'
                    WHEN 'BE' THEN 'Training Pack 10h'
                    ELSE 'Pack Formation 10h' END,
          CASE p_country WHEN 'FR' THEN 'Module Analytics'
                    WHEN 'BE' THEN 'Analytics Module'
                    ELSE 'Module Analytics' END,
          CASE p_country WHEN 'FR' THEN 'Support Premium 6 mois'
                    WHEN 'BE' THEN 'Premium Support 6M'
                    ELSE 'Support Premium 6 mois' END,
          CASE p_country WHEN 'FR' THEN 'Passerelle API'
                    WHEN 'BE' THEN 'API Gateway'
                    ELSE 'Passerelle API' END,
          CASE p_country WHEN 'FR' THEN 'Suite Securite'
                    WHEN 'BE' THEN 'Security Suite'
                    ELSE 'Suite Securite' END,
          CASE p_country WHEN 'FR' THEN 'Backup Cloud Annuel'
                    WHEN 'BE' THEN 'Annual Cloud Backup'
                    ELSE 'Backup Cloud Annuel' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Solution CRM complete avec gestion contacts, pipeline ventes et reporting avance'
                    WHEN 'BE' THEN 'Complete CRM solution with contact management, sales pipeline and advanced reporting'
                    ELSE 'Solution CRM complete avec gestion contacts, pipeline de ventes et tableaux de bord' END,
          CASE p_country WHEN 'FR' THEN 'Pack de 10 heures de formation personnalisee sur site ou a distance'
                    WHEN 'BE' THEN '10-hour customized training package, on-site or remote'
                    ELSE 'Pack de 10 heures de formation personnalisee en presentiel ou a distance' END,
          CASE p_country WHEN 'FR' THEN 'Module de business intelligence avec tableaux de bord interactifs et KPI temps reel'
                    WHEN 'BE' THEN 'Business intelligence module with interactive dashboards and real-time KPIs'
                    ELSE 'Module d analyse de donnees avec tableaux de bord et indicateurs temps reel' END,
          CASE p_country WHEN 'FR' THEN 'Contrat support premium 6 mois avec SLA 4h et hotline dediee'
                    WHEN 'BE' THEN '6-month premium support contract with 4h SLA and dedicated hotline'
                    ELSE 'Contrat de support premium 6 mois avec intervention sous 4 heures garantie' END,
          CASE p_country WHEN 'FR' THEN 'Passerelle API RESTful pour integration ERP/CRM avec documentation Swagger'
                    WHEN 'BE' THEN 'RESTful API gateway for ERP/CRM integration with Swagger documentation'
                    ELSE 'Passerelle API REST pour connecter vos systemes ERP et CRM existants' END,
          CASE p_country WHEN 'FR' THEN 'Suite de securite complete : firewall, antivirus endpoint, audit vulnerabilites'
                    WHEN 'BE' THEN 'Complete security suite: firewall, endpoint antivirus, vulnerability audit'
                    ELSE 'Suite de securite integree avec pare-feu, antivirus et audit de vulnerabilites' END,
          CASE p_country WHEN 'FR' THEN 'Sauvegarde cloud annuelle 500 Go avec chiffrement AES-256 et restauration instantanee'
                    WHEN 'BE' THEN 'Annual 500GB cloud backup with AES-256 encryption and instant restore'
                    ELSE 'Sauvegarde cloud annuelle 500 Go avec chiffrement et restauration rapide' END
        ])[v_i],
        -- Rotate through 3 categories: 1,2,3,1,2,3,1
        v_prd_cat_ids[((v_i - 1) % 3) + 1],
        v_base,
        ROUND(v_base * 0.45, 2),
        'unite',
        (ARRAY[15, 25, 10, 20, 35, 12, 40])[v_i]::numeric,
        5, true,
        -- Rotate through 7 suppliers
        v_supplier_ids[((v_i - 1) % 7) + 1],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- C. SUPPLIER PRODUCTS (7 per company)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      v_id := gen_random_uuid();
      v_sup_prd_ids := v_sup_prd_ids || v_id;

      INSERT INTO supplier_products (id, supplier_id, product_name, sku, unit_price, company_id)
      VALUES (
        v_id,
        v_supplier_ids[((v_i - 1) % 7) + 1],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Composant serveur rack 2U'
                    WHEN 'BE' THEN '2U Rack Server Component'
                    ELSE 'Composant serveur rack 2U' END,
          CASE p_country WHEN 'FR' THEN 'Licence SaaS annuelle Pro'
                    WHEN 'BE' THEN 'Annual Pro SaaS License'
                    ELSE 'Licence SaaS Pro annuelle' END,
          CASE p_country WHEN 'FR' THEN 'Switch reseau 48 ports'
                    WHEN 'BE' THEN '48-Port Network Switch'
                    ELSE 'Commutateur reseau 48 ports' END,
          CASE p_country WHEN 'FR' THEN 'Disque SSD NVMe 1To'
                    WHEN 'BE' THEN '1TB NVMe SSD Drive'
                    ELSE 'Disque SSD NVMe 1 To' END,
          CASE p_country WHEN 'FR' THEN 'Cable fibre optique 10m'
                    WHEN 'BE' THEN '10m Fiber Optic Cable'
                    ELSE 'Cable fibre optique 10 m' END,
          CASE p_country WHEN 'FR' THEN 'Module RAM DDR5 32Go'
                    WHEN 'BE' THEN '32GB DDR5 RAM Module'
                    ELSE 'Barrette RAM DDR5 32 Go' END,
          CASE p_country WHEN 'FR' THEN 'Onduleur APC 1500VA'
                    WHEN 'BE' THEN 'APC UPS 1500VA'
                    ELSE 'Onduleur APC 1500 VA' END
        ])[v_i],
        'SUP-SKU-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 2, '0'),
        (ARRAY[850, 1200, 480, 195, 45, 310, 620])[v_i]::numeric * v_mul,
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- D. INVOICES (7 per company) — INSERT AS DRAFT FIRST
    --    Trigger auto_journal_invoice does NOT fire on 'draft'
    -- ================================================================
    v_invoice_ids := ARRAY[]::UUID[];

    FOR v_i IN 1..7 LOOP
      -- Base amount with company-specific hash for variety
      v_base := (3000 + v_i * 1200
                 + ABS(hashtext(p_cid::text) % 2000)
                ) * v_mul;
      v_tax  := ROUND(v_base * v_rate / 100, 2);
      v_ttc  := v_base + v_tax;

      -- Determine payment status and paid amount
      IF v_i <= 2 THEN
        -- Fully paid
        v_pay_status := 'paid';
        v_paid := v_ttc;
      ELSIF v_i <= 4 THEN
        -- Partially paid (50%)
        v_pay_status := 'partial';
        v_paid := ROUND(v_ttc * 0.5, 2);
      ELSIF v_i <= 6 THEN
        -- Unpaid
        v_pay_status := 'unpaid';
        v_paid := 0;
      ELSE
        -- Overdue (due_date in the past) — but constraint only allows unpaid/partial/paid
        v_pay_status := 'unpaid';
        v_paid := 0;
      END IF;

      v_id := gen_random_uuid();
      v_invoice_ids := v_invoice_ids || v_id;

      INSERT INTO invoices (
        id, user_id, client_id, invoice_number, date, due_date, status,
        total_ht, tax_rate, total_ttc, notes,
        amount_paid, balance_due, payment_status,
        company_id, currency,
        header_note, footer_note, terms_and_conditions, reference,
        invoice_type, discount_type, discount_value, discount_amount,
        shipping_fee, adjustment
      ) VALUES (
        v_id, p_uid,
        v_client_ids[((v_i - 1) % 7) + 1],
        v_pfx || '-' || v_cid4 || '-INV-' || LPAD(v_i::text, 3, '0'),
        -- Spread across 2026: Jan 10, Feb 18, Mar 25, Apr 5, May 14, Jun 22, Jul 8
        (ARRAY[
          '2026-01-10','2026-02-18','2026-03-25','2026-04-05',
          '2026-05-14','2026-06-22','2026-07-08'
        ])[v_i]::date,
        -- Due date: date + 30 days, except invoice 7 which is overdue (past)
        CASE WHEN v_i = 7 THEN '2026-01-15'::date
             ELSE (ARRAY[
               '2026-02-09','2026-03-20','2026-04-24','2026-05-05',
               '2026-06-13','2026-07-22','2026-08-07'
             ])[v_i]::date
        END,
        'draft',  -- ← DRAFT: auto_journal_invoice does NOT trigger
        v_base, v_rate, v_ttc,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Mise en place CRM et parametrage initial'
                    WHEN 'BE' THEN 'CRM setup and initial configuration'
                    ELSE 'Installation CRM et configuration initiale' END,
          CASE p_country WHEN 'FR' THEN 'Audit securite trimestriel et rapport de conformite'
                    WHEN 'BE' THEN 'Quarterly security audit and compliance report'
                    ELSE 'Audit de securite trimestriel avec rapport detaille' END,
          CASE p_country WHEN 'FR' THEN 'Developpement module reporting personnalise'
                    WHEN 'BE' THEN 'Custom reporting module development'
                    ELSE 'Developpement module de reporting sur mesure' END,
          CASE p_country WHEN 'FR' THEN 'Migration infrastructure cloud et formation equipe'
                    WHEN 'BE' THEN 'Cloud infrastructure migration and team training'
                    ELSE 'Migration cloud et formation des equipes techniques' END,
          CASE p_country WHEN 'FR' THEN 'Integration API partenaires et tests de charge'
                    WHEN 'BE' THEN 'Partner API integration and load testing'
                    ELSE 'Integration API avec les systemes partenaires' END,
          CASE p_country WHEN 'FR' THEN 'Refonte UX/UI portail client avec responsive design'
                    WHEN 'BE' THEN 'Client portal UX/UI redesign with responsive layout'
                    ELSE 'Refonte interface utilisateur du portail client' END,
          CASE p_country WHEN 'FR' THEN 'Maintenance preventive et mise a jour infrastructure'
                    WHEN 'BE' THEN 'Preventive maintenance and infrastructure update'
                    ELSE 'Maintenance preventive et mise a jour des serveurs' END
        ])[v_i],
        v_paid,
        v_ttc - v_paid,
        v_pay_status,
        p_cid, p_currency,
        CASE p_country WHEN 'FR' THEN 'Merci pour votre confiance.'
                  WHEN 'BE' THEN 'Thank you for your trust.'
                  ELSE 'Merci pour votre confiance.' END,
        CASE p_country WHEN 'FR' THEN 'TVA non deductible Art. 293B du CGI'
                  WHEN 'BE' THEN 'VAT applicable per Belgian tax code'
                  ELSE 'TVA applicable selon la reglementation OHADA' END,
        CASE p_country WHEN 'FR' THEN 'Paiement sous 30 jours. Penalite de retard : 3x taux legal.'
                  WHEN 'BE' THEN 'Payment within 30 days. Late penalty: 3x legal rate.'
                  ELSE 'Paiement a 30 jours. Penalite de retard selon reglementation en vigueur.' END,
        'REF-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 3, '0'),
        'mixed', 'none', 0, 0, 0, 0
      );
    END LOOP;

    -- ================================================================
    -- E. INVOICE ITEMS (2 per invoice = 14 total)
    --    Item 1: service (60% of base), Item 2: product (40% of base)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      -- Recalculate base for this invoice (same formula as above)
      v_base := (3000 + v_i * 1200
                 + ABS(hashtext(p_cid::text) % 2000)
                ) * v_mul;

      -- Service item (60% of base)
      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, total,
        item_type, service_id,
        discount_type, discount_value, discount_amount, hsn_code
      ) VALUES (
        gen_random_uuid(),
        v_invoice_ids[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Audit diagnostic initial et recommandations'
                    WHEN 'BE' THEN 'Initial diagnostic audit and recommendations'
                    ELSE 'Audit diagnostic initial et plan d action' END,
          CASE p_country WHEN 'FR' THEN 'Conseil strategique transformation digitale'
                    WHEN 'BE' THEN 'Digital transformation strategic consulting'
                    ELSE 'Conseil strategique en transformation numerique' END,
          CASE p_country WHEN 'FR' THEN 'Developpement fonctionnalites sur mesure'
                    WHEN 'BE' THEN 'Custom feature development sprint'
                    ELSE 'Developpement de fonctionnalites personnalisees' END,
          CASE p_country WHEN 'FR' THEN 'Formation utilisateurs et accompagnement'
                    WHEN 'BE' THEN 'User training and onboarding support'
                    ELSE 'Formation des utilisateurs et accompagnement terrain' END,
          CASE p_country WHEN 'FR' THEN 'Integration systemes et middleware'
                    WHEN 'BE' THEN 'Systems integration and middleware setup'
                    ELSE 'Integration des systemes et configuration middleware' END,
          CASE p_country WHEN 'FR' THEN 'Optimisation performance et scalabilite'
                    WHEN 'BE' THEN 'Performance optimization and scalability tuning'
                    ELSE 'Optimisation des performances et montee en charge' END,
          CASE p_country WHEN 'FR' THEN 'Support technique avance et monitoring'
                    WHEN 'BE' THEN 'Advanced technical support and monitoring'
                    ELSE 'Support technique avance et surveillance systemes' END
        ])[v_i],
        -- Quantity: varies per invoice (2-8 hours/units)
        (ARRAY[4, 6, 8, 3, 5, 7, 2])[v_i]::numeric,
        -- Unit price calculated to match 60% of base
        ROUND(v_base * 0.6 / (ARRAY[4, 6, 8, 3, 5, 7, 2])[v_i]::numeric, 2),
        ROUND(v_base * 0.6, 2),
        'service',
        v_svc_ids[((v_i - 1) % 8) + 1],
        'none', 0, 0, ''
      );

      -- Product item (40% of base)
      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, total,
        item_type, product_id,
        discount_type, discount_value, discount_amount, hsn_code
      ) VALUES (
        gen_random_uuid(),
        v_invoice_ids[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Licence CRM Pro - deploiement entreprise'
                    WHEN 'BE' THEN 'CRM Pro License - enterprise deployment'
                    ELSE 'Licence CRM Pro - deploiement sur site' END,
          CASE p_country WHEN 'FR' THEN 'Pack Formation 10h - equipe commerciale'
                    WHEN 'BE' THEN 'Training Pack 10h - sales team'
                    ELSE 'Pack Formation 10h - equipe terrain' END,
          CASE p_country WHEN 'FR' THEN 'Module Analytics - version entreprise'
                    WHEN 'BE' THEN 'Analytics Module - enterprise edition'
                    ELSE 'Module Analytics - edition entreprise' END,
          CASE p_country WHEN 'FR' THEN 'Support Premium 6 mois - renouvellement'
                    WHEN 'BE' THEN 'Premium Support 6M - renewal'
                    ELSE 'Support Premium 6 mois - renouvellement contrat' END,
          CASE p_country WHEN 'FR' THEN 'Passerelle API - licence connecteur ERP'
                    WHEN 'BE' THEN 'API Gateway - ERP connector license'
                    ELSE 'Passerelle API - connecteur ERP' END,
          CASE p_country WHEN 'FR' THEN 'Suite Securite - pack protection avancee'
                    WHEN 'BE' THEN 'Security Suite - advanced protection pack'
                    ELSE 'Suite Securite - protection avancee' END,
          CASE p_country WHEN 'FR' THEN 'Backup Cloud Annuel - extension 1To'
                    WHEN 'BE' THEN 'Annual Cloud Backup - 1TB extension'
                    ELSE 'Backup Cloud Annuel - extension stockage 1To' END
        ])[v_i],
        -- Quantity: varies (1-5 units)
        (ARRAY[2, 1, 3, 1, 4, 2, 5])[v_i]::numeric,
        -- Unit price calculated to match 40% of base
        ROUND(v_base * 0.4 / (ARRAY[2, 1, 3, 1, 4, 2, 5])[v_i]::numeric, 2),
        ROUND(v_base * 0.4, 2),
        'product',
        v_prd_ids[((v_i - 1) % 7) + 1],
        'none', 0, 0, ''
      );
    END LOOP;

    -- ================================================================
    -- F. BATCH UPDATE INVOICES: draft -> sent (triggers fire HERE)
    --    auto_journal_invoice() now sees invoice_items for proper
    --    revenue.product / revenue.service split
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      UPDATE invoices
      SET status = 'sent'
      WHERE id = v_invoice_ids[v_i];
    END LOOP;

    -- ================================================================
    -- G. PAYMENTS (7 — one per invoice)
    --    Invoices 1-2: full payment
    --    Invoices 3-4: 50% payment
    --    Invoices 5-7: 10% small payment
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      -- Recalculate amounts for this invoice
      v_base := (3000 + v_i * 1200
                 + ABS(hashtext(p_cid::text) % 2000)
                ) * v_mul;
      v_tax  := ROUND(v_base * v_rate / 100, 2);
      v_ttc  := v_base + v_tax;

      IF v_i <= 2 THEN
        v_paid := v_ttc;  -- 100%
      ELSIF v_i <= 4 THEN
        v_paid := ROUND(v_ttc * 0.5, 2);  -- 50%
      ELSE
        v_paid := ROUND(v_ttc * 0.10, 2);  -- 10% small payment
      END IF;

      INSERT INTO payments (
        id, user_id, invoice_id, amount, payment_date,
        payment_method, reference, notes, company_id
      ) VALUES (
        gen_random_uuid(), p_uid,
        v_invoice_ids[v_i],
        v_paid,
        -- Payment dates staggered: 5-15 days after invoice date
        (ARRAY[
          '2026-01-18','2026-02-26','2026-04-02','2026-04-15',
          '2026-05-28','2026-07-05','2026-07-20'
        ])[v_i]::date,
        (ARRAY['bank_transfer','card','check','cash','paypal','bank_transfer','card'])[v_i],
        'PAY-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 3, '0'),
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Virement SEPA - reglement facture CRM'
                    WHEN 'BE' THEN 'SEPA transfer - CRM invoice payment'
                    ELSE 'Virement bancaire - reglement facture CRM' END,
          CASE p_country WHEN 'FR' THEN 'Paiement CB Visa - audit securite'
                    WHEN 'BE' THEN 'Visa card payment - security audit'
                    ELSE 'Paiement par carte - audit de securite' END,
          CASE p_country WHEN 'FR' THEN 'Cheque n.45892 - acompte module reporting'
                    WHEN 'BE' THEN 'Check #45892 - reporting module deposit'
                    ELSE 'Cheque n.45892 - acompte module reporting' END,
          CASE p_country WHEN 'FR' THEN 'Especes - acompte migration cloud'
                    WHEN 'BE' THEN 'Cash - cloud migration deposit'
                    ELSE 'Especes - acompte migration cloud' END,
          CASE p_country WHEN 'FR' THEN 'PayPal - acompte integration API'
                    WHEN 'BE' THEN 'PayPal - API integration deposit'
                    ELSE 'PayPal - acompte integration API' END,
          CASE p_country WHEN 'FR' THEN 'Virement SEPA - acompte refonte UX'
                    WHEN 'BE' THEN 'SEPA transfer - UX redesign deposit'
                    ELSE 'Virement bancaire - acompte refonte interface' END,
          CASE p_country WHEN 'FR' THEN 'CB Mastercard - acompte maintenance'
                    WHEN 'BE' THEN 'Mastercard - maintenance deposit'
                    ELSE 'Carte bancaire - acompte maintenance' END
        ])[v_i],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- H. QUOTES (7 per company)
    --    1-2: accepted, 3-4: sent, 5-6: draft, 7: rejected
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      v_base := (5000 + v_i * 2500
                 + ABS(hashtext(p_cid::text || 'quotes') % 3000)
                ) * v_mul;
      v_tax  := ROUND(v_base * v_rate / 100, 2);
      v_ttc  := v_base + v_tax;

      IF v_i <= 2 THEN
        v_status := 'accepted';
      ELSIF v_i <= 4 THEN
        v_status := 'sent';
      ELSIF v_i <= 6 THEN
        v_status := 'draft';
      ELSE
        v_status := 'rejected';
      END IF;

      INSERT INTO quotes (
        id, user_id, client_id, quote_number, date, status,
        total_ht, tax_rate, total_ttc, notes, company_id
      ) VALUES (
        gen_random_uuid(), p_uid,
        v_client_ids[((v_i - 1) % 7) + 1],
        v_pfx || '-' || v_cid4 || '-QTE-' || LPAD(v_i::text, 3, '0'),
        -- Spread across 2026
        (ARRAY[
          '2026-01-05','2026-02-12','2026-03-08','2026-04-17',
          '2026-05-03','2026-06-11','2026-07-25'
        ])[v_i]::date,
        v_status,
        v_base, v_rate, v_ttc,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Proposition commerciale : solution CRM complete avec integration ERP'
                    WHEN 'BE' THEN 'Commercial proposal: complete CRM solution with ERP integration'
                    ELSE 'Proposition commerciale : solution CRM integree avec ERP existant' END,
          CASE p_country WHEN 'FR' THEN 'Devis audit de securite annuel avec penetration testing'
                    WHEN 'BE' THEN 'Annual security audit quote with penetration testing'
                    ELSE 'Devis pour audit de securite annuel et tests d intrusion' END,
          CASE p_country WHEN 'FR' THEN 'Estimation refonte portail client avec UX responsive'
                    WHEN 'BE' THEN 'Client portal redesign estimate with responsive UX'
                    ELSE 'Estimation refonte portail client avec design responsive' END,
          CASE p_country WHEN 'FR' THEN 'Projet migration infrastructure vers le cloud hybride'
                    WHEN 'BE' THEN 'Hybrid cloud infrastructure migration project'
                    ELSE 'Projet de migration vers infrastructure cloud hybride' END,
          CASE p_country WHEN 'FR' THEN 'Brouillon : programme de formation continue equipe IT'
                    WHEN 'BE' THEN 'Draft: continuous training program for IT team'
                    ELSE 'Brouillon : programme de formation continue equipe technique' END,
          CASE p_country WHEN 'FR' THEN 'Brouillon : mise en place RGPD et conformite donnees'
                    WHEN 'BE' THEN 'Draft: GDPR implementation and data compliance'
                    ELSE 'Brouillon : mise en conformite protection des donnees' END,
          CASE p_country WHEN 'FR' THEN 'Devis rejete : ancien projet de virtualisation (devis expire)'
                    WHEN 'BE' THEN 'Rejected quote: legacy virtualization project (quote expired)'
                    ELSE 'Devis rejete : projet de virtualisation serveurs (expire)' END
        ])[v_i],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- I. EXPENSES (7 per company — triggers auto_journal_expense)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      -- TTC amounts with variety
      v_ttc := (ARRAY[
        CASE p_country WHEN 'FR' THEN 245.80  WHEN 'BE' THEN 198.50  ELSE 85000 END,
        CASE p_country WHEN 'FR' THEN 1490.00 WHEN 'BE' THEN 1680.00 ELSE 550000 END,
        CASE p_country WHEN 'FR' THEN 387.60  WHEN 'BE' THEN 425.00  ELSE 175000 END,
        CASE p_country WHEN 'FR' THEN 156.40  WHEN 'BE' THEN 142.80  ELSE 45000 END,
        CASE p_country WHEN 'FR' THEN 2850.00 WHEN 'BE' THEN 3200.00 ELSE 980000 END,
        CASE p_country WHEN 'FR' THEN 89.90   WHEN 'BE' THEN 75.60   ELSE 35000 END,
        CASE p_country WHEN 'FR' THEN 1800.00 WHEN 'BE' THEN 2100.00 ELSE 750000 END
      ])[v_i]::numeric;

      v_base := ROUND(v_ttc / (1 + v_rate / 100), 2);
      v_tax  := v_ttc - v_base;

      INSERT INTO expenses (
        id, user_id, description, amount, amount_ht,
        tax_amount, tax_rate, category, expense_date,
        company_id, receipt_url
      ) VALUES (
        gen_random_uuid(), p_uid,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Fournitures bureau : papier A4, cartouches toner, post-it et stylos'
                    WHEN 'BE' THEN 'Office supplies: A4 paper, toner cartridges, post-its and pens'
                    ELSE 'Fournitures bureau : papier A4, cartouches et petit materiel' END,
          CASE p_country WHEN 'FR' THEN 'Abonnement cloud AWS - hebergement production et staging'
                    WHEN 'BE' THEN 'AWS cloud subscription - production and staging hosting'
                    ELSE 'Abonnement hebergement cloud - serveurs production' END,
          CASE p_country WHEN 'FR' THEN 'Deplacement client Lyon : train A/R, taxi, parking'
                    WHEN 'BE' THEN 'Client travel to Antwerp: round-trip train, taxi, parking'
                    ELSE 'Deplacement client Douala : transport, carburant et peage' END,
          CASE p_country WHEN 'FR' THEN 'Repas affaires restaurant Le Comptoir - prospection Q1'
                    WHEN 'BE' THEN 'Business lunch at De Belgische Keuken - Q1 prospecting'
                    ELSE 'Repas affaires Restaurant Le Baobab - reunion clients' END,
          CASE p_country WHEN 'FR' THEN 'Assurance RC Pro annuelle MMA - couverture conseil IT'
                    WHEN 'BE' THEN 'Annual professional liability insurance KBC - IT consulting'
                    ELSE 'Assurance responsabilite civile professionnelle annuelle' END,
          CASE p_country WHEN 'FR' THEN 'Forfait telephonie mobile Orange Pro - 3 lignes'
                    WHEN 'BE' THEN 'Proximus Pro mobile plan - 3 lines'
                    ELSE 'Forfait telephonie mobile MTN Pro - 3 lignes' END,
          CASE p_country WHEN 'FR' THEN 'Formation professionnelle : certification AWS Solutions Architect'
                    WHEN 'BE' THEN 'Professional training: AWS Solutions Architect certification'
                    ELSE 'Formation professionnelle : certification cloud et infrastructure' END
        ])[v_i],
        v_ttc,    -- amount (TTC)
        v_base,   -- amount_ht
        v_tax,    -- tax_amount
        v_rate / 100.0,  -- tax_rate as decimal (0.20, 0.21, 0.18)
        (ARRAY['supplies','software','travel','meals','insurance','telecom','training'])[v_i],
        -- Spread across 2026
        (ARRAY[
          '2026-01-08','2026-02-03','2026-03-15','2026-03-28',
          '2026-04-10','2026-05-05','2026-06-18'
        ])[v_i]::date,
        p_cid,
        -- receipt_url: storage path for document traceability
        p_uid || '/receipts/' || v_pfx || '-' || v_cid4 || '-expense-' || v_i || '.pdf'
      );
    END LOOP;

    RAISE NOTICE 'Part 2 seeded for company %: 3 product_categories, 7 products, 7 supplier_products, 7 invoices (draft->sent), 14 invoice_items, 7 payments, 7 quotes, 7 expenses', p_cname;

-- ============================================================================
-- END OF PART 2
-- ============================================================================

  -- [Assembled from Part 3]

    -- ================================================================
    -- A. SUPPLIER ORDERS (7) + ORDER ITEMS (2 per order = 14)
    -- ================================================================
    DECLARE
      v_order_id UUID;
      v_sup_order_ids UUID[] := ARRAY[]::UUID[];
    BEGIN
    FOR v_i IN 1..7 LOOP
      v_order_id := gen_random_uuid();
      v_sup_order_ids := v_sup_order_ids || v_order_id;
      v_base := (ARRAY[3500, 7200, 4800, 12500, 2900, 9600, 5500])[v_i]::numeric * v_mul;

      INSERT INTO supplier_orders (
        id, user_id, supplier_id, order_number, order_date,
        expected_delivery_date, order_status, total_amount, notes, company_id
      ) VALUES (
        v_order_id, p_uid,
        v_supplier_ids[((v_i - 1) % 7) + 1],
        'SO-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 3, '0'),
        ('2025-' || LPAD(GREATEST(1, ((v_i * 2 - 1) % 12) + 1)::text, 2, '0') || '-' || LPAD((5 + v_i)::text, 2, '0'))::date,
        ('2026-' || LPAD(GREATEST(1, ((v_i * 2) % 12) + 1)::text, 2, '0') || '-' || LPAD((10 + v_i)::text, 2, '0'))::date,
        (ARRAY['received','confirmed','pending','draft','cancelled','received','confirmed'])[v_i],
        v_base,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Commande composants serveur' WHEN 'BE' THEN 'Server component order' ELSE 'Commande pieces reseau' END,
          CASE p_country WHEN 'FR' THEN 'Renouvellement licences annuelles' WHEN 'BE' THEN 'Annual license renewal' ELSE 'Renouvellement licences cloud' END,
          CASE p_country WHEN 'FR' THEN 'Fournitures bureau trimestrielles' WHEN 'BE' THEN 'Quarterly office supplies' ELSE 'Fournitures bureau Q3' END,
          CASE p_country WHEN 'FR' THEN 'Equipement salle conference' WHEN 'BE' THEN 'Conference room equipment' ELSE 'Equipement salle reunion' END,
          CASE p_country WHEN 'FR' THEN 'Commande test annulee' WHEN 'BE' THEN 'Cancelled test order' ELSE 'Commande test annulee' END,
          CASE p_country WHEN 'FR' THEN 'Materiel informatique Q4' WHEN 'BE' THEN 'IT equipment Q4' ELSE 'Materiel IT fin annee' END,
          CASE p_country WHEN 'FR' THEN 'Prestation maintenance semestrielle' WHEN 'BE' THEN 'Semi-annual maintenance' ELSE 'Maintenance semestrielle' END
        ])[v_i],
        p_cid
      );

      -- 2 items per order
      INSERT INTO supplier_order_items (id, order_id, product_id, quantity, unit_price, total_price)
      VALUES
        (gen_random_uuid(), v_order_id,
         v_sup_prd_ids[((v_i - 1) % 7) + 1],
         (ARRAY[10, 5, 20, 3, 8, 15, 6])[v_i]::numeric,
         ROUND(v_base * 0.6 / GREATEST((ARRAY[10, 5, 20, 3, 8, 15, 6])[v_i], 1), 2),
         ROUND(v_base * 0.6, 2)),
        (gen_random_uuid(), v_order_id,
         v_sup_prd_ids[((v_i) % 7) + 1],
         (ARRAY[5, 12, 8, 2, 4, 7, 10])[v_i]::numeric,
         ROUND(v_base * 0.4 / GREATEST((ARRAY[5, 12, 8, 2, 4, 7, 10])[v_i], 1), 2),
         ROUND(v_base * 0.4, 2));
    END LOOP;
    END;

    -- ================================================================
    -- B. PURCHASE ORDERS (7)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      v_base := (ARRAY[8500, 15200, 6300, 22000, 9800, 11500, 7400])[v_i]::numeric * v_mul;

      INSERT INTO purchase_orders (
        id, user_id, client_id, po_number, date, due_date,
        total, status, notes, company_id, items
      ) VALUES (
        gen_random_uuid(), p_uid,
        v_client_ids[((v_i - 1) % 7) + 1],
        'PO-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 3, '0'),
        ('2025-' || LPAD(GREATEST(1, ((v_i * 2 - 1) % 12) + 1)::text, 2, '0') || '-01')::date,
        ('2026-' || LPAD(GREATEST(1, ((v_i * 2) % 12) + 1)::text, 2, '0') || '-01')::date,
        ROUND(v_base * (1 + v_rate / 100), 2),
        (ARRAY['confirmed','sent','draft','confirmed','sent','draft','confirmed'])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Commande developpement web' WHEN 'BE' THEN 'Web development order' ELSE 'Commande dev web' END,
          CASE p_country WHEN 'FR' THEN 'Migration infrastructure cloud' WHEN 'BE' THEN 'Cloud infrastructure migration' ELSE 'Migration cloud' END,
          CASE p_country WHEN 'FR' THEN 'Brouillon audit securite' WHEN 'BE' THEN 'Security audit draft' ELSE 'Brouillon audit' END,
          CASE p_country WHEN 'FR' THEN 'Projet transformation digitale' WHEN 'BE' THEN 'Digital transformation project' ELSE 'Transformation digitale' END,
          CASE p_country WHEN 'FR' THEN 'Formation equipe technique' WHEN 'BE' THEN 'Technical team training' ELSE 'Formation technique' END,
          CASE p_country WHEN 'FR' THEN 'Brouillon maintenance annuelle' WHEN 'BE' THEN 'Annual maintenance draft' ELSE 'Brouillon maintenance' END,
          CASE p_country WHEN 'FR' THEN 'Support et accompagnement' WHEN 'BE' THEN 'Support and guidance' ELSE 'Accompagnement client' END
        ])[v_i],
        p_cid,
        jsonb_build_array(
          jsonb_build_object(
            'description',
            (ARRAY[
              CASE p_country WHEN 'FR' THEN 'Analyse et conception' WHEN 'BE' THEN 'Analysis & design' ELSE 'Analyse fonctionnelle' END,
              CASE p_country WHEN 'FR' THEN 'Architecture technique' WHEN 'BE' THEN 'Technical architecture' ELSE 'Architecture systeme' END,
              CASE p_country WHEN 'FR' THEN 'Maquettes UI/UX' WHEN 'BE' THEN 'UI/UX mockups' ELSE 'Prototypage UI' END,
              CASE p_country WHEN 'FR' THEN 'Developpement backend' WHEN 'BE' THEN 'Backend development' ELSE 'Dev backend API' END,
              CASE p_country WHEN 'FR' THEN 'Tests fonctionnels' WHEN 'BE' THEN 'Functional testing' ELSE 'Tests utilisateurs' END,
              CASE p_country WHEN 'FR' THEN 'Documentation technique' WHEN 'BE' THEN 'Technical documentation' ELSE 'Documentation projet' END,
              CASE p_country WHEN 'FR' THEN 'Deploiement production' WHEN 'BE' THEN 'Production deployment' ELSE 'Mise en production' END
            ])[v_i],
            'quantity', (ARRAY[8, 12, 5, 20, 6, 10, 15])[v_i],
            'unit_price', ROUND(v_base * 0.55 / GREATEST((ARRAY[8, 12, 5, 20, 6, 10, 15])[v_i], 1), 2),
            'total', ROUND(v_base * 0.55, 2)
          ),
          jsonb_build_object(
            'description',
            (ARRAY[
              CASE p_country WHEN 'FR' THEN 'Gestion de projet' WHEN 'BE' THEN 'Project management' ELSE 'Pilotage projet' END,
              CASE p_country WHEN 'FR' THEN 'Coordination equipe' WHEN 'BE' THEN 'Team coordination' ELSE 'Coordination equipes' END,
              CASE p_country WHEN 'FR' THEN 'Revue qualite' WHEN 'BE' THEN 'Quality review' ELSE 'Controle qualite' END,
              CASE p_country WHEN 'FR' THEN 'Integration continue' WHEN 'BE' THEN 'Continuous integration' ELSE 'CI/CD pipeline' END,
              CASE p_country WHEN 'FR' THEN 'Suivi post-livraison' WHEN 'BE' THEN 'Post-delivery follow-up' ELSE 'Suivi apres livraison' END,
              CASE p_country WHEN 'FR' THEN 'Assistance utilisateur' WHEN 'BE' THEN 'User assistance' ELSE 'Assistance utilisateurs' END,
              CASE p_country WHEN 'FR' THEN 'Support premium 3 mois' WHEN 'BE' THEN 'Premium support 3M' ELSE 'Support premium' END
            ])[v_i],
            'quantity', (ARRAY[4, 6, 3, 10, 4, 5, 8])[v_i],
            'unit_price', ROUND(v_base * 0.45 / GREATEST((ARRAY[4, 6, 3, 10, 4, 5, 8])[v_i], 1), 2),
            'total', ROUND(v_base * 0.45, 2)
          )
        )
      );
    END LOOP;

    -- ================================================================
    -- C. SUPPLIER INVOICES (7) — disable triggers first
    -- ================================================================
    EXECUTE 'ALTER TABLE supplier_invoices DISABLE TRIGGER "02_trg_enforce_supplier_invoice_approval_role_guard"';
    EXECUTE 'ALTER TABLE supplier_invoices DISABLE TRIGGER trg_assign_supplier_invoice_user_id';

    DECLARE
      v_sinv_id UUID;
      v_sinv_status TEXT;
      v_sinv_pay_status TEXT;
      v_sinv_approval TEXT;
    BEGIN
    FOR v_i IN 1..7 LOOP
      v_sinv_id := gen_random_uuid();
      v_base := (ARRAY[
        CASE p_country WHEN 'FR' THEN 4200 WHEN 'BE' THEN 4680 ELSE 2750 END,
        CASE p_country WHEN 'FR' THEN 8700 WHEN 'BE' THEN 9350 ELSE 5700 END,
        CASE p_country WHEN 'FR' THEN 3500 WHEN 'BE' THEN 3900 ELSE 2300 END,
        CASE p_country WHEN 'FR' THEN 6100 WHEN 'BE' THEN 6800 ELSE 4000 END,
        CASE p_country WHEN 'FR' THEN 2800 WHEN 'BE' THEN 3150 ELSE 1850 END,
        CASE p_country WHEN 'FR' THEN 5400 WHEN 'BE' THEN 6000 ELSE 3500 END,
        CASE p_country WHEN 'FR' THEN 9200 WHEN 'BE' THEN 10200 ELSE 6000 END
      ])[v_i]::numeric * v_mul;
      v_tax  := ROUND(v_base * v_rate / 100, 2);
      v_ttc  := v_base + v_tax;

      -- Statuses per spec
      IF v_i <= 2 THEN
        v_sinv_status := 'received'; v_sinv_pay_status := 'paid'; v_sinv_approval := 'approved';
      ELSIF v_i <= 4 THEN
        v_sinv_status := 'received'; v_sinv_pay_status := 'pending'; v_sinv_approval := 'approved';
      ELSIF v_i <= 6 THEN
        v_sinv_status := 'pending'; v_sinv_pay_status := 'pending'; v_sinv_approval := 'pending';
      ELSE
        v_sinv_status := 'disputed'; v_sinv_pay_status := 'pending'; v_sinv_approval := 'rejected';
      END IF;

      INSERT INTO supplier_invoices (
        id, supplier_id, user_id, company_id,
        invoice_number, invoice_date, due_date,
        total_ht, vat_amount, vat_rate, total_ttc, total_amount,
        currency, status, payment_status, approval_status,
        file_url, ai_extracted, ai_confidence,
        supplier_name_extracted
      ) VALUES (
        v_sinv_id,
        v_supplier_ids[((v_i - 1) % 7) + 1],
        p_uid,
        p_cid,
        'SINV-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 3, '0'),
        ('2025-' || LPAD(GREATEST(1, LEAST(12, v_i * 2 - 1))::text, 2, '0') || '-08')::date,
        ('2025-' || LPAD(LEAST(12, v_i * 2 + 1)::text, 2, '0') || '-08')::date,
        v_base, v_tax, v_rate, v_ttc, v_ttc,
        p_currency,
        v_sinv_status,
        v_sinv_pay_status,
        v_sinv_approval,
        p_uid || '/supplier-invoices/SINV-' || v_pfx || '-' || v_cid4 || '-' || v_i || '.pdf',
        true,
        0.95,
        (SELECT company_name FROM suppliers WHERE id = v_supplier_ids[((v_i - 1) % 7) + 1])
      );

      -- 2 line items per supplier invoice
      INSERT INTO supplier_invoice_line_items (id, invoice_id, description, quantity, unit_price, total, vat_rate, sort_order)
      VALUES
        (gen_random_uuid(), v_sinv_id,
         (ARRAY[
           CASE p_country WHEN 'FR' THEN 'Composants electroniques lot A' WHEN 'BE' THEN 'Electronic components batch A' ELSE 'Pieces detachees lot A' END,
           CASE p_country WHEN 'FR' THEN 'Licence SaaS annuelle Premium' WHEN 'BE' THEN 'Premium annual SaaS license' ELSE 'Licence cloud Premium annuelle' END,
           CASE p_country WHEN 'FR' THEN 'Fournitures bureau standard' WHEN 'BE' THEN 'Standard office supplies' ELSE 'Fournitures bureau courantes' END,
           CASE p_country WHEN 'FR' THEN 'Prestation conseil technique' WHEN 'BE' THEN 'Technical consulting service' ELSE 'Conseil technique specialise' END,
           CASE p_country WHEN 'FR' THEN 'Materiel reseau switches' WHEN 'BE' THEN 'Network switches equipment' ELSE 'Equipement reseau switches' END,
           CASE p_country WHEN 'FR' THEN 'Abonnement monitoring infra' WHEN 'BE' THEN 'Infrastructure monitoring sub' ELSE 'Monitoring infrastructure' END,
           CASE p_country WHEN 'FR' THEN 'Migration donnees legacy' WHEN 'BE' THEN 'Legacy data migration' ELSE 'Migration base legacy' END
         ])[v_i],
         (ARRAY[8, 1, 25, 40, 6, 12, 3])[v_i]::numeric,
         ROUND(v_base * 0.65 / GREATEST((ARRAY[8, 1, 25, 40, 6, 12, 3])[v_i], 1), 2),
         ROUND(v_base * 0.65, 2),
         v_rate, 1),
        (gen_random_uuid(), v_sinv_id,
         (ARRAY[
           CASE p_country WHEN 'FR' THEN 'Frais de livraison express' WHEN 'BE' THEN 'Express delivery fees' ELSE 'Transport express' END,
           CASE p_country WHEN 'FR' THEN 'Support technique inclus 12M' WHEN 'BE' THEN 'Included tech support 12M' ELSE 'Support technique 12 mois' END,
           CASE p_country WHEN 'FR' THEN 'Emballage et conditionnement' WHEN 'BE' THEN 'Packaging and handling' ELSE 'Conditionnement marchandise' END,
           CASE p_country WHEN 'FR' THEN 'Rapport audit et recommandations' WHEN 'BE' THEN 'Audit report & recommendations' ELSE 'Rapport audit complet' END,
           CASE p_country WHEN 'FR' THEN 'Installation et configuration' WHEN 'BE' THEN 'Installation & configuration' ELSE 'Installation sur site' END,
           CASE p_country WHEN 'FR' THEN 'Formation operateur 2 jours' WHEN 'BE' THEN 'Operator training 2 days' ELSE 'Formation utilisateurs 2j' END,
           CASE p_country WHEN 'FR' THEN 'Validation et recette finale' WHEN 'BE' THEN 'Final validation & acceptance' ELSE 'Recette et validation' END
         ])[v_i],
         (ARRAY[1, 1, 25, 8, 6, 2, 1])[v_i]::numeric,
         ROUND(v_base * 0.35 / GREATEST((ARRAY[1, 1, 25, 8, 6, 2, 1])[v_i], 1), 2),
         ROUND(v_base * 0.35, 2),
         v_rate, 2);
    END LOOP;
    END;

    -- Re-enable supplier invoice triggers
    EXECUTE 'ALTER TABLE supplier_invoices ENABLE TRIGGER "02_trg_enforce_supplier_invoice_approval_role_guard"';
    EXECUTE 'ALTER TABLE supplier_invoices ENABLE TRIGGER trg_assign_supplier_invoice_user_id';

    -- ================================================================
    -- D. PROJECTS (7)
    -- ================================================================
    v_project_ids := ARRAY[]::UUID[];

    FOR v_i IN 1..7 LOOP
      v_id := gen_random_uuid();
      v_project_ids := v_project_ids || v_id;

      INSERT INTO projects (
        id, user_id, client_id, name, description,
        budget_hours, hourly_rate, status, start_date, end_date, company_id
      ) VALUES (
        v_id, p_uid,
        v_client_ids[((v_i - 1) % 7) + 1],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Refonte site web corporate' WHEN 'BE' THEN 'Website redesign project' ELSE 'Refonte portail institutionnel' END,
          CASE p_country WHEN 'FR' THEN 'Migration ERP vers cloud' WHEN 'BE' THEN 'ERP cloud migration' ELSE 'Migration systeme ERP' END,
          CASE p_country WHEN 'FR' THEN 'Application mobile client' WHEN 'BE' THEN 'Client mobile application' ELSE 'App mobile terrain' END,
          CASE p_country WHEN 'FR' THEN 'Data warehouse analytique' WHEN 'BE' THEN 'BI analytics platform' ELSE 'Entrepot donnees BI' END,
          CASE p_country WHEN 'FR' THEN 'Audit securite SI' WHEN 'BE' THEN 'IT security audit' ELSE 'Audit securite infrastructure' END,
          CASE p_country WHEN 'FR' THEN 'Migration cloud AWS' WHEN 'BE' THEN 'Azure cloud migration' ELSE 'Infrastructure cloud GCP' END,
          CASE p_country WHEN 'FR' THEN 'Automatisation processus RH' WHEN 'BE' THEN 'HR process automation' ELSE 'Digitalisation processus metier' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Refonte complete du site corporate avec nouveau design system et CMS headless' WHEN 'BE' THEN 'Complete website overhaul with new design system and headless CMS' ELSE 'Refonte du portail avec integration CMS moderne' END,
          CASE p_country WHEN 'FR' THEN 'Migration de l''ERP on-premise vers solution SaaS cloud-native' WHEN 'BE' THEN 'Migration from on-premise ERP to cloud-native SaaS solution' ELSE 'Migration ERP legacy vers plateforme cloud multi-tenant' END,
          CASE p_country WHEN 'FR' THEN 'Developpement application mobile iOS/Android pour suivi client' WHEN 'BE' THEN 'iOS/Android mobile app development for client tracking' ELSE 'Application mobile terrain pour agents commerciaux' END,
          CASE p_country WHEN 'FR' THEN 'Construction data warehouse avec pipelines ETL et dashboards BI' WHEN 'BE' THEN 'Data warehouse construction with ETL pipelines and BI dashboards' ELSE 'Mise en place entrepot de donnees et tableaux de bord analytiques' END,
          CASE p_country WHEN 'FR' THEN 'Audit complet de la securite du systeme d''information et plan remediation' WHEN 'BE' THEN 'Complete IT security audit with remediation plan and compliance check' ELSE 'Audit securite exhaustif avec recommandations et plan d''action' END,
          CASE p_country WHEN 'FR' THEN 'Migration infrastructure on-premise vers AWS avec architecture serverless' WHEN 'BE' THEN 'On-premise to Azure migration with containerized microservices' ELSE 'Transition infrastructure vers GCP avec Kubernetes' END,
          CASE p_country WHEN 'FR' THEN 'Automatisation des workflows RH : recrutement, onboarding, evaluation' WHEN 'BE' THEN 'HR workflow automation: recruitment, onboarding, performance review' ELSE 'Digitalisation complete des processus metier et workflows internes' END
        ])[v_i],
        (ARRAY[120, 200, 160, 80, 40, 180, 100])[v_i],
        (SELECT hourly_rate FROM services WHERE id = v_svc_ids[((v_i - 1) % 8) + 1]),
        (ARRAY['active','active','active','completed','completed','active','planning'])[v_i],
        (ARRAY[
          '2025-09-01','2025-07-15','2025-10-01','2025-03-01','2025-04-01','2025-11-01','2026-01-15'
        ])[v_i]::date,
        (ARRAY[
          '2026-03-31','2026-06-30','2026-04-30','2025-12-31','2025-08-31','2026-08-31','2026-07-31'
        ])[v_i]::date,
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- E. TASKS (2 per project = 14)
    -- ================================================================
    v_task_ids := ARRAY[]::UUID[];

    FOR v_i IN 1..7 LOOP
      -- Task 1: Analysis/planning (completed, high priority)
      v_id := gen_random_uuid();
      v_task_ids := v_task_ids || v_id;

      INSERT INTO tasks (
        id, project_id, title, name, description, status, priority,
        assigned_to, due_date, start_date, end_date, created_at, updated_at
      ) VALUES (
        v_id,
        v_project_ids[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Analyse des besoins et cadrage' WHEN 'BE' THEN 'Requirements analysis & scoping' ELSE 'Analyse des besoins fonctionnels' END,
          CASE p_country WHEN 'FR' THEN 'Audit systeme existant' WHEN 'BE' THEN 'Existing system audit' ELSE 'Etude systeme en place' END,
          CASE p_country WHEN 'FR' THEN 'Specification fonctionnelle mobile' WHEN 'BE' THEN 'Mobile functional specification' ELSE 'Cahier des charges mobile' END,
          CASE p_country WHEN 'FR' THEN 'Modelisation du schema donnees' WHEN 'BE' THEN 'Data schema modeling' ELSE 'Conception modele de donnees' END,
          CASE p_country WHEN 'FR' THEN 'Cartographie des risques' WHEN 'BE' THEN 'Risk mapping assessment' ELSE 'Evaluation des vulnerabilites' END,
          CASE p_country WHEN 'FR' THEN 'Inventaire infrastructure actuelle' WHEN 'BE' THEN 'Current infrastructure inventory' ELSE 'Recensement infrastructure' END,
          CASE p_country WHEN 'FR' THEN 'Cartographie processus actuels' WHEN 'BE' THEN 'Current process mapping' ELSE 'Analyse des flux existants' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Analyse des besoins et cadrage' WHEN 'BE' THEN 'Requirements analysis & scoping' ELSE 'Analyse des besoins fonctionnels' END,
          CASE p_country WHEN 'FR' THEN 'Audit systeme existant' WHEN 'BE' THEN 'Existing system audit' ELSE 'Etude systeme en place' END,
          CASE p_country WHEN 'FR' THEN 'Specification fonctionnelle mobile' WHEN 'BE' THEN 'Mobile functional specification' ELSE 'Cahier des charges mobile' END,
          CASE p_country WHEN 'FR' THEN 'Modelisation du schema donnees' WHEN 'BE' THEN 'Data schema modeling' ELSE 'Conception modele de donnees' END,
          CASE p_country WHEN 'FR' THEN 'Cartographie des risques' WHEN 'BE' THEN 'Risk mapping assessment' ELSE 'Evaluation des vulnerabilites' END,
          CASE p_country WHEN 'FR' THEN 'Inventaire infrastructure actuelle' WHEN 'BE' THEN 'Current infrastructure inventory' ELSE 'Recensement infrastructure' END,
          CASE p_country WHEN 'FR' THEN 'Cartographie processus actuels' WHEN 'BE' THEN 'Current process mapping' ELSE 'Analyse des flux existants' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Recueil exhaustif des besoins metier, ateliers utilisateurs et livrable de cadrage' WHEN 'BE' THEN 'Full business requirements gathering, user workshops and scoping deliverable' ELSE 'Collecte des besoins aupres des equipes metier et livrable de cadrage' END,
          CASE p_country WHEN 'FR' THEN 'Revue technique de l''ERP existant, identification des gaps et plan de migration' WHEN 'BE' THEN 'Technical review of existing ERP, gap analysis and migration plan' ELSE 'Analyse technique du systeme actuel et identification des ecarts' END,
          CASE p_country WHEN 'FR' THEN 'Redaction des specs fonctionnelles pour l''app mobile (parcours, ecrans, API)' WHEN 'BE' THEN 'Functional specs for mobile app (user flows, screens, API contracts)' ELSE 'Specification des parcours utilisateur et des interfaces API' END,
          CASE p_country WHEN 'FR' THEN 'Conception du modele dimensionnel et des flux ETL pour le data warehouse' WHEN 'BE' THEN 'Dimensional model design and ETL flow specification for DWH' ELSE 'Design du modele star-schema et des pipelines de chargement' END,
          CASE p_country WHEN 'FR' THEN 'Identification des vulnerabilites, tests de penetration et rapport de risques' WHEN 'BE' THEN 'Vulnerability assessment, penetration testing and risk report' ELSE 'Scan de vulnerabilites, tests d''intrusion et rapport detaille' END,
          CASE p_country WHEN 'FR' THEN 'Inventaire complet des serveurs, services et dependances a migrer' WHEN 'BE' THEN 'Full server/service inventory and dependency mapping for migration' ELSE 'Cartographie des serveurs et services avec plan de migration' END,
          CASE p_country WHEN 'FR' THEN 'Documentation des processus RH actuels et identification des points d''automatisation' WHEN 'BE' THEN 'Current HR process documentation and automation opportunity identification' ELSE 'Cartographie des workflows manuels et opportunites d''automatisation' END
        ])[v_i],
        'completed', 'high',
        p_uid::text,
        (ARRAY[
          '2025-10-15','2025-08-30','2025-11-15','2025-04-15','2025-05-15','2025-12-15','2026-02-28'
        ])[v_i]::date,
        (ARRAY[
          '2025-09-01','2025-07-15','2025-10-01','2025-03-01','2025-04-01','2025-11-01','2026-01-15'
        ])[v_i]::date,
        (ARRAY[
          '2025-10-15','2025-08-30','2025-11-15','2025-04-15','2025-05-15','2025-12-15','2026-02-28'
        ])[v_i]::date,
        now() - interval '90 days',
        now() - interval '30 days'
      );

      -- Task 2: Implementation (in_progress, medium priority)
      v_id := gen_random_uuid();
      v_task_ids := v_task_ids || v_id;

      INSERT INTO tasks (
        id, project_id, title, name, description, status, priority,
        assigned_to, due_date, start_date, end_date, created_at, updated_at
      ) VALUES (
        v_id,
        v_project_ids[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Developpement frontend React' WHEN 'BE' THEN 'React frontend development' ELSE 'Implementation interface React' END,
          CASE p_country WHEN 'FR' THEN 'Migration donnees et tests' WHEN 'BE' THEN 'Data migration & testing' ELSE 'Migration et validation donnees' END,
          CASE p_country WHEN 'FR' THEN 'Developpement ecrans principaux' WHEN 'BE' THEN 'Main screens development' ELSE 'Codage des vues principales' END,
          CASE p_country WHEN 'FR' THEN 'Implementation pipelines ETL' WHEN 'BE' THEN 'ETL pipeline implementation' ELSE 'Developpement flux ETL' END,
          CASE p_country WHEN 'FR' THEN 'Remediation vulnerabilites critiques' WHEN 'BE' THEN 'Critical vulnerability remediation' ELSE 'Correction des failles critiques' END,
          CASE p_country WHEN 'FR' THEN 'Deploiement services cloud' WHEN 'BE' THEN 'Cloud services deployment' ELSE 'Deploiement infrastructure cloud' END,
          CASE p_country WHEN 'FR' THEN 'Configuration workflows automatises' WHEN 'BE' THEN 'Automated workflow configuration' ELSE 'Parametrage des automatisations' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Developpement frontend React' WHEN 'BE' THEN 'React frontend development' ELSE 'Implementation interface React' END,
          CASE p_country WHEN 'FR' THEN 'Migration donnees et tests' WHEN 'BE' THEN 'Data migration & testing' ELSE 'Migration et validation donnees' END,
          CASE p_country WHEN 'FR' THEN 'Developpement ecrans principaux' WHEN 'BE' THEN 'Main screens development' ELSE 'Codage des vues principales' END,
          CASE p_country WHEN 'FR' THEN 'Implementation pipelines ETL' WHEN 'BE' THEN 'ETL pipeline implementation' ELSE 'Developpement flux ETL' END,
          CASE p_country WHEN 'FR' THEN 'Remediation vulnerabilites critiques' WHEN 'BE' THEN 'Critical vulnerability remediation' ELSE 'Correction des failles critiques' END,
          CASE p_country WHEN 'FR' THEN 'Deploiement services cloud' WHEN 'BE' THEN 'Cloud services deployment' ELSE 'Deploiement infrastructure cloud' END,
          CASE p_country WHEN 'FR' THEN 'Configuration workflows automatises' WHEN 'BE' THEN 'Automated workflow configuration' ELSE 'Parametrage des automatisations' END
        ])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Developpement des composants React, integration API et tests unitaires' WHEN 'BE' THEN 'React component development, API integration and unit testing' ELSE 'Codage des composants React avec integration API et tests' END,
          CASE p_country WHEN 'FR' THEN 'Scripts de migration, transformation des donnees et campagne de tests' WHEN 'BE' THEN 'Migration scripts, data transformation and test campaign' ELSE 'Ecriture des scripts ETL, nettoyage donnees et validation' END,
          CASE p_country WHEN 'FR' THEN 'Implementation des ecrans de l''app avec navigation et stockage offline' WHEN 'BE' THEN 'App screen implementation with navigation and offline storage' ELSE 'Developpement des vues avec gestion du mode hors-ligne' END,
          CASE p_country WHEN 'FR' THEN 'Developpement des jobs Airflow, orchestration et monitoring' WHEN 'BE' THEN 'Airflow job development, orchestration and monitoring setup' ELSE 'Configuration Airflow, jobs ETL et alertes de monitoring' END,
          CASE p_country WHEN 'FR' THEN 'Application des correctifs, durcissement des configs et re-test' WHEN 'BE' THEN 'Patch application, configuration hardening and re-testing' ELSE 'Application des patchs de securite et durcissement' END,
          CASE p_country WHEN 'FR' THEN 'Provisioning Terraform, deploiement containers et configuration reseau' WHEN 'BE' THEN 'Terraform provisioning, container deployment and network config' ELSE 'Infrastructure as Code, deploiement Docker et configuration' END,
          CASE p_country WHEN 'FR' THEN 'Mise en place des workflows dans l''outil RPA et tests end-to-end' WHEN 'BE' THEN 'RPA workflow setup and end-to-end testing' ELSE 'Configuration de l''outil RPA et tests de bout en bout' END
        ])[v_i],
        'in_progress', 'medium',
        p_uid::text,
        (ARRAY[
          '2026-03-15','2026-05-30','2026-03-31','2025-11-30','2025-07-31','2026-07-31','2026-06-30'
        ])[v_i]::date,
        (ARRAY[
          '2025-10-16','2025-09-01','2025-11-16','2025-04-16','2025-05-16','2025-12-16','2026-03-01'
        ])[v_i]::date,
        (ARRAY[
          '2026-03-15','2026-05-30','2026-03-31','2025-11-30','2025-07-31','2026-07-31','2026-06-30'
        ])[v_i]::date,
        now() - interval '60 days',
        now() - interval '5 days'
      );
    END LOOP;

    -- ================================================================
    -- F. SUBTASKS (2 per task = 28)
    -- ================================================================
    FOR v_i IN 1..14 LOOP
      -- Subtask 1: completed
      INSERT INTO subtasks (id, task_id, title, status)
      VALUES (
        gen_random_uuid(),
        v_task_ids[v_i],
        CASE
          WHEN (v_i % 2) = 1 THEN
            (ARRAY[
              CASE p_country WHEN 'FR' THEN 'Revue documentaire initiale' WHEN 'BE' THEN 'Initial document review' ELSE 'Analyse documentaire' END,
              CASE p_country WHEN 'FR' THEN 'Entretiens parties prenantes' WHEN 'BE' THEN 'Stakeholder interviews' ELSE 'Interviews des acteurs cles' END,
              CASE p_country WHEN 'FR' THEN 'Benchmark solutions marche' WHEN 'BE' THEN 'Market solution benchmark' ELSE 'Etude comparative solutions' END,
              CASE p_country WHEN 'FR' THEN 'Definition des KPIs cibles' WHEN 'BE' THEN 'Target KPI definition' ELSE 'Selection des indicateurs' END,
              CASE p_country WHEN 'FR' THEN 'Scan de vulnerabilites reseau' WHEN 'BE' THEN 'Network vulnerability scan' ELSE 'Audit reseau automatise' END,
              CASE p_country WHEN 'FR' THEN 'Inventaire serveurs physiques' WHEN 'BE' THEN 'Physical server inventory' ELSE 'Recensement materiel serveur' END,
              CASE p_country WHEN 'FR' THEN 'Ateliers decouverte processus' WHEN 'BE' THEN 'Process discovery workshops' ELSE 'Sessions de decouverte processus' END
            ])[((v_i + 1) / 2)]
          ELSE
            (ARRAY[
              CASE p_country WHEN 'FR' THEN 'Setup environnement dev' WHEN 'BE' THEN 'Dev environment setup' ELSE 'Configuration env developpement' END,
              CASE p_country WHEN 'FR' THEN 'Extraction donnees source' WHEN 'BE' THEN 'Source data extraction' ELSE 'Export donnees systeme source' END,
              CASE p_country WHEN 'FR' THEN 'Maquettes wireframes valides' WHEN 'BE' THEN 'Validated wireframe mockups' ELSE 'Wireframes approuves' END,
              CASE p_country WHEN 'FR' THEN 'Schema dimensionnel valide' WHEN 'BE' THEN 'Validated dimensional schema' ELSE 'Modele dimensionnel approuve' END,
              CASE p_country WHEN 'FR' THEN 'Rapport vulnerabilites redige' WHEN 'BE' THEN 'Vulnerability report drafted' ELSE 'Rapport de vulnerabilites redige' END,
              CASE p_country WHEN 'FR' THEN 'Scripts Terraform v1 ecrits' WHEN 'BE' THEN 'Terraform scripts v1 written' ELSE 'Scripts IaC version initiale' END,
              CASE p_country WHEN 'FR' THEN 'Matrice automatisation priorisee' WHEN 'BE' THEN 'Prioritized automation matrix' ELSE 'Matrice de priorite etablie' END
            ])[((v_i) / 2)]
        END,
        'completed'
      );

      -- Subtask 2: pending
      INSERT INTO subtasks (id, task_id, title, status)
      VALUES (
        gen_random_uuid(),
        v_task_ids[v_i],
        CASE
          WHEN (v_i % 2) = 1 THEN
            (ARRAY[
              CASE p_country WHEN 'FR' THEN 'Validation livrable de cadrage' WHEN 'BE' THEN 'Scoping deliverable validation' ELSE 'Validation du document de cadrage' END,
              CASE p_country WHEN 'FR' THEN 'Plan de migration detaille' WHEN 'BE' THEN 'Detailed migration plan' ELSE 'Plan de migration complet' END,
              CASE p_country WHEN 'FR' THEN 'Prototypes interactifs Figma' WHEN 'BE' THEN 'Interactive Figma prototypes' ELSE 'Prototypes cliquables valides' END,
              CASE p_country WHEN 'FR' THEN 'Documentation dictionnaire donnees' WHEN 'BE' THEN 'Data dictionary documentation' ELSE 'Dictionnaire de donnees complet' END,
              CASE p_country WHEN 'FR' THEN 'Plan de remediation priorise' WHEN 'BE' THEN 'Prioritized remediation plan' ELSE 'Plan de correction priorise' END,
              CASE p_country WHEN 'FR' THEN 'Architecture cible documentee' WHEN 'BE' THEN 'Target architecture documented' ELSE 'Documentation architecture cible' END,
              CASE p_country WHEN 'FR' THEN 'Specification workflows cibles' WHEN 'BE' THEN 'Target workflow specification' ELSE 'Specification des workflows futurs' END
            ])[((v_i + 1) / 2)]
          ELSE
            (ARRAY[
              CASE p_country WHEN 'FR' THEN 'Tests d''integration complets' WHEN 'BE' THEN 'Complete integration tests' ELSE 'Tests integration bout en bout' END,
              CASE p_country WHEN 'FR' THEN 'Recette utilisateur migration' WHEN 'BE' THEN 'User acceptance migration test' ELSE 'Validation utilisateur migration' END,
              CASE p_country WHEN 'FR' THEN 'Tests performance mobile' WHEN 'BE' THEN 'Mobile performance tests' ELSE 'Tests de charge application' END,
              CASE p_country WHEN 'FR' THEN 'Dashboards BI valides metier' WHEN 'BE' THEN 'Business-validated BI dashboards' ELSE 'Tableaux de bord valides' END,
              CASE p_country WHEN 'FR' THEN 'Re-test post-correctifs' WHEN 'BE' THEN 'Post-fix re-testing' ELSE 'Verification post-correction' END,
              CASE p_country WHEN 'FR' THEN 'Tests de charge cloud prod' WHEN 'BE' THEN 'Cloud production load tests' ELSE 'Tests performance prod cloud' END,
              CASE p_country WHEN 'FR' THEN 'Pilote automatisation en reel' WHEN 'BE' THEN 'Live automation pilot' ELSE 'Pilote en conditions reelles' END
            ])[((v_i) / 2)]
        END,
        'pending'
      );
    END LOOP;

    -- ================================================================
    -- G. TIMESHEETS (1 per task = 14)
    -- ================================================================
    FOR v_i IN 1..14 LOOP
      INSERT INTO timesheets (
        id, user_id, task_id, project_id, client_id, date,
        start_time, end_time, duration_minutes, description,
        status, company_id, billable, hourly_rate
      ) VALUES (
        gen_random_uuid(),
        p_uid,
        v_task_ids[v_i],
        v_project_ids[((v_i - 1) / 2) + 1],
        v_client_ids[((((v_i - 1) / 2)) % 7) + 1],
        (now() - ((30 - v_i * 2) || ' days')::interval)::date,
        (ARRAY['08:30','09:00','08:00','09:30','08:15','09:00','08:45',
               '08:30','09:00','08:00','09:30','08:15','09:00','08:45'])[v_i]::time,
        (ARRAY['12:30','13:00','12:00','13:30','12:15','13:00','12:45',
               '16:30','17:00','16:00','17:30','16:15','17:00','16:45'])[v_i]::time,
        (ARRAY[240, 240, 240, 240, 240, 240, 240,
               480, 480, 480, 480, 480, 480, 480])[v_i],
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Reunion de cadrage projet' WHEN 'BE' THEN 'Project scoping meeting' ELSE 'Session de cadrage' END,
          CASE p_country WHEN 'FR' THEN 'Analyse technique existant' WHEN 'BE' THEN 'Existing tech analysis' ELSE 'Analyse systeme actuel' END,
          CASE p_country WHEN 'FR' THEN 'Atelier specification mobile' WHEN 'BE' THEN 'Mobile spec workshop' ELSE 'Atelier specification app' END,
          CASE p_country WHEN 'FR' THEN 'Design modele de donnees' WHEN 'BE' THEN 'Data model design session' ELSE 'Conception schema donnees' END,
          CASE p_country WHEN 'FR' THEN 'Tests de penetration' WHEN 'BE' THEN 'Penetration testing session' ELSE 'Session tests intrusion' END,
          CASE p_country WHEN 'FR' THEN 'Inventaire et sizing cloud' WHEN 'BE' THEN 'Cloud sizing & inventory' ELSE 'Dimensionnement cloud' END,
          CASE p_country WHEN 'FR' THEN 'Atelier processus metier' WHEN 'BE' THEN 'Business process workshop' ELSE 'Workshop processus' END,
          CASE p_country WHEN 'FR' THEN 'Developpement composants UI' WHEN 'BE' THEN 'UI component development' ELSE 'Codage interface utilisateur' END,
          CASE p_country WHEN 'FR' THEN 'Scripts migration donnees' WHEN 'BE' THEN 'Data migration scripting' ELSE 'Scripts migration base' END,
          CASE p_country WHEN 'FR' THEN 'Implementation ecrans app' WHEN 'BE' THEN 'App screen implementation' ELSE 'Codage vues application' END,
          CASE p_country WHEN 'FR' THEN 'Developpement jobs ETL' WHEN 'BE' THEN 'ETL job development' ELSE 'Implementation flux ETL' END,
          CASE p_country WHEN 'FR' THEN 'Correction vulnerabilites' WHEN 'BE' THEN 'Vulnerability patching' ELSE 'Application correctifs' END,
          CASE p_country WHEN 'FR' THEN 'Deploiement containers Docker' WHEN 'BE' THEN 'Docker container deployment' ELSE 'Deploiement Docker prod' END,
          CASE p_country WHEN 'FR' THEN 'Configuration robot RPA' WHEN 'BE' THEN 'RPA robot configuration' ELSE 'Parametrage automates RPA' END
        ])[v_i],
        'approved',
        p_cid,
        true,
        (SELECT hourly_rate FROM services WHERE id = v_svc_ids[((v_i - 1) % 8) + 1])
      );
    END LOOP;

    -- ================================================================
    -- H. BANK CONNECTIONS (1 per company)
    -- ================================================================
    v_bank_conn_id := gen_random_uuid();

    INSERT INTO bank_connections (
      id, user_id, institution_id, institution_name, status,
      account_iban, account_currency, account_balance,
      company_id, last_sync_at
    ) VALUES (
      v_bank_conn_id, p_uid, 'DEMO_BANK',
      CASE p_country
        WHEN 'FR' THEN 'Banque de France Demo'
        WHEN 'BE' THEN 'KBC Bank Demo'
        ELSE 'Afriland First Bank Demo'
      END,
      'active',
      CASE p_country
        WHEN 'FR' THEN 'FR76' || v_cid4 || '0000000000000000' || LPAD(substring(p_cid::text, 5, 2), 2, '0')
        WHEN 'BE' THEN 'BE68' || v_cid4 || '00000000' || LPAD(substring(p_cid::text, 5, 2), 2, '0')
        ELSE 'CM21' || v_cid4 || '000000000000' || LPAD(substring(p_cid::text, 5, 2), 2, '0')
      END,
      p_currency,
      ROUND((45000 + hashtext(p_cid::text) % 30000) * v_mul, 2),
      p_cid,
      now()
    );

    -- ================================================================
    -- I. BANK TRANSACTIONS (7 per company)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      INSERT INTO bank_transactions (
        id, user_id, bank_connection_id, external_id, date, amount, currency,
        description, creditor_name, debtor_name,
        reconciliation_status, company_id
      ) VALUES (
        gen_random_uuid(), p_uid, v_bank_conn_id,
        'TXN-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 4, '0'),
        (now() - ((28 - v_i * 4) || ' days')::interval)::date,
        -- Amounts: 3 incoming, 2 outgoing supplier, 1 outgoing expense, 1 incoming refund
        (ARRAY[
          ROUND((5200 + v_i * 300) * v_mul, 2),   -- 1: client payment incoming
          ROUND((8100 + v_i * 500) * v_mul, 2),   -- 2: client payment incoming
          ROUND((-3400 - v_i * 200) * v_mul, 2),  -- 3: supplier payment outgoing
          ROUND((-6700 - v_i * 400) * v_mul, 2),  -- 4: supplier payment outgoing
          ROUND((12500 + v_i * 800) * v_mul, 2),  -- 5: client payment incoming
          ROUND((-1800 - v_i * 100) * v_mul, 2),  -- 6: expense outgoing
          ROUND((950 + v_i * 50) * v_mul, 2)      -- 7: refund incoming
        ])[v_i],
        p_currency,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Virement client - Facture INV-001' WHEN 'BE' THEN 'Client transfer - Invoice INV-001' ELSE 'Paiement client facture INV-001' END,
          CASE p_country WHEN 'FR' THEN 'Virement client - Facture INV-002' WHEN 'BE' THEN 'Client transfer - Invoice INV-002' ELSE 'Paiement client facture INV-002' END,
          CASE p_country WHEN 'FR' THEN 'Paiement fournisseur - Commande SO-001' WHEN 'BE' THEN 'Supplier payment - Order SO-001' ELSE 'Reglement fournisseur commande SO-001' END,
          CASE p_country WHEN 'FR' THEN 'Paiement fournisseur - Facture SINV-001' WHEN 'BE' THEN 'Supplier payment - Invoice SINV-001' ELSE 'Reglement fournisseur facture SINV-001' END,
          CASE p_country WHEN 'FR' THEN 'Virement client - Facture INV-005' WHEN 'BE' THEN 'Client transfer - Invoice INV-005' ELSE 'Paiement client facture INV-005' END,
          CASE p_country WHEN 'FR' THEN 'Prelevement abonnement cloud mensuel' WHEN 'BE' THEN 'Monthly cloud subscription debit' ELSE 'Debit abonnement hebergement cloud' END,
          CASE p_country WHEN 'FR' THEN 'Remboursement avoir CN-001' WHEN 'BE' THEN 'Credit note refund CN-001' ELSE 'Remboursement avoir client CN-001' END
        ])[v_i],
        -- creditor_name (who we pay for outgoing, NULL for incoming)
        CASE
          WHEN v_i IN (3, 4, 6) THEN
            (SELECT company_name FROM suppliers WHERE id = v_supplier_ids[((v_i - 1) % 7) + 1])
          ELSE NULL
        END,
        -- debtor_name (who pays us for incoming, NULL for outgoing)
        CASE
          WHEN v_i IN (1, 2, 5, 7) THEN
            (SELECT company_name FROM clients WHERE id = v_client_ids[((v_i - 1) % 7) + 1])
          ELSE NULL
        END,
        (ARRAY['matched','unreconciled','matched','unreconciled','matched','unreconciled','ignored'])[v_i],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- J. CREDIT NOTES (7) + CREDIT NOTE ITEMS (2 per = 14)
    -- ================================================================
    DECLARE
      v_cn_id UUID;
      v_cn_base NUMERIC;
      v_cn_tax NUMERIC;
      v_cn_ttc NUMERIC;
      v_cn_status TEXT;
      v_orig_ttc NUMERIC;
    BEGIN
    FOR v_i IN 1..7 LOOP
      v_cn_id := gen_random_uuid();

      -- Get original invoice total for percentage calculation
      SELECT total_ttc INTO v_orig_ttc FROM invoices WHERE id = v_invoice_ids[((v_i - 1) % 7) + 1];
      v_orig_ttc := COALESCE(v_orig_ttc, 10000 * v_mul);

      -- Credit note = 10-30% of original invoice
      v_cn_base := ROUND(v_orig_ttc * (ARRAY[0.10, 0.15, 0.20, 0.12, 0.25, 0.18, 0.30])[v_i] / (1 + v_rate / 100), 2);
      v_cn_tax  := ROUND(v_cn_base * v_rate / 100, 2);
      v_cn_ttc  := v_cn_base + v_cn_tax;

      IF v_i <= 2 THEN
        v_cn_status := 'applied';
      ELSIF v_i <= 4 THEN
        v_cn_status := 'issued';
      ELSIF v_i <= 6 THEN
        v_cn_status := 'draft';
      ELSE
        v_cn_status := 'cancelled';
      END IF;

      INSERT INTO credit_notes (
        id, user_id, credit_note_number, invoice_id, client_id, date,
        reason, total_ht, tax_rate, tax_amount, total_ttc,
        status, notes, company_id
      ) VALUES (
        v_cn_id, p_uid,
        'CN-' || v_pfx || '-' || v_cid4 || '-' || LPAD(v_i::text, 3, '0'),
        v_invoice_ids[((v_i - 1) % 7) + 1],
        v_client_ids[((v_i - 1) % 7) + 1],
        (now() - ((60 - v_i * 8) || ' days')::interval)::date,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Erreur de facturation sur la quantite' WHEN 'BE' THEN 'Billing quantity error correction' ELSE 'Correction erreur quantite facturee' END,
          CASE p_country WHEN 'FR' THEN 'Remise commerciale exceptionnelle' WHEN 'BE' THEN 'Exceptional commercial discount' ELSE 'Remise fidelite exceptionnelle' END,
          CASE p_country WHEN 'FR' THEN 'Retour marchandise defectueuse' WHEN 'BE' THEN 'Defective goods return' ELSE 'Retour produit non conforme' END,
          CASE p_country WHEN 'FR' THEN 'Ajustement prix negocie' WHEN 'BE' THEN 'Negotiated price adjustment' ELSE 'Ajustement tarifaire convenu' END,
          CASE p_country WHEN 'FR' THEN 'Prestation non realisee partiellement' WHEN 'BE' THEN 'Partially undelivered service' ELSE 'Service partiellement non effectue' END,
          CASE p_country WHEN 'FR' THEN 'Avoir pour geste commercial' WHEN 'BE' THEN 'Goodwill credit note' ELSE 'Avoir commercial de bonne foi' END,
          CASE p_country WHEN 'FR' THEN 'Annulation commande client' WHEN 'BE' THEN 'Client order cancellation' ELSE 'Annulation partielle commande' END
        ])[v_i],
        v_cn_base, v_rate, v_cn_tax, v_cn_ttc,
        v_cn_status,
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Avoir applique sur prochaine facture' WHEN 'BE' THEN 'Credit applied to next invoice' ELSE 'Avoir impute sur facture suivante' END,
          CASE p_country WHEN 'FR' THEN 'Remise 15% accordee suite negociation' WHEN 'BE' THEN '15% discount granted after negotiation' ELSE 'Remise 15% suite accord commercial' END,
          CASE p_country WHEN 'FR' THEN 'Retour lot reference #2847' WHEN 'BE' THEN 'Return batch ref #2847' ELSE 'Retour lot reference #2847' END,
          CASE p_country WHEN 'FR' THEN 'Nouveau tarif applique retroactivement' WHEN 'BE' THEN 'New rate applied retroactively' ELSE 'Tarif revise applique' END,
          CASE p_country WHEN 'FR' THEN 'Avoir en cours de validation' WHEN 'BE' THEN 'Credit note pending validation' ELSE 'Avoir en attente de validation' END,
          CASE p_country WHEN 'FR' THEN 'Geste commercial suite reclamation' WHEN 'BE' THEN 'Goodwill gesture after complaint' ELSE 'Geste commercial apres reclamation' END,
          CASE p_country WHEN 'FR' THEN 'Avoir annule - accord resilie' WHEN 'BE' THEN 'Cancelled - agreement terminated' ELSE 'Avoir annule - contrat resilie' END
        ])[v_i],
        p_cid
      );

      -- 2 items per credit note
      INSERT INTO credit_note_items (id, credit_note_id, description, quantity, unit_price, amount)
      VALUES
        (gen_random_uuid(), v_cn_id,
         (ARRAY[
           CASE p_country WHEN 'FR' THEN 'Correction ligne service' WHEN 'BE' THEN 'Service line correction' ELSE 'Ajustement prestation' END,
           CASE p_country WHEN 'FR' THEN 'Remise prestation conseil' WHEN 'BE' THEN 'Consulting discount' ELSE 'Reduction service conseil' END,
           CASE p_country WHEN 'FR' THEN 'Retour licence logicielle' WHEN 'BE' THEN 'Software license return' ELSE 'Retour licence' END,
           CASE p_country WHEN 'FR' THEN 'Ajustement tarif horaire' WHEN 'BE' THEN 'Hourly rate adjustment' ELSE 'Correction taux horaire' END,
           CASE p_country WHEN 'FR' THEN 'Heures non prestees' WHEN 'BE' THEN 'Undelivered hours' ELSE 'Heures non effectuees' END,
           CASE p_country WHEN 'FR' THEN 'Geste sur prestation support' WHEN 'BE' THEN 'Support service gesture' ELSE 'Reduction support technique' END,
           CASE p_country WHEN 'FR' THEN 'Annulation prestation prevue' WHEN 'BE' THEN 'Cancelled planned service' ELSE 'Service prevu annule' END
         ])[v_i],
         (ARRAY[2, 1, 1, 3, 4, 1, 2])[v_i]::numeric,
         ROUND(v_cn_base * 0.6 / GREATEST((ARRAY[2, 1, 1, 3, 4, 1, 2])[v_i], 1), 2),
         ROUND(v_cn_base * 0.6, 2)),
        (gen_random_uuid(), v_cn_id,
         (ARRAY[
           CASE p_country WHEN 'FR' THEN 'Correction ligne produit' WHEN 'BE' THEN 'Product line correction' ELSE 'Ajustement produit' END,
           CASE p_country WHEN 'FR' THEN 'Remise produit logiciel' WHEN 'BE' THEN 'Software product discount' ELSE 'Reduction produit' END,
           CASE p_country WHEN 'FR' THEN 'Retour materiel defectueux' WHEN 'BE' THEN 'Defective equipment return' ELSE 'Retour equipement' END,
           CASE p_country WHEN 'FR' THEN 'Ecart prix catalogue' WHEN 'BE' THEN 'Catalog price discrepancy' ELSE 'Difference prix convenu' END,
           CASE p_country WHEN 'FR' THEN 'Produit non livre' WHEN 'BE' THEN 'Undelivered product' ELSE 'Produit non receptionne' END,
           CASE p_country WHEN 'FR' THEN 'Reduction formation' WHEN 'BE' THEN 'Training discount' ELSE 'Reduction formation offerte' END,
           CASE p_country WHEN 'FR' THEN 'Annulation commande produit' WHEN 'BE' THEN 'Product order cancellation' ELSE 'Commande produit annulee' END
         ])[v_i],
         (ARRAY[1, 1, 1, 2, 1, 1, 1])[v_i]::numeric,
         ROUND(v_cn_base * 0.4 / GREATEST((ARRAY[1, 1, 1, 2, 1, 1, 1])[v_i], 1), 2),
         ROUND(v_cn_base * 0.4, 2));
    END LOOP;
    END;

    -- ================================================================
    -- K. RECEIVABLES (7)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      v_base := (ARRAY[5800, 12400, 3200, 8900, 7500, 4600, 15200])[v_i]::numeric * v_mul;

      INSERT INTO receivables (
        id, user_id, debtor_name, debtor_email, description,
        amount, amount_paid, currency, date_lent, due_date,
        status, category, notes, company_id
      ) VALUES (
        gen_random_uuid(), p_uid,
        (SELECT company_name FROM clients WHERE id = v_client_ids[((v_i - 1) % 7) + 1]),
        (SELECT email FROM clients WHERE id = v_client_ids[((v_i - 1) % 7) + 1]),
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Solde facture projet web' WHEN 'BE' THEN 'Website project balance' ELSE 'Solde projet web' END,
          CASE p_country WHEN 'FR' THEN 'Acompte migration ERP' WHEN 'BE' THEN 'ERP migration deposit' ELSE 'Avance migration systeme' END,
          CASE p_country WHEN 'FR' THEN 'Prestation conseil Q3' WHEN 'BE' THEN 'Q3 consulting service' ELSE 'Service conseil trimestre 3' END,
          CASE p_country WHEN 'FR' THEN 'Licence annuelle impayee' WHEN 'BE' THEN 'Unpaid annual license' ELSE 'Licence annuelle en attente' END,
          CASE p_country WHEN 'FR' THEN 'Formation equipe technique' WHEN 'BE' THEN 'Technical team training' ELSE 'Formation equipe IT' END,
          CASE p_country WHEN 'FR' THEN 'Maintenance semestrielle' WHEN 'BE' THEN 'Semi-annual maintenance' ELSE 'Maintenance semestre 2' END,
          CASE p_country WHEN 'FR' THEN 'Developpement module custom' WHEN 'BE' THEN 'Custom module development' ELSE 'Dev module specifique client' END
        ])[v_i],
        v_base,
        CASE
          WHEN v_i <= 2 THEN v_base                   -- paid
          WHEN v_i <= 4 THEN ROUND(v_base * 0.5, 2)   -- partial
          ELSE 0                                        -- pending / overdue
        END,
        p_currency,
        (now() - ((90 + v_i * 15) || ' days')::interval)::date,
        CASE
          WHEN v_i = 7 THEN (now() - interval '15 days')::date  -- overdue
          ELSE (now() + ((30 + v_i * 10) || ' days')::interval)::date
        END,
        (ARRAY['paid','paid','partial','partial','pending','pending','overdue'])[v_i],
        'business',
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Paiement complet recu par virement' WHEN 'BE' THEN 'Full payment received by transfer' ELSE 'Reglement complet recu' END,
          CASE p_country WHEN 'FR' THEN 'Reglement integral effectue' WHEN 'BE' THEN 'Full settlement completed' ELSE 'Paiement total confirme' END,
          CASE p_country WHEN 'FR' THEN 'Premier acompte de 50% recu' WHEN 'BE' THEN '50% first installment received' ELSE 'Acompte 50% encaisse' END,
          CASE p_country WHEN 'FR' THEN 'Echeancier en cours, 50% verse' WHEN 'BE' THEN 'Payment plan ongoing, 50% paid' ELSE 'Plan paiement en cours' END,
          CASE p_country WHEN 'FR' THEN 'Relance envoyee le 15 du mois' WHEN 'BE' THEN 'Reminder sent on the 15th' ELSE 'Relance effectuee mi-mois' END,
          CASE p_country WHEN 'FR' THEN 'En attente de bon de commande client' WHEN 'BE' THEN 'Awaiting client purchase order' ELSE 'En attente BC du client' END,
          CASE p_country WHEN 'FR' THEN 'URGENT: echeance depassee de 15 jours' WHEN 'BE' THEN 'URGENT: 15 days past due' ELSE 'URGENT: retard 15 jours' END
        ])[v_i],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- L. PAYABLES (7)
    -- ================================================================
    FOR v_i IN 1..7 LOOP
      v_base := (ARRAY[4100, 9700, 2600, 7300, 5500, 3800, 11800])[v_i]::numeric * v_mul;

      INSERT INTO payables (
        id, user_id, creditor_name, creditor_email, description,
        amount, amount_paid, currency, date_borrowed, due_date,
        status, category, notes, company_id
      ) VALUES (
        gen_random_uuid(), p_uid,
        (SELECT company_name FROM suppliers WHERE id = v_supplier_ids[((v_i - 1) % 7) + 1]),
        (SELECT email FROM suppliers WHERE id = v_supplier_ids[((v_i - 1) % 7) + 1]),
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Facture fournisseur composants' WHEN 'BE' THEN 'Supplier components invoice' ELSE 'Facture pieces fournisseur' END,
          CASE p_country WHEN 'FR' THEN 'Abonnement infrastructure cloud' WHEN 'BE' THEN 'Cloud infrastructure subscription' ELSE 'Abonnement hebergement cloud' END,
          CASE p_country WHEN 'FR' THEN 'Prestation maintenance trimestrielle' WHEN 'BE' THEN 'Quarterly maintenance service' ELSE 'Service maintenance Q3' END,
          CASE p_country WHEN 'FR' THEN 'Licence logicielle annuelle' WHEN 'BE' THEN 'Annual software license' ELSE 'Licence SaaS annuelle' END,
          CASE p_country WHEN 'FR' THEN 'Achat materiel informatique' WHEN 'BE' THEN 'IT equipment purchase' ELSE 'Achat equipement IT' END,
          CASE p_country WHEN 'FR' THEN 'Honoraires conseil juridique' WHEN 'BE' THEN 'Legal counsel fees' ELSE 'Frais conseil juridique' END,
          CASE p_country WHEN 'FR' THEN 'Commande fournitures speciales' WHEN 'BE' THEN 'Special supplies order' ELSE 'Commande materiel specialise' END
        ])[v_i],
        v_base,
        CASE
          WHEN v_i <= 2 THEN v_base                   -- paid
          WHEN v_i <= 4 THEN ROUND(v_base * 0.5, 2)   -- partial
          ELSE 0                                        -- pending / overdue
        END,
        p_currency,
        (now() - ((80 + v_i * 12) || ' days')::interval)::date,
        CASE
          WHEN v_i = 7 THEN (now() - interval '10 days')::date  -- overdue
          ELSE (now() + ((20 + v_i * 8) || ' days')::interval)::date
        END,
        (ARRAY['paid','paid','partial','partial','pending','pending','overdue'])[v_i],
        'business',
        (ARRAY[
          CASE p_country WHEN 'FR' THEN 'Regle par virement bancaire' WHEN 'BE' THEN 'Settled by bank transfer' ELSE 'Paye par virement' END,
          CASE p_country WHEN 'FR' THEN 'Paiement complet effectue' WHEN 'BE' THEN 'Full payment completed' ELSE 'Reglement integral confirme' END,
          CASE p_country WHEN 'FR' THEN 'Echeancier: 50% verse, solde a 60j' WHEN 'BE' THEN 'Payment plan: 50% paid, balance at 60d' ELSE 'Plan: 50% paye, reste a 60 jours' END,
          CASE p_country WHEN 'FR' THEN 'Moitie payee, reste en negociation' WHEN 'BE' THEN 'Half paid, remainder under negotiation' ELSE 'Paiement partiel, solde en discussion' END,
          CASE p_country WHEN 'FR' THEN 'Facture recue, en attente validation' WHEN 'BE' THEN 'Invoice received, pending approval' ELSE 'Facture en cours de validation' END,
          CASE p_country WHEN 'FR' THEN 'En attente de facturation finale' WHEN 'BE' THEN 'Awaiting final billing' ELSE 'Attente facture definitive' END,
          CASE p_country WHEN 'FR' THEN 'RETARD: relance fournisseur effectuee' WHEN 'BE' THEN 'LATE: supplier follow-up done' ELSE 'RETARD: relance envoyee au fournisseur' END
        ])[v_i],
        p_cid
      );
    END LOOP;

    -- ================================================================
    -- M. CLOSING: RAISE NOTICE
    -- ================================================================
    RAISE NOTICE 'Part 3 seeded: supplier orders, purchase orders, supplier invoices, projects, tasks, subtasks, timesheets, bank, credit notes, receivables, payables for company %', p_cname;

    RAISE NOTICE 'Comprehensive seed complete for company: %', p_cname;
END;
$fn$;


-- ============================================================================
-- PHASE 4: SEED USER-LEVEL ENTITIES + CALL FUNCTION FOR ALL 21 COMPANIES
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
    'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
    'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
  ];
BEGIN
  -- Call for ALL companies of all 3 demo users
  -- row_number() per user gives each company a unique seq (1..7)
  FOR rec IN
    SELECT c.id, c.user_id, c.country, c.currency, c.company_name,
           ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at)::int AS seq
    FROM company c
    WHERE c.user_id = ANY(v_user_ids)
    ORDER BY c.user_id, c.created_at
  LOOP
    RAISE NOTICE 'Seeding company #% : % (user: %)', rec.seq, rec.company_name, rec.user_id;
    PERFORM _seed_demo_company(rec.user_id, rec.id, rec.country, rec.currency, rec.company_name, rec.seq);
  END LOOP;

  RAISE NOTICE 'All 21 companies seeded successfully!';
END $$;


-- ============================================================================
-- PHASE 5: CLEANUP — DROP TEMPORARY FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS _seed_demo_company(UUID, UUID, TEXT, TEXT, TEXT, INT);

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
