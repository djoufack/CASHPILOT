function timestampFor(date, hour = 9, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${date}T${hh}:${mm}:00Z`;
}

function clampAmount(value, roundAmount) {
  return roundAmount(Number(value || 0));
}

function splitAmount(total, ratios, roundAmount) {
  const normalized = ratios.map((ratio) => Number(ratio || 0));
  const sum = normalized.reduce((acc, ratio) => acc + ratio, 0) || 1;
  const pieces = normalized.map((ratio) => roundAmount((Number(total || 0) * ratio) / sum));
  const delta = roundAmount(Number(total || 0) - pieces.reduce((acc, piece) => acc + piece, 0));
  pieces[pieces.length - 1] = roundAmount(pieces[pieces.length - 1] + delta);
  return pieces;
}

function ensureMinimumRows(rows, minimum, buildRow) {
  const result = [...rows];
  const source = [...rows];

  if (!source.length) {
    return result;
  }

  while (result.length < minimum) {
    const index = result.length;
    result.push(buildRow(source[index % source.length], index));
  }

  return result;
}

function pickCyclic(rows, index) {
  if (!rows.length) return null;
  return rows[index % rows.length];
}

function getLocaleBlueprint(config) {
  switch (config.country) {
    case 'FR':
      return {
        peppolScheme: '0002',
        companyPeppol: '0002:cashpilot-fr-demo',
        companyBankName: 'Banque Demo France',
        companySwift: 'BNPAFRPP',
        companyBankAccount: 'FR76 1234 5678 9012 3456 7890 123',
        demoPlan: { slug: 'pro', price: 19.99 },
        bank: {
          primaryInstitutionId: 'demo-fr-primary',
          primaryInstitutionName: 'Banque Demo France',
          secondaryInstitutionId: 'demo-fr-secondary',
          secondaryInstitutionName: 'Reseau France Entreprises',
          iban: 'FR7612345678901234567890123',
          accountName: 'Compte exploitation France',
          balance: 68240.45,
        },
        paymentTerms: [
          { key: 'cash', name: 'Paiement comptant', days: 0, description: 'Reglement a reception' },
          { key: 'net15', name: '15 jours fin de mois', days: 15, description: 'Paiement a 15 jours' },
          { key: 'net30', name: '30 jours', days: 30, description: 'Paiement a 30 jours date facture' },
        ],
        clientMeta: [
          { city: 'Paris', postal_code: '75008', country: 'FR', phone: '+33 1 80 20 10 01', website: 'https://luxe-retail.demo', peppol: '0002:luxe-retail-fr' },
          { city: 'Lille', postal_code: '59800', country: 'FR', phone: '+33 3 20 10 20 02', website: 'https://nordic-tech.demo', peppol: '0002:nordic-tech-fr' },
          { city: 'Nantes', postal_code: '44000', country: 'FR', phone: '+33 2 40 10 30 03', website: 'https://atelier-ouest.demo', peppol: null },
        ],
        suppliers: [
          { key: 'infra', company_name: 'Hexa Infra Services', contact_person: 'Marc Duval', city: 'Lyon', postal_code: '69003', country: 'FR', email: 'ops@hexa-infra.demo', phone: '+33 4 72 00 10 10', website: 'https://hexa-infra.demo', bank_name: 'Banque Rhone', iban: 'FR7630001007941234567890185', bic_swift: 'BDFEFRPP', supplier_type: 'both', payment_terms: '30 jours' },
          { key: 'office', company_name: 'Bureau Equipement France', contact_person: 'Nora Petit', city: 'Rouen', postal_code: '76000', country: 'FR', email: 'commercial@bureau-equipement.demo', phone: '+33 2 35 00 22 11', website: 'https://bureau-equipement.demo', bank_name: 'Banque Nord Ouest', iban: 'FR7630002007941234567890186', bic_swift: 'BNOUFRPP', supplier_type: 'product', payment_terms: '15 jours' },
          { key: 'compliance', company_name: 'Conformite & Fiscalite Conseil', contact_person: 'Aude Rey', city: 'Bordeaux', postal_code: '33000', country: 'FR', email: 'hello@conformite-conseil.demo', phone: '+33 5 56 10 10 10', website: 'https://conformite-conseil.demo', bank_name: 'Banque Atlantique', iban: 'FR7630003007941234567890187', bic_swift: 'BATAFRPP', supplier_type: 'service', payment_terms: '30 jours' },
        ],
        productCategories: [
          { key: 'software', name: 'Logiciels', description: 'Licences et modules SaaS' },
          { key: 'hardware', name: 'Equipement', description: 'Materiel et terminaux' },
          { key: 'operations', name: 'Operations', description: 'Kits et consommables' },
        ],
        serviceCategories: [
          { key: 'advisory', name: 'Conseil', description: 'Diagnostic et cadrage' },
          { key: 'implementation', name: 'Implementation', description: 'Deploiement et parametrage' },
          { key: 'support', name: 'Support', description: 'Accompagnement continu' },
        ],
        team: [
          { key: 'ops', name: 'Camille Durand', email: 'camille.durand@cashpilot.demo', role: 'manager' },
          { key: 'delivery', name: 'Leo Marchand', email: 'leo.marchand@cashpilot.demo', role: 'member' },
          { key: 'finance', name: 'Nina Laurent', email: 'nina.laurent@cashpilot.demo', role: 'viewer' },
        ],
      };
    case 'BE':
      return {
        peppolScheme: '0208',
        companyPeppol: '0208:cashpilot-be-demo',
        companyBankName: 'Banque Demo Belgique',
        companySwift: 'GEBABEBB',
        companyBankAccount: 'BE68 5390 0754 7034',
        demoPlan: { slug: 'business', price: 39.99 },
        bank: {
          primaryInstitutionId: 'demo-be-primary',
          primaryInstitutionName: 'Banque Demo Belgique',
          secondaryInstitutionId: 'demo-be-secondary',
          secondaryInstitutionName: 'Reseau Belge Entreprises',
          iban: 'BE68539007547034',
          accountName: 'Compte exploitation Belgique',
          balance: 74410.9,
        },
        paymentTerms: [
          { key: 'cash', name: 'Comptant', days: 0, description: 'Paiement immediat' },
          { key: 'net15', name: '15 dagen', days: 15, description: 'Paiement a 15 jours' },
          { key: 'net30', name: '30 dagen', days: 30, description: 'Paiement a 30 jours' },
        ],
        clientMeta: [
          { city: 'Bruxelles', postal_code: '1000', country: 'BE', phone: '+32 2 430 10 01', website: 'https://brussels-growth.demo', peppol: '0208:brussels-growth' },
          { city: 'Antwerpen', postal_code: '2000', country: 'BE', phone: '+32 3 430 10 02', website: 'https://antwerp-service.demo', peppol: '0208:antwerp-service' },
          { city: 'Gent', postal_code: '9000', country: 'BE', phone: '+32 9 430 10 03', website: 'https://gent-digital.demo', peppol: null },
        ],
        suppliers: [
          { key: 'infra', company_name: 'Benelux Infra Hub', contact_person: 'Thomas Verbeeck', city: 'Leuven', postal_code: '3000', country: 'BE', email: 'ops@benelux-infra.demo', phone: '+32 16 10 10 10', website: 'https://benelux-infra.demo', bank_name: 'KBC Demo', iban: 'BE68539007547035', bic_swift: 'KREDBEBB', supplier_type: 'both', payment_terms: '30 dagen' },
          { key: 'office', company_name: 'Atelier Equipement Bruxelles', contact_person: 'Julie Janssens', city: 'Bruxelles', postal_code: '1000', country: 'BE', email: 'sales@atelier-equipement.demo', phone: '+32 2 55 66 77 88', website: 'https://atelier-equipement.demo', bank_name: 'Belfius Demo', iban: 'BE68539007547036', bic_swift: 'GKCCBEBB', supplier_type: 'product', payment_terms: '15 dagen' },
          { key: 'compliance', company_name: 'VAT & Compliance Studio', contact_person: 'Sophie Peeters', city: 'Liege', postal_code: '4000', country: 'BE', email: 'hello@vat-compliance.demo', phone: '+32 4 88 77 66 55', website: 'https://vat-compliance.demo', bank_name: 'ING Demo', iban: 'BE68539007547037', bic_swift: 'BBRUBEBB', supplier_type: 'service', payment_terms: '30 dagen' },
        ],
        productCategories: [
          { key: 'software', name: 'Software', description: 'Licenties en integraties' },
          { key: 'hardware', name: 'Equipment', description: 'Hardware en terminals' },
          { key: 'operations', name: 'Operations', description: 'Kits and consumables' },
        ],
        serviceCategories: [
          { key: 'advisory', name: 'Advisory', description: 'Finance en reporting' },
          { key: 'implementation', name: 'Implementation', description: 'Onboarding en configuratie' },
          { key: 'support', name: 'Support', description: 'Managed assistance' },
        ],
        team: [
          { key: 'ops', name: 'Elise Vermeulen', email: 'elise.vermeulen@cashpilot.demo', role: 'manager' },
          { key: 'delivery', name: 'Tom Jacobs', email: 'tom.jacobs@cashpilot.demo', role: 'member' },
          { key: 'finance', name: 'Lies De Smet', email: 'lies.desmet@cashpilot.demo', role: 'viewer' },
        ],
      };
    default:
      return {
        peppolScheme: '9915',
        companyPeppol: '9915:cashpilot-ohada-demo',
        companyBankName: 'Banque Demo Afrique',
        companySwift: 'SGCMCMCX',
        companyBankAccount: 'CM21 1000 2000 3000 4000 5000 6000',
        demoPlan: { slug: 'enterprise', price: 99.99 },
        bank: {
          primaryInstitutionId: 'demo-ohada-primary',
          primaryInstitutionName: 'Banque Demo Afrique',
          secondaryInstitutionId: 'demo-ohada-secondary',
          secondaryInstitutionName: 'Reseau OHADA Entreprises',
          iban: '',
          accountName: 'Compte principal Afrique',
          balance: 48250000,
        },
        paymentTerms: [
          { key: 'cash', name: 'Paiement immediat', days: 0, description: 'Reglement immediat' },
          { key: 'net15', name: '15 jours', days: 15, description: 'Paiement a 15 jours' },
          { key: 'net30', name: '30 jours', days: 30, description: 'Paiement a 30 jours' },
        ],
        clientMeta: [
          { city: 'Douala', postal_code: '0000', country: 'CM', phone: '+237 6 90 10 20 30', website: 'https://douala-distribution.demo', peppol: '9915:douala-distribution' },
          { city: 'Abidjan', postal_code: '0000', country: 'CI', phone: '+225 07 10 20 30 40', website: 'https://abidjan-services.demo', peppol: '9915:abidjan-services' },
          { city: 'Libreville', postal_code: '0000', country: 'GA', phone: '+241 01 10 20 30', website: 'https://libreville-retail.demo', peppol: null },
        ],
        suppliers: [
          { key: 'infra', company_name: 'Infra Cloud Afrique', contact_person: 'Cedric Essomba', city: 'Douala', postal_code: '0000', country: 'CM', email: 'ops@infra-cloud-afrique.demo', phone: '+237 6 55 10 10 10', website: 'https://infra-cloud-afrique.demo', bank_name: 'Afriland Demo', iban: '', bic_swift: 'AFRLCMCX', supplier_type: 'both', payment_terms: '30 jours' },
          { key: 'office', company_name: 'Equipement Bureau Afrique', contact_person: 'Awa Kone', city: 'Abidjan', postal_code: '0000', country: 'CI', email: 'sales@equipement-bureau.demo', phone: '+225 05 11 22 33 44', website: 'https://equipement-bureau.demo', bank_name: 'SGBCI Demo', iban: '', bic_swift: 'SGBCCIAB', supplier_type: 'product', payment_terms: '15 jours' },
          { key: 'compliance', company_name: 'Fiscalite & Conformite OHADA', contact_person: 'Joel Ndzi', city: 'Yaounde', postal_code: '0000', country: 'CM', email: 'hello@fiscalite-ohada.demo', phone: '+237 6 77 88 99 00', website: 'https://fiscalite-ohada.demo', bank_name: 'CCA Demo', iban: '', bic_swift: 'CCAMCMCX', supplier_type: 'service', payment_terms: '30 jours' },
        ],
        productCategories: [
          { key: 'software', name: 'Logiciels', description: 'Licences et outils metier' },
          { key: 'hardware', name: 'Materiel', description: 'Terminaux et equipements' },
          { key: 'operations', name: 'Operations', description: 'Kits et consommables' },
        ],
        serviceCategories: [
          { key: 'advisory', name: 'Conseil', description: 'Structuration et pilotage' },
          { key: 'implementation', name: 'Deploiement', description: 'Mise en place terrain' },
          { key: 'support', name: 'Support', description: 'Accompagnement regional' },
        ],
        team: [
          { key: 'ops', name: 'Mireille Tchoumi', email: 'mireille.tchoumi@cashpilot.demo', role: 'manager' },
          { key: 'delivery', name: 'Arnaud Mbarga', email: 'arnaud.mbarga@cashpilot.demo', role: 'member' },
          { key: 'finance', name: 'Awa Traore', email: 'awa.traore@cashpilot.demo', role: 'viewer' },
        ],
      };
  }
}

export function buildFullDemoDataset(args) {
  const {
    CURRENT_YEAR,
    config,
    userSeed,
    userId,
    primaryCompanyId = null,
    clientRows,
    invoiceRows,
    paymentRows,
    uuidFromSeed,
    roundAmount,
    isoDate,
    addDays,
  } = args;

  const locale = getLocaleBlueprint(config);
  const minimumRecords = 7;
  const currency = config.company.accounting_currency;
  const amountFactor = currency === 'XAF' ? 650 : 1;
  const amount = (base) => clampAmount(base * amountFactor, roundAmount);
  const vatRate = Number(config.vatRate || 0);
  const clientMetaRows = ensureMinimumRows(locale.clientMeta, minimumRecords, (template, index) => ({
    ...template,
    city: `${template.city} ${index + 1}`,
    postal_code: template.postal_code,
    country: template.country,
    phone: template.phone,
    website: template.website.replace('.demo', `-${index + 1}.demo`),
    peppol: template.peppol ? `${template.peppol}-${String(index + 1).padStart(2, '0')}` : null,
  }));
  const supplierSeeds = ensureMinimumRows(locale.suppliers, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(2, '0');
    return {
      ...template,
      key: `${template.key}-x${code}`,
      company_name: `${template.company_name} ${code}`,
      contact_person: `${template.contact_person} ${index + 1}`,
      email: `ops+${config.country.toLowerCase()}-supplier-${code}@cashpilot.cloud`,
      website: template.website.replace('.demo', `-${code}.demo`),
      payment_terms: template.payment_terms,
    };
  });
  const productCategorySeeds = ensureMinimumRows(locale.productCategories, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(2, '0');
    return {
      ...template,
      key: `${template.key}-x${code}`,
      name: `${template.name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
    };
  });
  const serviceCategorySeeds = ensureMinimumRows(locale.serviceCategories, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(2, '0');
    return {
      ...template,
      key: `${template.key}-x${code}`,
      name: `${template.name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
    };
  });
  const teamSeeds = ensureMinimumRows(locale.team, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(2, '0');
    return {
      ...template,
      key: `${template.key}-x${code}`,
      name: `${template.name} ${index + 1}`,
      email: `${template.key}.${config.country.toLowerCase()}.${code}@cashpilot.demo`,
    };
  });

  const companyPatch = {
    peppol_endpoint_id: locale.companyPeppol,
    peppol_scheme_id: locale.peppolScheme,
    peppol_ap_provider: 'scrada',
    bank_name: locale.companyBankName,
    bank_account: locale.companyBankAccount,
    swift: locale.companySwift,
  };

  const paymentTermRows = locale.paymentTerms.map((term, index) => ({
    id: uuidFromSeed(`${userSeed}:payment-term:${term.key}`),
    user_id: userId,
    name: term.name,
    days: term.days,
    description: term.description,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 2 + index), 8),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 2 + index), 8, 5),
  }));
  const paymentTermByKey = new Map(locale.paymentTerms.map((term, index) => [term.key, paymentTermRows[index].id]));

  const enhancedClientRows = clientRows.map((row, index) => {
    const meta = clientMetaRows[index] || clientMetaRows[0];
    return {
      ...row,
      city: meta.city,
      postal_code: meta.postal_code,
      country: meta.country,
      phone: meta.phone,
      website: meta.website,
      payment_terms: locale.paymentTerms[Math.min(index + 1, locale.paymentTerms.length - 1)].name,
      electronic_invoicing_enabled: Boolean(meta.peppol),
      peppol_endpoint_id: meta.peppol,
      peppol_scheme_id: meta.peppol ? locale.peppolScheme : null,
      notes: `${config.label} demo client`,
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 3 + index), 8),
    };
  });
  const defaultCompanyId =
    primaryCompanyId ||
    enhancedClientRows[0]?.company_id ||
    invoiceRows[0]?.company_id ||
    null;
  const companyScopeIds = Array.from(
    new Set(
      enhancedClientRows
        .map((row) => row.company_id || defaultCompanyId)
        .filter(Boolean)
    )
  );
  const resolveScopedCompanyId = (index, fallback = defaultCompanyId) =>
    companyScopeIds.length > 0
      ? companyScopeIds[index % companyScopeIds.length]
      : (fallback || null);
  const clientCompanyById = new Map(
    enhancedClientRows.map((row) => [row.id, row.company_id || defaultCompanyId])
  );

  const productCategoryRows = productCategorySeeds.map((category, index) => ({
    id: uuidFromSeed(`${userSeed}:product-category:${category.key}`),
    user_id: userId,
    name: category.name,
    description: category.description,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 6 + index), 9),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 6 + index), 9, 5),
  }));
  const productCategoryByKey = new Map(productCategorySeeds.map((category, index) => [category.key, productCategoryRows[index].id]));

  const serviceCategoryRows = serviceCategorySeeds.map((category, index) => ({
    id: uuidFromSeed(`${userSeed}:service-category:${category.key}`),
    user_id: userId,
    name: category.name,
    description: category.description,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 10 + index), 9),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 10 + index), 9, 5),
  }));
  const serviceCategoryByKey = new Map(serviceCategorySeeds.map((category, index) => [category.key, serviceCategoryRows[index].id]));

  const supplierRows = supplierSeeds.map((supplier, index) => ({
    id: uuidFromSeed(`${userSeed}:supplier:${supplier.key}`),
    user_id: userId,
    company_name: supplier.company_name,
    contact_person: supplier.contact_person,
    email: supplier.email,
    phone: supplier.phone,
    address: `${index + 12} ${supplier.city} Demo District`,
    city: supplier.city,
    postal_code: supplier.postal_code,
    country: supplier.country,
    website: supplier.website,
    currency,
    bank_name: supplier.bank_name,
    iban: supplier.iban,
    bic_swift: supplier.bic_swift,
    payment_terms: supplier.payment_terms,
    supplier_type: supplier.supplier_type,
    status: 'active',
    tax_id: `${config.country}-SUP-${index + 1}`,
    notes: `${config.label} demo supplier`,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 14 + index), 10),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 14 + index), 10, 5),
  }));
  const supplierByKey = new Map(supplierSeeds.map((supplier, index) => [supplier.key, supplierRows[index].id]));

  let supplierProductCategoryRows = [
    {
      id: uuidFromSeed(`${userSeed}:supplier-product-category:software`),
      user_id: userId,
      name: 'Solutions metier',
      description: 'Catalogue logiciel fournisseur',
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 18), 10),
    },
    {
      id: uuidFromSeed(`${userSeed}:supplier-product-category:hardware`),
      user_id: userId,
      name: 'Equipements terrain',
      description: 'Catalogue materiel fournisseur',
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 19), 10),
    },
  ];
  supplierProductCategoryRows = ensureMinimumRows(supplierProductCategoryRows, minimumRecords, (template, index) => ({
    ...template,
    id: uuidFromSeed(`${userSeed}:supplier-product-category:x${String(index + 1).padStart(3, '0')}`),
    name: `${template.name} ${index + 1}`,
    description: `${template.description} ${index + 1}`,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 19 + index), 10),
  }));
  const supplierProductCategoryByKey = new Map([
    ['software', supplierProductCategoryRows[0].id],
    ['hardware', supplierProductCategoryRows[1].id],
  ]);

  let supplierProductRows = [
    ['license', 'infra', 'software', `Licence plateforme ${config.label}`, `${config.country}-LIC-001`, amount(1400), 120, 25, 30, 'licence'],
    ['scanner', 'office', 'hardware', `Kit scanner ${config.label}`, `${config.country}-SCN-002`, amount(380), 18, 6, 12, 'kit'],
    ['ops', 'office', 'hardware', `Bundle operations ${config.label}`, `${config.country}-OPS-003`, amount(120), 40, 10, 15, 'bundle'],
  ].map(([key, supplierKey, categoryKey, productName, sku, unitPrice, stockQuantity, minStockLevel, reorderQuantity, unit], index) => ({
    id: uuidFromSeed(`${userSeed}:supplier-product:${key}`),
    supplier_id: supplierByKey.get(supplierKey),
    category_id: supplierProductCategoryByKey.get(categoryKey),
    product_name: productName,
    description: `${productName} demo`,
    sku,
    unit_price: unitPrice,
    unit,
    stock_quantity: stockQuantity,
    min_stock_level: minStockLevel,
    reorder_quantity: reorderQuantity,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 20 + index), 10),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 20 + index), 10, 5),
  }));
  supplierProductRows = ensureMinimumRows(supplierProductRows, minimumRecords, (template, index) => {
    const supplier = pickCyclic(supplierRows, index);
    const category = pickCyclic(supplierProductCategoryRows, index);
    const code = String(index + 1).padStart(3, '0');
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:supplier-product:x${code}`),
      supplier_id: supplier?.id || template.supplier_id,
      category_id: category?.id || template.category_id,
      product_name: `${template.product_name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      sku: `${config.country}-SUP-${code}`,
      unit_price: roundAmount(Number(template.unit_price || 0) * (1 + index * 0.04)),
      stock_quantity: Number(template.stock_quantity || 0) + index * 3,
      min_stock_level: Math.max(2, Number(template.min_stock_level || 0) + index),
      reorder_quantity: Math.max(4, Number(template.reorder_quantity || 0) + index),
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 3), 20 + (index % 7)), 10),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 3), 20 + (index % 7)), 10, 5),
    };
  });
  const supplierProductByKey = new Map([
    ['license', supplierProductRows[0].id],
    ['scanner', supplierProductRows[1].id],
    ['ops', supplierProductRows[2].id],
  ]);

  let supplierServiceRows = [
    ['compliance', 'compliance', `Mission conformite ${config.label}`, 'fixed', amount(2400), amount(160), 'mission'],
    ['support', 'infra', `Support infra ${config.label}`, 'hourly', null, amount(110), 'heure'],
  ].map(([key, supplierKey, serviceName, pricingType, fixedPrice, hourlyRate, unit], index) => ({
    id: uuidFromSeed(`${userSeed}:supplier-service:${key}`),
    supplier_id: supplierByKey.get(supplierKey),
    service_name: serviceName,
    description: `${serviceName} demo`,
    pricing_type: pricingType,
    fixed_price: fixedPrice,
    hourly_rate: hourlyRate,
    unit,
    availability: 'available',
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 24 + index), 10),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 24 + index), 10, 5),
  }));
  supplierServiceRows = ensureMinimumRows(supplierServiceRows, minimumRecords, (template, index) => {
    const supplier = pickCyclic(supplierRows, index);
    const code = String(index + 1).padStart(3, '0');
    const pricingType = index % 2 === 0 ? 'fixed' : 'hourly';
    const fixedPrice = pricingType === 'fixed'
      ? roundAmount(Number(template.fixed_price || template.hourly_rate || 0) * (1 + index * 0.05))
      : null;
    const hourlyRate = pricingType === 'hourly'
      ? roundAmount(Number(template.hourly_rate || template.fixed_price || 0) * (1 + index * 0.03))
      : null;
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:supplier-service:x${code}`),
      supplier_id: supplier?.id || template.supplier_id,
      service_name: `${template.service_name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      pricing_type: pricingType,
      fixed_price: fixedPrice,
      hourly_rate: hourlyRate,
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 3), 24 + (index % 5)), 10),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 3), 24 + (index % 5)), 10, 5),
    };
  });

  let productRows = [
    ['executive', 'software', 'infra', `Pack pilotage executif ${config.label}`, `${config.country}-PRD-001`, amount(3200), amount(1500), 22, 5, 'licence'],
    ['scanner', 'hardware', 'office', `Scanner embarque ${config.label}`, `${config.country}-PRD-002`, amount(690), amount(360), 4, 6, 'piece'],
    ['ops', 'operations', 'office', `Kit operations ${config.label}`, `${config.country}-PRD-003`, amount(260), amount(120), 0, 3, 'kit'],
    ['cloud', 'software', 'infra', `Credits cloud ${config.label}`, `${config.country}-PRD-004`, amount(95), amount(45), 250, 50, 'credit'],
  ].map(([key, categoryKey, supplierKey, productName, sku, unitPrice, purchasePrice, stockQuantity, minStockLevel, unit], index) => ({
    id: uuidFromSeed(`${userSeed}:product:${key}`),
    user_id: userId,
    category_id: productCategoryByKey.get(categoryKey),
    supplier_id: supplierByKey.get(supplierKey),
    product_name: productName,
    description: `${productName} demo`,
    sku,
    unit_price: unitPrice,
    purchase_price: purchasePrice,
    stock_quantity: stockQuantity,
    min_stock_level: minStockLevel,
    unit,
    is_active: true,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 26 + index), 12),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 26 + index), 12, 5),
  }));
  productRows = ensureMinimumRows(productRows, minimumRecords, (template, index) => {
    const category = pickCyclic(productCategoryRows, index);
    const supplier = pickCyclic(supplierRows, index);
    const code = String(index + 1).padStart(3, '0');
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:product:x${code}`),
      category_id: category?.id || template.category_id,
      supplier_id: supplier?.id || template.supplier_id,
      product_name: `${template.product_name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      sku: `${config.country}-PRD-${code}`,
      unit_price: roundAmount(Number(template.unit_price || 0) * (1 + index * 0.05)),
      purchase_price: roundAmount(Number(template.purchase_price || 0) * (1 + index * 0.03)),
      stock_quantity: Math.max(0, Number(template.stock_quantity || 0) + (index % 2 === 0 ? index * 2 : -index)),
      min_stock_level: Math.max(2, Number(template.min_stock_level || 0) + index),
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 4), 18 + (index % 10)), 12),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 4), 18 + (index % 10)), 12, 5),
    };
  });
  const productByKey = new Map([
    ['executive', productRows[0].id],
    ['scanner', productRows[1].id],
    ['ops', productRows[2].id],
    ['cloud', productRows[3].id],
  ]);

  let serviceRows = [
    ['advisory', 'advisory', `Diagnostic pilotage ${config.label}`, 'fixed', amount(4200), amount(210), amount(4200), 'mission'],
    ['implementation', 'implementation', `Mise en place reporting ${config.label}`, 'hourly', null, amount(180), amount(180), 'heure'],
    ['support', 'support', `Support continu ${config.label}`, 'hourly', null, amount(120), amount(120), 'heure'],
  ].map(([key, categoryKey, serviceName, pricingType, fixedPrice, hourlyRate, unitPrice, unit], index) => ({
    id: uuidFromSeed(`${userSeed}:service:${key}`),
    user_id: userId,
    category_id: serviceCategoryByKey.get(categoryKey),
    service_name: serviceName,
    description: `${serviceName} demo`,
    pricing_type: pricingType,
    fixed_price: fixedPrice,
    hourly_rate: hourlyRate,
    unit_price: unitPrice,
    unit,
    is_active: true,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 2 + index), 12),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 2 + index), 12, 5),
  }));
  serviceRows = ensureMinimumRows(serviceRows, minimumRecords, (template, index) => {
    const category = pickCyclic(serviceCategoryRows, index);
    const code = String(index + 1).padStart(3, '0');
    const pricingType = index % 3 === 0 ? 'fixed' : 'hourly';
    const fixedPrice = pricingType === 'fixed'
      ? roundAmount(Number(template.fixed_price || template.unit_price || 0) * (1 + index * 0.05))
      : null;
    const hourlyRate = pricingType === 'hourly'
      ? roundAmount(Number(template.hourly_rate || template.unit_price || 0) * (1 + index * 0.04))
      : null;
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:service:x${code}`),
      category_id: category?.id || template.category_id,
      service_name: `${template.service_name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      pricing_type: pricingType,
      fixed_price: fixedPrice,
      hourly_rate: hourlyRate,
      unit_price: pricingType === 'fixed' ? fixedPrice : hourlyRate,
      created_at: timestampFor(isoDate(CURRENT_YEAR, 2 + (index % 4), 2 + (index % 12)), 12),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 2 + (index % 4), 2 + (index % 12)), 12, 5),
    };
  });
  const serviceByKey = new Map([
    ['advisory', serviceRows[0].id],
    ['implementation', serviceRows[1].id],
    ['support', serviceRows[2].id],
  ]);

  const enhancedInvoiceRows = invoiceRows.map((row, index) => ({
    ...row,
    payment_terms_id: paymentTermByKey.get('net30'),
    invoice_type: 'mixed',
    reference: `REF-${config.country}-${String(index + 1).padStart(3, '0')}`,
    header_note: `${config.label} marketing demo invoice`,
    footer_note: 'Generated for CashPilot demo',
    terms_and_conditions: 'Paiement sous 30 jours. Conditions locales applicables.',
    peppol_status: index === 0 ? 'delivered' : index === 1 ? 'pending' : null,
    peppol_sent_at: index < 2 ? timestampFor(row.date, 13, index * 5) : null,
    peppol_document_id: index < 2 ? `${config.country}-PEPPOL-${CURRENT_YEAR}-${index + 1}` : null,
    peppol_error_message: null,
  }));
  const invoiceCompanyById = new Map(
    enhancedInvoiceRows.map((row) => [row.id, row.company_id || defaultCompanyId])
  );

  const invoiceItemTemplates = [
    [
      { type: 'service', key: 'advisory', description: 'Diagnostic executif', quantity: 1, ratio: 0.7 },
      { type: 'product', key: 'executive', description: 'Pack pilotage executif', quantity: 2, ratio: 0.3 },
    ],
    [
      { type: 'service', key: 'implementation', description: 'Mise en place reporting', quantity: 24, ratio: 0.65 },
      { type: 'product', key: 'scanner', description: 'Scanner embarque', quantity: 2, ratio: 0.35 },
    ],
    [
      { type: 'service', key: 'support', description: 'Support mensuel', quantity: 18, ratio: 0.6 },
      { type: 'product', key: 'cloud', description: 'Credits cloud', quantity: 30, ratio: 0.4 },
    ],
  ];

  const invoiceItemRows = enhancedInvoiceRows.flatMap((invoiceRow, invoiceIndex) => {
    const template = invoiceItemTemplates[invoiceIndex] || invoiceItemTemplates[0];
    const totals = splitAmount(invoiceRow.total_ht, template.map((item) => item.ratio), roundAmount);
    return template.map((item, itemIndex) => ({
      id: uuidFromSeed(`${userSeed}:invoice-item:${invoiceRow.id}:${itemIndex}`),
      invoice_id: invoiceRow.id,
      description: item.description,
      item_type: item.type,
      product_id: item.type === 'product' ? productByKey.get(item.key) : null,
      service_id: item.type === 'service' ? serviceByKey.get(item.key) : null,
      quantity: item.quantity,
      unit_price: roundAmount(totals[itemIndex] / item.quantity),
      total: totals[itemIndex],
      created_at: timestampFor(invoiceRow.date, 9, itemIndex * 10),
    }));
  });

  const paymentAllocationRows = paymentRows.map((paymentRow, index) => ({
    id: uuidFromSeed(`${userSeed}:payment-allocation:${paymentRow.id}`),
    payment_id: paymentRow.id,
    invoice_id: paymentRow.invoice_id,
    amount: paymentRow.amount,
    created_at: timestampFor(paymentRow.payment_date, 16, index * 5),
  }));

  let quoteRows = [
    ['001', enhancedClientRows[0].id, isoDate(CURRENT_YEAR, 1, 8), 'accepted', amount(12500)],
    ['002', enhancedClientRows[1].id, isoDate(CURRENT_YEAR, 2, 4), 'sent', amount(9400)],
  ].map(([code, clientId, date, status, totalHt], index) => ({
    id: uuidFromSeed(`${userSeed}:quote:${code}`),
    user_id: userId,
    client_id: clientId,
    quote_number: `QT-${config.country}-${CURRENT_YEAR}-${code}`,
    date,
    status,
    tax_rate: vatRate,
    total_ht: totalHt,
    total_ttc: roundAmount(totalHt * (1 + vatRate / 100)),
    created_at: timestampFor(date, 9 + index),
  }));
  quoteRows = ensureMinimumRows(quoteRows, minimumRecords, (template, index) => {
    const client = pickCyclic(enhancedClientRows, index);
    const code = String(index + 1).padStart(3, '0');
    const date = isoDate(CURRENT_YEAR, 1 + (index % 6), 8 + (index % 14));
    const totalHt = amount(8600 + index * 980);
    const statuses = ['draft', 'sent', 'accepted', 'accepted', 'sent', 'draft', 'accepted'];
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:quote:x${code}`),
      client_id: client?.id || template.client_id,
      quote_number: `QT-${config.country}-${CURRENT_YEAR}-${code}`,
      date,
      status: statuses[index % statuses.length],
      total_ht: totalHt,
      total_ttc: roundAmount(totalHt * (1 + vatRate / 100)),
      created_at: timestampFor(date, 9 + (index % 5)),
    };
  });

  let purchaseOrderRows = [
    {
      id: uuidFromSeed(`${userSeed}:purchase-order:001`),
      user_id: userId,
      client_id: enhancedClientRows[0].id,
      company_id: enhancedClientRows[0].company_id || defaultCompanyId,
      payment_terms_id: paymentTermByKey.get('net30'),
      po_number: `PO-${config.country}-${CURRENT_YEAR}-001`,
      date: isoDate(CURRENT_YEAR, 1, 9),
      due_date: isoDate(CURRENT_YEAR, 1, 31),
      status: 'confirmed',
      total: amount(8600),
      notes: 'Bon de commande confirme',
      items: [
        { description: 'Pack pilotage executif', quantity: 2, unit_price: amount(3200), total: amount(6400) },
        { description: 'Diagnostic executif', quantity: 1, unit_price: amount(2200), total: amount(2200) },
      ],
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 9), 10),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 9), 10, 5),
    },
    {
      id: uuidFromSeed(`${userSeed}:purchase-order:002`),
      user_id: userId,
      client_id: enhancedClientRows[1].id,
      company_id: enhancedClientRows[1].company_id || defaultCompanyId,
      payment_terms_id: paymentTermByKey.get('net15'),
      po_number: `PO-${config.country}-${CURRENT_YEAR}-002`,
      date: isoDate(CURRENT_YEAR, 2, 8),
      due_date: isoDate(CURRENT_YEAR, 2, 23),
      status: 'sent',
      total: amount(5400),
      notes: 'Commande client en attente',
      items: [
        { description: 'Mise en place reporting', quantity: 18, unit_price: amount(180), total: amount(3240) },
        { description: 'Scanner embarque', quantity: 2, unit_price: amount(690), total: amount(1380) },
        { description: 'Credits cloud', quantity: 8, unit_price: amount(97.5), total: amount(780) },
      ],
      created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 8), 10),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 8), 10, 5),
    },
  ];
  purchaseOrderRows = ensureMinimumRows(purchaseOrderRows, minimumRecords, (template, index) => {
    const client = pickCyclic(enhancedClientRows, index);
    const code = String(index + 1).padStart(3, '0');
    const date = isoDate(CURRENT_YEAR, 1 + (index % 6), 9 + (index % 12));
    const items = (template.items || []).map((item, itemIndex) => {
      const quantity = Math.max(1, Number(item.quantity || 1) + (index % 2));
      const total = roundAmount(Number(item.total || 0) * (1 + index * 0.04 + itemIndex * 0.02));
      return {
        ...item,
        description: `${item.description} ${index + 1}`,
        quantity,
        unit_price: roundAmount(total / quantity),
        total,
      };
    });
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:purchase-order:x${code}`),
      client_id: client?.id || template.client_id,
      company_id: client?.company_id || template.company_id || defaultCompanyId,
      payment_terms_id: paymentTermRows[index % paymentTermRows.length]?.id || template.payment_terms_id,
      po_number: `PO-${config.country}-${CURRENT_YEAR}-${code}`,
      date,
      due_date: addDays(date, 18 + (index % 12)),
      status: ['draft', 'sent', 'confirmed', 'completed', 'sent', 'confirmed', 'cancelled'][index % 7],
      total: roundAmount(items.reduce((sum, item) => sum + Number(item.total || 0), 0)),
      notes: `${template.notes} ${index + 1}`,
      items,
      created_at: timestampFor(date, 10),
      updated_at: timestampFor(date, 10, 5),
    };
  });

  let recurringInvoiceRows = [
    ['001', enhancedClientRows[0].id, `Abonnement pilotage ${config.label}`, 'monthly', 'active', 5, amount(1800), true, 2, isoDate(CURRENT_YEAR, 3, 5)],
    ['002', enhancedClientRows[1].id, `Support analytique ${config.label}`, 'quarterly', 'paused', 12, amount(4200), false, 1, isoDate(CURRENT_YEAR, 4, 12)],
  ].map(([code, clientId, title, frequency, status, dayOfMonth, totalHt, autoSend, invoicesGenerated, nextDate], index) => ({
    id: uuidFromSeed(`${userSeed}:recurring-invoice:${code}`),
    user_id: userId,
    client_id: clientId,
    company_id: clientCompanyById.get(clientId) || defaultCompanyId,
    title,
    description: `${title} demo`,
    currency,
    frequency,
    status,
    interval_count: 1,
    day_of_month: dayOfMonth,
    start_date: isoDate(CURRENT_YEAR, 1, 5 + index * 7),
    end_date: index === 1 ? isoDate(CURRENT_YEAR, 12, 12) : null,
    next_generation_date: nextDate,
    next_date: nextDate,
    total_ht: totalHt,
    tva_rate: vatRate,
    total_tva: roundAmount(totalHt * (vatRate / 100)),
    total_ttc: roundAmount(totalHt * (1 + vatRate / 100)),
    auto_send: autoSend,
    invoices_generated: invoicesGenerated,
    last_generated_at: timestampFor(addDays(nextDate, -30), 7),
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 5 + index * 7), 7),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 5 + index * 7), 7, 5),
  }));
  recurringInvoiceRows = ensureMinimumRows(recurringInvoiceRows, minimumRecords, (template, index) => {
    const client = pickCyclic(enhancedClientRows, index);
    const code = String(index + 1).padStart(3, '0');
    const totalHt = amount(1650 + index * 540);
    const startDate = isoDate(CURRENT_YEAR, 1 + (index % 6), 5 + (index % 10));
    const nextDate = addDays(startDate, 30);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:recurring-invoice:x${code}`),
      client_id: client?.id || template.client_id,
      company_id: client?.company_id || template.company_id || defaultCompanyId,
      title: `${template.title} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      frequency: ['monthly', 'quarterly', 'monthly', 'yearly', 'monthly', 'quarterly', 'weekly'][index % 7],
      status: ['active', 'active', 'paused', 'active', 'cancelled', 'completed', 'active'][index % 7],
      day_of_month: 5 + (index % 20),
      start_date: startDate,
      end_date: index % 3 === 0 ? addDays(startDate, 180 + index * 4) : null,
      next_generation_date: nextDate,
      next_date: nextDate,
      total_ht: totalHt,
      total_tva: roundAmount(totalHt * (vatRate / 100)),
      total_ttc: roundAmount(totalHt * (1 + vatRate / 100)),
      auto_send: index % 2 === 0,
      invoices_generated: (index % 4) + 1,
      last_generated_at: timestampFor(addDays(nextDate, -30), 7),
      created_at: timestampFor(startDate, 7),
      updated_at: timestampFor(addDays(startDate, 32), 7, 5),
    };
  });

  let recurringInvoiceLineItemRows = [
    ['001', recurringInvoiceRows[0].id, 'Licence pilotage executive', 1, amount(1400)],
    ['002', recurringInvoiceRows[0].id, 'Support prioritaire', 2, amount(200)],
    ['003', recurringInvoiceRows[1].id, 'Coaching CFO trimestriel', 1, amount(4200)],
  ].map(([code, recurringInvoiceId, description, quantity, unitPrice], index) => ({
    id: uuidFromSeed(`${userSeed}:recurring-line:${code}`),
    recurring_invoice_id: recurringInvoiceId,
    description,
    quantity,
    unit_price: unitPrice,
    total: roundAmount(quantity * unitPrice),
    sort_order: index,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 5 + index), 7, 10),
  }));
  recurringInvoiceLineItemRows = [
    ...recurringInvoiceLineItemRows,
    ...recurringInvoiceRows.slice(2).map((row, index) => {
      const quantity = index % 2 === 0 ? 1 : 2;
      const total = roundAmount(Number(row.total_ht || 0));
      return {
        id: uuidFromSeed(`${userSeed}:recurring-line:x${String(index + 4).padStart(3, '0')}`),
        recurring_invoice_id: row.id,
        description: `${row.title} - forfait ${index + 1}`,
        quantity,
        unit_price: roundAmount(total / quantity),
        total,
        sort_order: 0,
        created_at: timestampFor(row.start_date || isoDate(CURRENT_YEAR, 1, 5), 7, 10),
      };
    }),
  ];

  let paymentReminderRuleRows = [
    ['001', enhancedInvoiceRows[0].id, 'Pre-due reminder', 3, 0, 1],
    ['002', enhancedInvoiceRows[1].id, 'Overdue sequence', 0, 7, 3],
  ].map(([code, invoiceId, name, daysBeforeDue, daysAfterDue, maxReminders], index) => ({
    id: uuidFromSeed(`${userSeed}:payment-reminder-rule:${code}`),
    user_id: userId,
    company_id: invoiceCompanyById.get(invoiceId) || resolveScopedCompanyId(index),
    name,
    days_before_due: daysBeforeDue,
    days_after_due: daysAfterDue,
    max_reminders: maxReminders,
    is_active: true,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 6 + index), 8),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 6 + index), 8, 5),
  }));
  paymentReminderRuleRows = ensureMinimumRows(paymentReminderRuleRows, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(3, '0');
    const invoice = pickCyclic(enhancedInvoiceRows, index);
    const invoiceDate = invoice?.date || isoDate(CURRENT_YEAR, 1, 6 + (index % 12));
    const frequency = [
      { before: 5, after: 0, max: 1, name: 'Reminder pre-echeance' },
      { before: 2, after: 0, max: 1, name: 'Relance J-2' },
      { before: 0, after: 3, max: 2, name: 'Relance retard court' },
      { before: 0, after: 7, max: 3, name: 'Relance retard standard' },
      { before: 0, after: 14, max: 4, name: 'Escalade retard' },
    ][index % 5];
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:payment-reminder-rule:x${code}`),
      company_id: invoiceCompanyById.get(invoice?.id) || resolveScopedCompanyId(index, template.company_id || defaultCompanyId),
      name: `${frequency.name} ${index + 1}`,
      days_before_due: frequency.before,
      days_after_due: frequency.after,
      max_reminders: frequency.max,
      is_active: index % 6 !== 0,
      created_at: timestampFor(invoiceDate, 8),
      updated_at: timestampFor(invoiceDate, 8, 5),
    };
  });

  let paymentReminderLogRows = [
    ['001', enhancedInvoiceRows[0].id, paymentReminderRuleRows[0].id, enhancedClientRows[0].email, 1, addDays(enhancedInvoiceRows[0].date, 18)],
    ['002', enhancedInvoiceRows[1].id, paymentReminderRuleRows[1].id, enhancedClientRows[1].email, 1, addDays(enhancedInvoiceRows[1].date, 19)],
  ].map(([code, invoiceId, ruleId, recipientEmail, reminderNumber, sentAt]) => ({
    id: uuidFromSeed(`${userSeed}:payment-reminder-log:${code}`),
    user_id: userId,
    company_id: invoiceCompanyById.get(invoiceId) || defaultCompanyId,
    invoice_id: invoiceId,
    rule_id: ruleId,
    recipient_email: recipientEmail,
    reminder_number: reminderNumber,
    status: 'sent',
    sent_at: timestampFor(sentAt, 9),
  }));
  paymentReminderLogRows = ensureMinimumRows(paymentReminderLogRows, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(3, '0');
    const invoice = pickCyclic(enhancedInvoiceRows, index) || enhancedInvoiceRows[0];
    const client = enhancedClientRows.find((row) => row.id === invoice?.client_id) || pickCyclic(enhancedClientRows, index);
    const rule = pickCyclic(paymentReminderRuleRows, index) || paymentReminderRuleRows[0];
    const reminderNumber = (index % 3) + 1;
    const sentAtDate = addDays(invoice?.date || isoDate(CURRENT_YEAR, 1, 10), 10 + index);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:payment-reminder-log:x${code}`),
      company_id: invoiceCompanyById.get(invoice?.id) || rule?.company_id || resolveScopedCompanyId(index, template.company_id || defaultCompanyId),
      invoice_id: invoice?.id || template.invoice_id,
      rule_id: rule?.id || template.rule_id,
      recipient_email: client?.email || template.recipient_email,
      reminder_number: reminderNumber,
      status: index % 7 === 0 ? 'failed' : 'sent',
      sent_at: timestampFor(sentAtDate, 9),
    };
  });

  let supplierOrderRows = [
    ['001', 'infra', 'received', isoDate(CURRENT_YEAR, 1, 18), isoDate(CURRENT_YEAR, 1, 28), isoDate(CURRENT_YEAR, 1, 27), amount(6200), 'Commande fournisseur receptionnee'],
    ['002', 'compliance', 'confirmed', isoDate(CURRENT_YEAR, 2, 14), isoDate(CURRENT_YEAR, 2, 28), null, amount(2400), 'Mission conformite programmee'],
  ].map(([code, supplierKey, orderStatus, orderDate, expectedDeliveryDate, actualDeliveryDate, totalAmount, notes], index) => ({
    id: uuidFromSeed(`${userSeed}:supplier-order:${code}`),
    user_id: userId,
    supplier_id: supplierByKey.get(supplierKey),
    order_number: `SO-${config.country}-${CURRENT_YEAR}-${code}`,
    order_date: orderDate,
    expected_delivery_date: expectedDeliveryDate,
    actual_delivery_date: actualDeliveryDate,
    order_status: orderStatus,
    total_amount: totalAmount,
    notes,
    created_at: timestampFor(orderDate, 15),
    updated_at: timestampFor(orderDate, 15, 5 + index),
  }));
  supplierOrderRows = ensureMinimumRows(supplierOrderRows, minimumRecords, (template, index) => {
    const supplier = pickCyclic(supplierRows, index);
    const code = String(index + 1).padStart(3, '0');
    const orderDate = isoDate(CURRENT_YEAR, 1 + (index % 6), 10 + (index % 12));
    const totalAmount = amount(2100 + index * 880);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:supplier-order:x${code}`),
      supplier_id: supplier?.id || template.supplier_id,
      order_number: `SO-${config.country}-${CURRENT_YEAR}-${code}`,
      order_date: orderDate,
      expected_delivery_date: addDays(orderDate, 8 + (index % 10)),
      actual_delivery_date: index % 3 === 0 ? addDays(orderDate, 9 + (index % 8)) : null,
      order_status: ['draft', 'confirmed', 'pending', 'confirmed', 'received', 'cancelled', 'pending'][index % 7],
      total_amount: totalAmount,
      notes: `${template.notes} ${index + 1}`,
      created_at: timestampFor(orderDate, 15),
      updated_at: timestampFor(orderDate, 15, 5 + (index % 10)),
    };
  });

  let supplierOrderItemRows = [
    ['001', supplierOrderRows[0].id, supplierProductByKey.get('license'), null, 3, amount(1400)],
    ['002', supplierOrderRows[0].id, supplierProductByKey.get('scanner'), null, 4, amount(500)],
    ['003', supplierOrderRows[1].id, null, supplierServiceRows[0].id, 1, amount(2400)],
  ].map(([code, orderId, productId, serviceId, quantity, unitPrice]) => ({
    id: uuidFromSeed(`${userSeed}:supplier-order-item:${code}`),
    order_id: orderId,
    product_id: productId,
    service_id: serviceId,
    quantity,
    unit_price: unitPrice,
    total_price: roundAmount(quantity * unitPrice),
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 1 + Number(code)), 15),
  }));
  supplierOrderItemRows = [
    ...supplierOrderItemRows,
    ...supplierOrderRows.slice(2).flatMap((row, index) => {
      const product = pickCyclic(supplierProductRows, index);
      const service = pickCyclic(supplierServiceRows, index);
      const quantity = 1 + (index % 3);
      const price = roundAmount(Number(product?.unit_price || service?.hourly_rate || 0));
      return [
        {
          id: uuidFromSeed(`${userSeed}:supplier-order-item:x${String(index * 2 + 4).padStart(3, '0')}`),
          order_id: row.id,
          product_id: product?.id || null,
          service_id: null,
          quantity,
          unit_price: price,
          total_price: roundAmount(quantity * price),
          created_at: timestampFor(row.order_date, 15, 10),
        },
        {
          id: uuidFromSeed(`${userSeed}:supplier-order-item:x${String(index * 2 + 5).padStart(3, '0')}`),
          order_id: row.id,
          product_id: null,
          service_id: service?.id || null,
          quantity: 1,
          unit_price: roundAmount(Number(service?.fixed_price || service?.hourly_rate || price)),
          total_price: roundAmount(Number(service?.fixed_price || service?.hourly_rate || price)),
          created_at: timestampFor(row.order_date, 15, 20),
        },
      ];
    }),
  ];

  let supplierInvoiceRows = [
    ['001', 'infra', isoDate(CURRENT_YEAR, 1, 27), isoDate(CURRENT_YEAR, 2, 10), amount(6200), 'paid'],
    ['002', 'compliance', isoDate(CURRENT_YEAR, 2, 20), isoDate(CURRENT_YEAR, 3, 15), amount(2400), 'pending'],
  ].map(([code, supplierKey, invoiceDate, dueDate, totalAmount, paymentStatus], index) => {
    const totalHt = roundAmount(totalAmount / (1 + vatRate / 100));
    const supplierRow = supplierRows[supplierKey === 'infra' ? 0 : 2];
    return {
      id: uuidFromSeed(`${userSeed}:supplier-invoice:${code}`),
      supplier_id: supplierByKey.get(supplierKey),
      invoice_number: `SUP-${config.country}-${CURRENT_YEAR}-${code}`,
      invoice_date: invoiceDate,
      due_date: dueDate,
      currency,
      total_amount: totalAmount,
      total_ht: totalHt,
      total_ttc: totalAmount,
      vat_rate: vatRate,
      vat_amount: roundAmount(totalAmount - totalHt),
      payment_status: paymentStatus,
      payment_terms: index === 0 ? '15 jours' : '30 jours',
      supplier_name_extracted: supplierRow.company_name,
      supplier_address_extracted: supplierRow.address,
      supplier_vat_number: `${config.country}-SUPVAT-00${index + 1}`,
      notes: 'Facture fournisseur demo',
      created_at: timestampFor(invoiceDate, 15),
      updated_at: timestampFor(invoiceDate, 15, 5),
      ai_extracted: true,
      ai_confidence: 0.95,
      ai_extracted_at: timestampFor(invoiceDate, 15, 10),
      ai_raw_response: { provider: 'demo', quality: 'high' },
      iban: supplierRow.iban,
      bic: supplierRow.bic_swift,
    };
  });
  supplierInvoiceRows = ensureMinimumRows(supplierInvoiceRows, minimumRecords, (template, index) => {
    const supplier = pickCyclic(supplierRows, index);
    const code = String(index + 1).padStart(3, '0');
    const invoiceDate = isoDate(CURRENT_YEAR, 1 + (index % 6), 12 + (index % 11));
    const totalAmount = amount(2400 + index * 760);
    const totalHt = roundAmount(totalAmount / (1 + vatRate / 100));
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:supplier-invoice:x${code}`),
      supplier_id: supplier?.id || template.supplier_id,
      invoice_number: `SUP-${config.country}-${CURRENT_YEAR}-${code}`,
      invoice_date: invoiceDate,
      due_date: addDays(invoiceDate, 15 + (index % 18)),
      total_amount: totalAmount,
      total_ht: totalHt,
      total_ttc: totalAmount,
      vat_amount: roundAmount(totalAmount - totalHt),
      payment_status: ['pending', 'paid', 'overdue', 'pending', 'paid', 'pending', 'overdue'][index % 7],
      payment_terms: index % 2 === 0 ? '30 jours' : '15 jours',
      supplier_name_extracted: supplier?.company_name || template.supplier_name_extracted,
      supplier_address_extracted: supplier?.address || template.supplier_address_extracted,
      supplier_vat_number: `${config.country}-SUPVAT-${code}`,
      notes: `${template.notes} ${index + 1}`,
      created_at: timestampFor(invoiceDate, 15),
      updated_at: timestampFor(invoiceDate, 15, 5),
      iban: supplier?.iban || template.iban,
      bic: supplier?.bic_swift || template.bic,
    };
  });

  let supplierInvoiceLineItemRows = [
    ['001', supplierInvoiceRows[0].id, 'Licence plateforme fournisseur', 3, amount(1400)],
    ['002', supplierInvoiceRows[0].id, 'Support fournisseur', 10, amount(200)],
    ['003', supplierInvoiceRows[1].id, 'Mission conformite et fiscalite', 1, amount(2400)],
  ].map(([code, invoiceId, description, quantity, unitPrice], index) => ({
    id: uuidFromSeed(`${userSeed}:supplier-invoice-line:${code}`),
    invoice_id: invoiceId,
    description,
    quantity,
    unit_price: unitPrice,
    total: roundAmount(quantity * unitPrice),
    sort_order: index,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 3 + index), 15),
  }));
  supplierInvoiceLineItemRows = [
    ...supplierInvoiceLineItemRows,
    ...supplierInvoiceRows.slice(2).map((row, index) => {
      const quantity = 1 + (index % 3);
      const total = roundAmount(Number(row.total_ht || 0));
      return {
        id: uuidFromSeed(`${userSeed}:supplier-invoice-line:x${String(index + 4).padStart(3, '0')}`),
        invoice_id: row.id,
        description: `Ligne fournisseur ${index + 1}`,
        quantity,
        unit_price: roundAmount(total / quantity),
        total,
        sort_order: 0,
        created_at: timestampFor(row.invoice_date, 15, 10),
      };
    }),
  ];

  let projectRows = [
    ['001', enhancedClientRows[0].id, `${config.label} Revenue Command Center`, 'Projet de structuration du pilotage', 160, amount(185)],
    ['002', enhancedClientRows[1].id, `${config.label} Cash Flow Rollout`, 'Projet de deploiement cash flow', 120, amount(165)],
  ].map(([code, clientId, name, description, budgetHours, hourlyRate], index) => ({
    id: uuidFromSeed(`${userSeed}:project:${code}`),
    user_id: userId,
    client_id: clientId,
    name,
    description,
    budget_hours: budgetHours,
    hourly_rate: hourlyRate,
    status: 'active',
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + index, 6), 9),
  }));
  projectRows = ensureMinimumRows(projectRows, minimumRecords, (template, index) => {
    const client = pickCyclic(enhancedClientRows, index);
    const code = String(index + 1).padStart(3, '0');
    const startDate = isoDate(CURRENT_YEAR, 1 + (index % 6), 6 + (index % 14));
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:project:x${code}`),
      client_id: client?.id || template.client_id,
      name: `${template.name} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      budget_hours: Number(template.budget_hours || 0) + index * 14,
      hourly_rate: roundAmount(Number(template.hourly_rate || 0) * (1 + index * 0.03)),
      status: ['active', 'active', 'planning', 'active', 'on_hold', 'completed', 'active'][index % 7],
      created_at: timestampFor(startDate, 9),
    };
  });

  const teamMemberRows = teamSeeds.map((member, index) => ({
    id: uuidFromSeed(`${userSeed}:team-member:${member.key}`),
    user_id: userId,
    company_id: resolveScopedCompanyId(index),
    name: member.name,
    email: member.email,
    role: member.role,
    joined_at: isoDate(CURRENT_YEAR, 1, 3 + index),
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 3 + index), 8),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 3 + index), 8, 5),
  }));

  let taskRows = [
    ['001', projectRows[0].id, enhancedInvoiceRows[0].id, quoteRows[0].id, purchaseOrderRows[0].id, serviceRows[0].id, teamMemberRows[0].name, 'Structurer le modele de pilotage', 'completed', 'high', 24, isoDate(CURRENT_YEAR, 1, 15)],
    ['002', projectRows[0].id, enhancedInvoiceRows[1].id, quoteRows[1].id, purchaseOrderRows[1].id, serviceRows[1].id, teamMemberRows[1].name, 'Connecter la source comptable', 'in_progress', 'high', 40, isoDate(CURRENT_YEAR, 3, 18)],
    ['003', projectRows[1].id, null, quoteRows[1].id, null, serviceRows[2].id, teamMemberRows[2].name, 'Former les equipes finance', 'pending', 'medium', 16, isoDate(CURRENT_YEAR, 3, 20)],
    ['004', projectRows[1].id, null, null, null, serviceRows[2].id, teamMemberRows[0].name, 'Valider gouvernance trimestrielle', 'on_hold', 'low', 10, isoDate(CURRENT_YEAR, 3, 28)],
  ].map(([code, projectId, invoiceId, quoteId, purchaseOrderId, serviceId, assignedTo, title, status, priority, estimatedHours, dueDate], index) => ({
    id: uuidFromSeed(`${userSeed}:task:${code}`),
    project_id: projectId,
    invoice_id: invoiceId,
    quote_id: quoteId,
    purchase_order_id: purchaseOrderId,
    service_id: serviceId,
    assigned_to: assignedTo,
    name: title,
    title,
    description: `${title} demo`,
    status,
    priority,
    color: ['#f97316', '#3b82f6', '#a855f7', '#64748b'][index],
    estimated_hours: estimatedHours,
    requires_quote: Boolean(quoteId),
    started_at: status === 'pending' || status === 'on_hold' ? null : timestampFor(isoDate(CURRENT_YEAR, 1 + index, 8), 9),
    completed_at: status === 'completed' ? timestampFor(isoDate(CURRENT_YEAR, 1, 15), 18) : null,
    due_date: dueDate,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + Math.min(index, 1), 7 + index), 12),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 10 + index), 12, 5),
  }));
  taskRows = ensureMinimumRows(taskRows, minimumRecords * 2, (template, index) => {
    const project = pickCyclic(projectRows, index);
    const service = pickCyclic(serviceRows, index);
    const invoice = pickCyclic(enhancedInvoiceRows, index);
    const quote = pickCyclic(quoteRows, index);
    const purchaseOrder = pickCyclic(purchaseOrderRows, index);
    const teamMember = pickCyclic(teamMemberRows, index);
    const code = String(index + 1).padStart(3, '0');
    const dueDate = isoDate(CURRENT_YEAR, 1 + (index % 6), 12 + (index % 12));
    const status = ['completed', 'in_progress', 'pending', 'on_hold', 'pending', 'completed', 'in_progress'][index % 7];
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:task:x${code}`),
      project_id: project?.id || template.project_id,
      invoice_id: status === 'pending' ? null : (invoice?.id || template.invoice_id),
      quote_id: quote?.id || template.quote_id,
      purchase_order_id: purchaseOrder?.id || template.purchase_order_id,
      service_id: service?.id || template.service_id,
      assigned_to: teamMember?.name || template.assigned_to,
      name: `${template.name} ${index + 1}`,
      title: `${template.title} ${index + 1}`,
      description: `${template.description} ${index + 1}`,
      status,
      priority: ['high', 'medium', 'low'][index % 3],
      color: ['#f97316', '#3b82f6', '#a855f7', '#64748b', '#10b981', '#14b8a6', '#eab308'][index % 7],
      estimated_hours: Number(template.estimated_hours || 0) + (index % 5) * 6,
      requires_quote: Boolean(quote?.id),
      started_at: status === 'pending' || status === 'on_hold' ? null : timestampFor(addDays(dueDate, -8), 9),
      completed_at: status === 'completed' ? timestampFor(addDays(dueDate, -1), 18) : null,
      due_date: dueDate,
      created_at: timestampFor(addDays(dueDate, -12), 12),
      updated_at: timestampFor(addDays(dueDate, -4), 12, 5),
    };
  });

  let subtaskRows = [
    ['001', taskRows[0].id, 'Cartographier les KPIs', 'completed'],
    ['002', taskRows[0].id, 'Valider la maquette du dashboard', 'completed'],
    ['003', taskRows[1].id, 'Relier ventes et paiements', 'completed'],
    ['004', taskRows[1].id, 'Relier achats et fournisseurs', 'pending'],
    ['005', taskRows[2].id, 'Preparer le support de formation', 'pending'],
  ].map(([code, taskId, title, status], index) => ({
    id: uuidFromSeed(`${userSeed}:subtask:${code}`),
    task_id: taskId,
    title,
    status,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 1 + index), 12),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 5 + index), 12, 5),
  }));
  subtaskRows = [
    ...subtaskRows,
    ...taskRows.slice(3).map((task, index) => ({
      id: uuidFromSeed(`${userSeed}:subtask:x${String(index + 6).padStart(3, '0')}`),
      task_id: task.id,
      title: `Sous-tache ${index + 1} - ${task.title}`,
      status: ['pending', 'completed'][index % 2],
      created_at: timestampFor(task.created_at.slice(0, 10), 12, 15),
      updated_at: timestampFor(task.created_at.slice(0, 10), 12, 20),
    })),
  ];

  let timesheetRows = [
    [enhancedClientRows[0].id, projectRows[0].id, taskRows[0].id, serviceRows[0].id, enhancedInvoiceRows[0].id, isoDate(CURRENT_YEAR, 1, 9), 240, amount(185), 'Workshop KPI et objectifs', true, 'approved'],
    [enhancedClientRows[0].id, projectRows[0].id, taskRows[0].id, serviceRows[0].id, enhancedInvoiceRows[0].id, isoDate(CURRENT_YEAR, 1, 13), 240, amount(185), 'Validation dashboard management', true, 'approved'],
    [enhancedClientRows[1].id, projectRows[0].id, taskRows[1].id, serviceRows[1].id, enhancedInvoiceRows[1].id, isoDate(CURRENT_YEAR, 2, 12), 480, amount(180), 'Configuration flux ventes', true, 'approved'],
    [enhancedClientRows[1].id, projectRows[0].id, taskRows[1].id, serviceRows[1].id, null, isoDate(CURRENT_YEAR, 2, 19), 300, amount(180), 'Configuration achats et banque', true, 'approved'],
    [enhancedClientRows[1].id, projectRows[1].id, taskRows[2].id, serviceRows[2].id, null, isoDate(CURRENT_YEAR, 2, 25), 240, amount(120), 'Preparation formation utilisateur', false, 'pending'],
  ].map(([clientId, projectId, taskId, serviceId, invoiceId, date, durationMinutes, hourlyRate, description, billable, status], index) => ({
    id: uuidFromSeed(`${userSeed}:timesheet:${String(index + 1).padStart(3, '0')}`),
    user_id: userId,
    client_id: clientId,
    project_id: projectId,
    task_id: taskId,
    service_id: serviceId,
    invoice_id: invoiceId,
    date,
    start_time: ['09:00', '14:00', '09:30', '10:00', '08:30'][index],
    end_time: ['13:00', '18:00', '17:30', '15:00', '12:30'][index],
    duration_minutes: durationMinutes,
    hourly_rate: hourlyRate,
    description,
    notes: null,
    billable,
    billed_at: billable && invoiceId ? timestampFor(addDays(date, 1), 18) : null,
    status,
    created_at: timestampFor(date, 18),
  }));
  timesheetRows = ensureMinimumRows(timesheetRows, minimumRecords * 2, (template, index) => {
    const task = pickCyclic(taskRows, index);
    const project = projectRows.find((row) => row.id === task?.project_id) || pickCyclic(projectRows, index);
    const client = enhancedClientRows.find((row) => row.id === project?.client_id) || pickCyclic(enhancedClientRows, index);
    const service = pickCyclic(serviceRows, index);
    const invoice = pickCyclic(enhancedInvoiceRows, index);
    const date = isoDate(CURRENT_YEAR, 1 + (index % 6), 7 + (index % 20));
    const durationMinutes = 120 + (index % 5) * 60;
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:timesheet:x${String(index + 1).padStart(3, '0')}`),
      client_id: client?.id || template.client_id,
      project_id: project?.id || template.project_id,
      task_id: task?.id || template.task_id,
      service_id: service?.id || template.service_id,
      invoice_id: index % 3 === 0 ? null : (invoice?.id || template.invoice_id),
      date,
      start_time: ['08:30', '09:00', '10:00', '13:00', '14:00'][index % 5],
      end_time: ['10:30', '12:00', '15:00', '17:00', '18:00'][index % 5],
      duration_minutes: durationMinutes,
      hourly_rate: roundAmount(Number(template.hourly_rate || 0) * (1 + index * 0.02)),
      description: `${template.description} ${index + 1}`,
      billable: index % 4 !== 0,
      billed_at: index % 3 === 0 ? null : timestampFor(addDays(date, 1), 18),
      status: ['approved', 'approved', 'pending', 'submitted'][index % 4],
      created_at: timestampFor(date, 18),
    };
  });

  const creditNoteHt = roundAmount(enhancedInvoiceRows[1].total_ht * 0.12);
  let creditNoteRows = [
    {
      id: uuidFromSeed(`${userSeed}:credit-note:001`),
      user_id: userId,
      client_id: enhancedInvoiceRows[1].client_id,
      invoice_id: enhancedInvoiceRows[1].id,
      company_id: invoiceCompanyById.get(enhancedInvoiceRows[1].id) || defaultCompanyId,
      credit_note_number: `CN-${config.country}-${CURRENT_YEAR}-001`,
      date: isoDate(CURRENT_YEAR, 2, 28),
      reason: 'Commercial adjustment demo',
      notes: 'Avoir emis pour ajustement de service',
      status: 'issued',
      tax_rate: vatRate,
      tax_amount: roundAmount(creditNoteHt * (vatRate / 100)),
      total_ht: creditNoteHt,
      total_ttc: roundAmount(creditNoteHt * (1 + vatRate / 100)),
      created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 28), 12),
      updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 28), 12, 5),
    },
  ];
  creditNoteRows = ensureMinimumRows(creditNoteRows, minimumRecords, (template, index) => {
    const invoice = pickCyclic(enhancedInvoiceRows.slice(1), index) || enhancedInvoiceRows[0];
    const totalHt = roundAmount(Number(invoice?.total_ht || template.total_ht || 0) * (0.08 + (index % 3) * 0.03));
    const date = addDays(invoice?.date || template.date, 10 + (index % 12));
    const code = String(index + 1).padStart(3, '0');
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:credit-note:x${code}`),
      client_id: invoice?.client_id || template.client_id,
      invoice_id: invoice?.id || template.invoice_id,
      company_id: invoiceCompanyById.get(invoice?.id) || template.company_id || defaultCompanyId,
      credit_note_number: `CN-${config.country}-${CURRENT_YEAR}-${code}`,
      date,
      reason: `Commercial adjustment demo ${index + 1}`,
      notes: `${template.notes} ${index + 1}`,
      status: ['issued', 'draft', 'applied', 'issued', 'cancelled', 'issued', 'draft'][index % 7],
      tax_amount: roundAmount(totalHt * (vatRate / 100)),
      total_ht: totalHt,
      total_ttc: roundAmount(totalHt * (1 + vatRate / 100)),
      created_at: timestampFor(date, 12),
      updated_at: timestampFor(date, 12, 5),
    };
  });
  let creditNoteItemRows = [
    {
      id: uuidFromSeed(`${userSeed}:credit-note-item:001`),
      credit_note_id: creditNoteRows[0].id,
      description: 'Ajustement remise service implementation',
      quantity: 1,
      unit_price: creditNoteHt,
      amount: creditNoteHt,
      created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 28), 12, 10),
    },
  ];
  creditNoteItemRows = creditNoteRows.map((creditNote, index) => ({
    id: uuidFromSeed(`${userSeed}:credit-note-item:x${String(index + 1).padStart(3, '0')}`),
    credit_note_id: creditNote.id,
    description: `Ajustement facture ${index + 1}`,
    quantity: 1,
    unit_price: creditNote.total_ht,
    amount: creditNote.total_ht,
    created_at: timestampFor(creditNote.date, 12, 10),
  }));

  let deliveryNoteRows = [
    ['001', enhancedInvoiceRows[0], enhancedClientRows[0], 'delivered', 'Demo Logistics', `${config.country}-TRK-001`, isoDate(CURRENT_YEAR, 1, 11)],
    ['002', enhancedInvoiceRows[1], enhancedClientRows[1], 'pending', 'Demo Parcel', `${config.country}-TRK-002`, isoDate(CURRENT_YEAR, 2, 18)],
  ].map(([code, invoiceRow, clientRow, status, carrier, trackingNumber, date], index) => ({
    id: uuidFromSeed(`${userSeed}:delivery-note:${code}`),
    user_id: userId,
    client_id: clientRow.id,
    invoice_id: invoiceRow.id,
    company_id: invoiceCompanyById.get(invoiceRow.id) || clientRow.company_id || defaultCompanyId,
    delivery_note_number: `DN-${config.country}-${CURRENT_YEAR}-${code}`,
    date,
    delivery_address: clientRow.address,
    carrier,
    tracking_number: trackingNumber,
    status,
    notes: 'Delivery demo',
    created_at: timestampFor(date, 14),
    updated_at: timestampFor(date, 14, 5 + index),
  }));
  deliveryNoteRows = ensureMinimumRows(deliveryNoteRows, minimumRecords, (template, index) => {
    const invoice = pickCyclic(enhancedInvoiceRows, index);
    const client = enhancedClientRows.find((row) => row.id === invoice?.client_id) || pickCyclic(enhancedClientRows, index);
    const code = String(index + 1).padStart(3, '0');
    const date = addDays(invoice?.date || template.date, 2 + (index % 6));
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:delivery-note:x${code}`),
      client_id: client?.id || template.client_id,
      invoice_id: invoice?.id || template.invoice_id,
      company_id: invoiceCompanyById.get(invoice?.id) || client?.company_id || template.company_id || defaultCompanyId,
      delivery_note_number: `DN-${config.country}-${CURRENT_YEAR}-${code}`,
      date,
      delivery_address: client?.address || template.delivery_address,
      carrier: ['Demo Logistics', 'Demo Parcel', 'Fast Route', 'Urban Cargo'][index % 4],
      tracking_number: `${config.country}-TRK-${code}`,
      status: ['pending', 'shipped', 'delivered', 'cancelled', 'pending', 'shipped', 'delivered'][index % 7],
      notes: `${template.notes} ${index + 1}`,
      created_at: timestampFor(date, 14),
      updated_at: timestampFor(date, 14, 5),
    };
  });
  let deliveryNoteItemRows = [
    ['001', deliveryNoteRows[0].id, 'Pack pilotage executif', 2, 'licence'],
    ['002', deliveryNoteRows[1].id, 'Scanner embarque', 2, 'piece'],
  ].map(([code, deliveryNoteId, description, quantity, unit]) => ({
    id: uuidFromSeed(`${userSeed}:delivery-note-item:${code}`),
    delivery_note_id: deliveryNoteId,
    description,
    quantity,
    unit,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 1 + Number(code)), 14),
  }));
  deliveryNoteItemRows = deliveryNoteRows.map((deliveryNote, index) => ({
    id: uuidFromSeed(`${userSeed}:delivery-note-item:x${String(index + 1).padStart(3, '0')}`),
    delivery_note_id: deliveryNote.id,
    description: `Colis ${index + 1}`,
    quantity: 1 + (index % 3),
    unit: index % 2 === 0 ? 'piece' : 'licence',
    created_at: timestampFor(deliveryNote.date, 14, 10),
  }));

  let receivableRows = [
    ['001', 'Partenaire demo invest', 'finance@demo-invest.test', '+000 000 000 001', 'loan', amount(2500), amount(1000), isoDate(CURRENT_YEAR, 1, 20), isoDate(CURRENT_YEAR, 3, 10), 'partial'],
    ['002', 'Reseau distribution interne', 'ops@distribution-interne.test', '+000 000 000 002', 'advance', amount(1800), 0, isoDate(CURRENT_YEAR, 1, 28), isoDate(CURRENT_YEAR, 2, 20), 'overdue'],
  ].map(([code, debtorName, debtorEmail, debtorPhone, category, valueAmount, amountPaid, dateLent, dueDate, status], index) => ({
    id: uuidFromSeed(`${userSeed}:receivable:${code}`),
    user_id: userId,
    company_id: resolveScopedCompanyId(index),
    debtor_name: debtorName,
    debtor_email: debtorEmail,
    debtor_phone: debtorPhone,
    category,
    currency,
    amount: valueAmount,
    amount_paid: amountPaid,
    date_lent: dateLent,
    due_date: dueDate,
    status,
    description: 'Receivable demo',
    notes: 'Demo debt tracking',
    created_at: timestampFor(dateLent, 11),
    updated_at: timestampFor(addDays(dateLent, 20 + index), 11),
  }));
  receivableRows = ensureMinimumRows(receivableRows, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(3, '0');
    const dateLent = isoDate(CURRENT_YEAR, 1 + (index % 6), 8 + (index % 13));
    const amountValue = amount(1600 + index * 480);
    const amountPaid = index % 3 === 0 ? 0 : roundAmount(amountValue * 0.4);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:receivable:x${code}`),
      company_id: resolveScopedCompanyId(index, template.company_id || defaultCompanyId),
      debtor_name: `${template.debtor_name} ${index + 1}`,
      debtor_email: `receivable.${config.country.toLowerCase()}.${code}@cashpilot.demo`,
      debtor_phone: template.debtor_phone,
      category: ['loan', 'advance', 'other'][index % 3],
      amount: amountValue,
      amount_paid: amountPaid,
      date_lent: dateLent,
      due_date: addDays(dateLent, 20 + (index % 15)),
      status: ['pending', 'partial', 'overdue', 'paid', 'partial', 'pending', 'overdue'][index % 7],
      description: `Receivable demo ${index + 1}`,
      notes: `${template.notes} ${index + 1}`,
      created_at: timestampFor(dateLent, 11),
      updated_at: timestampFor(addDays(dateLent, 20 + index), 11),
    };
  });

  let payableRows = [
    ['001', 'Investisseur demo bridge', 'bridge@invest.demo', '+000 000 000 101', 'bridge_loan', amount(4200), amount(1400), isoDate(CURRENT_YEAR, 1, 4), isoDate(CURRENT_YEAR, 4, 4), 'partial'],
    ['002', 'Cabinet juridique demo', 'cabinet@juridique.demo', '+000 000 000 102', 'service', amount(1300), 0, isoDate(CURRENT_YEAR, 2, 6), isoDate(CURRENT_YEAR, 2, 28), 'overdue'],
  ].map(([code, creditorName, creditorEmail, creditorPhone, category, valueAmount, amountPaid, dateBorrowed, dueDate, status], index) => ({
    id: uuidFromSeed(`${userSeed}:payable:${code}`),
    user_id: userId,
    company_id: resolveScopedCompanyId(index + 1),
    creditor_name: creditorName,
    creditor_email: creditorEmail,
    creditor_phone: creditorPhone,
    category,
    currency,
    amount: valueAmount,
    amount_paid: amountPaid,
    date_borrowed: dateBorrowed,
    due_date: dueDate,
    status,
    description: 'Payable demo',
    notes: 'Demo payable tracking',
    created_at: timestampFor(dateBorrowed, 10),
    updated_at: timestampFor(addDays(dateBorrowed, 25 + index), 10),
  }));
  payableRows = ensureMinimumRows(payableRows, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(3, '0');
    const dateBorrowed = isoDate(CURRENT_YEAR, 1 + (index % 6), 6 + (index % 13));
    const amountValue = amount(1800 + index * 510);
    const amountPaid = index % 3 === 0 ? 0 : roundAmount(amountValue * 0.35);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:payable:x${code}`),
      company_id: resolveScopedCompanyId(index + 1, template.company_id || defaultCompanyId),
      creditor_name: `${template.creditor_name} ${index + 1}`,
      creditor_email: `payable.${config.country.toLowerCase()}.${code}@cashpilot.demo`,
      category: ['service', 'bridge_loan', 'supplier', 'tax'][index % 4],
      amount: amountValue,
      amount_paid: amountPaid,
      date_borrowed: dateBorrowed,
      due_date: addDays(dateBorrowed, 18 + (index % 16)),
      status: ['pending', 'partial', 'overdue', 'paid', 'pending', 'partial', 'overdue'][index % 7],
      description: `Payable demo ${index + 1}`,
      notes: `${template.notes} ${index + 1}`,
      created_at: timestampFor(dateBorrowed, 10),
      updated_at: timestampFor(addDays(dateBorrowed, 25 + index), 10),
    };
  });

  const receivableCompanyById = new Map(
    receivableRows.map((row) => [row.id, row.company_id || defaultCompanyId])
  );
  const payableCompanyById = new Map(
    payableRows.map((row) => [row.id, row.company_id || defaultCompanyId])
  );

  let debtPaymentRows = [
    ['001', 'receivable', receivableRows[0].id, amount(1000), isoDate(CURRENT_YEAR, 2, 12)],
    ['002', 'payable', payableRows[0].id, amount(1400), isoDate(CURRENT_YEAR, 2, 12)],
  ].map(([code, recordType, recordId, valueAmount, paymentDate], index) => ({
    id: uuidFromSeed(`${userSeed}:debt-payment:${code}`),
    user_id: userId,
    company_id: (
      recordType === 'receivable'
        ? receivableCompanyById.get(recordId)
        : payableCompanyById.get(recordId)
    ) || resolveScopedCompanyId(index),
    record_type: recordType,
    record_id: recordId,
    amount: valueAmount,
    payment_method: 'bank_transfer',
    notes: 'Demo debt payment',
    payment_date: paymentDate,
    created_at: timestampFor(paymentDate, 11, 10 + index * 10),
  }));
  debtPaymentRows = [
    ...debtPaymentRows,
    ...receivableRows.slice(1, 4).map((row, index) => ({
      id: uuidFromSeed(`${userSeed}:debt-payment:xr${String(index + 3).padStart(3, '0')}`),
      user_id: userId,
      company_id: row.company_id || defaultCompanyId,
      record_type: 'receivable',
      record_id: row.id,
      amount: roundAmount(Number(row.amount_paid || 0) || Number(row.amount || 0) * 0.25),
      payment_method: 'bank_transfer',
      notes: 'Demo receivable settlement',
      payment_date: addDays(row.date_lent, 12 + index),
      created_at: timestampFor(addDays(row.date_lent, 12 + index), 11, 15),
    })),
    ...payableRows.slice(1, 4).map((row, index) => ({
      id: uuidFromSeed(`${userSeed}:debt-payment:xp${String(index + 6).padStart(3, '0')}`),
      user_id: userId,
      company_id: row.company_id || defaultCompanyId,
      record_type: 'payable',
      record_id: row.id,
      amount: roundAmount(Number(row.amount_paid || 0) || Number(row.amount || 0) * 0.2),
      payment_method: 'bank_transfer',
      notes: 'Demo payable settlement',
      payment_date: addDays(row.date_borrowed, 14 + index),
      created_at: timestampFor(addDays(row.date_borrowed, 14 + index), 11, 25),
    })),
  ];

  let productStockHistoryRows = [
    [productRows[1].id, 8, 4, -4, 'sale', 'Stock utilise pour demo scanner'],
    [productRows[2].id, 6, 0, -6, 'adjustment', 'Consommation kit operations'],
    [productRows[0].id, 12, 22, 10, 'purchase', 'Reassort demo marketing'],
  ].map(([productId, previousQuantity, newQuantity, changeQuantity, reason, notes], index) => ({
    id: uuidFromSeed(`${userSeed}:stock-history:${String(index + 1).padStart(3, '0')}`),
    user_product_id: productId,
    product_id: productId,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    change_quantity: changeQuantity,
    reason,
    notes,
    order_id: index === 2 ? supplierOrderRows[0].id : null,
    created_by: userId,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 15 + index), 10),
  }));
  productStockHistoryRows = ensureMinimumRows(productStockHistoryRows, minimumRecords, (template, index) => {
    const product = pickCyclic(productRows, index);
    const previousQuantity = Math.max(0, Number(product?.stock_quantity || 0) + (index % 2 === 0 ? -4 : 6));
    const changeQuantity = index % 3 === 0 ? -3 - index : 4 + index;
    const newQuantity = Math.max(0, previousQuantity + changeQuantity);
    const createdDate = isoDate(CURRENT_YEAR, 2 + (index % 4), 10 + (index % 14));
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:stock-history:x${String(index + 1).padStart(3, '0')}`),
      user_product_id: product?.id || template.user_product_id,
      product_id: product?.id || template.product_id,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      change_quantity: changeQuantity,
      reason: ['purchase', 'sale', 'adjustment', 'transfer'][index % 4],
      notes: `Mouvement stock demo ${index + 1}`,
      order_id: index % 2 === 0 ? pickCyclic(supplierOrderRows, index)?.id || null : null,
      created_at: timestampFor(createdDate, 10),
    };
  });

  let stockAlertRows = [
    [productRows[1].id, 'low_stock'],
    [productRows[2].id, 'out_of_stock'],
  ].map(([productId, alertType], index) => ({
    id: uuidFromSeed(`${userSeed}:stock-alert:${String(index + 1).padStart(3, '0')}`),
    product_id: productId,
    user_product_id: productId,
    alert_type: alertType,
    is_active: true,
    resolved_at: null,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 2, 15 + index), 10, 5),
  }));
  stockAlertRows = ensureMinimumRows(stockAlertRows, minimumRecords, (template, index) => {
    const product = pickCyclic(productRows, index);
    const createdDate = isoDate(CURRENT_YEAR, 2 + (index % 4), 12 + (index % 10));
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:stock-alert:x${String(index + 1).padStart(3, '0')}`),
      product_id: product?.id || template.product_id,
      user_product_id: product?.id || template.user_product_id,
      alert_type: ['low_stock', 'out_of_stock'][index % 2],
      is_active: index % 4 !== 0,
      resolved_at: index % 4 === 0 ? timestampFor(addDays(createdDate, 2), 9) : null,
      created_at: timestampFor(createdDate, 10, 5),
    };
  });

  const notificationPreferencesRow = {
    id: uuidFromSeed(`${userSeed}:notification-preferences`),
    user_id: userId,
    email_comments: true,
    email_completed_tasks: true,
    email_new_tasks: true,
    email_overdue_tasks: true,
    email_project_updates: true,
    email_reminders: true,
    push_comments: false,
    push_enabled: true,
    push_new_tasks: true,
    frequency: 'daily',
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 4), 8),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 1, 4), 8, 5),
  };

  let notificationRows = [
    ['stock_alert', 'Scanner stock low', `Le produit ${productRows[1].product_name} est sous le seuil minimum.`, false, timestampFor(isoDate(CURRENT_YEAR, 2, 15), 10, 6), null],
    ['peppol', 'Peppol delivery confirmed', `${enhancedInvoiceRows[0].invoice_number} a ete remise via Peppol.`, true, timestampFor(isoDate(CURRENT_YEAR, 1, 12), 8, 50), timestampFor(isoDate(CURRENT_YEAR, 1, 12), 9)],
    ['task', 'Task due soon', `La tache ${taskRows[2].title} doit etre preparee cette semaine.`, false, timestampFor(isoDate(CURRENT_YEAR, 2, 26), 8), null],
    ['bank', 'Consent expires soon', `Le consentement bancaire ${locale.bank.secondaryInstitutionName} a expire et doit etre renouvelle.`, false, timestampFor(isoDate(CURRENT_YEAR, 2, 27), 8), null],
    ['billing', 'Demo account fully unlocked', 'Compte de demonstration avec acces illimite aux services.', true, timestampFor(isoDate(CURRENT_YEAR, 1, 3), 8), timestampFor(isoDate(CURRENT_YEAR, 1, 3), 9)],
  ].map(([type, title, message, isRead, createdAt, readAt], index) => ({
    id: uuidFromSeed(`${userSeed}:notification:${String(index + 1).padStart(3, '0')}`),
    user_id: userId,
    type,
    title,
    message,
    is_read: isRead,
    read_at: readAt,
    created_at: createdAt,
    updated_at: readAt || createdAt,
  }));
  notificationRows = ensureMinimumRows(notificationRows, minimumRecords, (template, index) => {
    const createdAt = timestampFor(isoDate(CURRENT_YEAR, 2 + (index % 3), 8 + (index % 18)), 8, 10);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:notification:x${String(index + 1).padStart(3, '0')}`),
      title: `${template.title} ${index + 1}`,
      message: `${template.message} ${index + 1}`,
      is_read: index % 3 === 0,
      read_at: index % 3 === 0 ? timestampFor(isoDate(CURRENT_YEAR, 2 + (index % 3), 9 + (index % 18)), 9) : null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  let webhookRows = [
    ['001', `https://hooks.demo.cashpilot.cloud/${config.country.toLowerCase()}/primary`, ['invoice.created', 'invoice.paid', 'payment.received'], 0, timestampFor(isoDate(CURRENT_YEAR, 2, 25), 14)],
    ['002', `https://hooks.demo.cashpilot.cloud/${config.country.toLowerCase()}/analytics`, ['client.created', 'expense.created'], 1, timestampFor(isoDate(CURRENT_YEAR, 2, 20), 11)],
  ].map(([code, url, events, failureCount, lastTriggeredAt], index) => ({
    id: uuidFromSeed(`${userSeed}:webhook:${code}`),
    user_id: userId,
    url,
    events,
    secret: uuidFromSeed(`${userSeed}:webhook-secret:${code}`).replace(/-/g, ''),
    is_active: true,
    failure_count: failureCount,
    last_triggered_at: lastTriggeredAt,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 18 + index * 4), 8),
    updated_at: lastTriggeredAt,
  }));
  webhookRows = ensureMinimumRows(webhookRows, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(3, '0');
    const triggeredAt = timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 4), 18 + (index % 8)), 10);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:webhook:x${code}`),
      url: `https://hooks.demo.cashpilot.cloud/${config.country.toLowerCase()}/endpoint-${code}`,
      events: [
        ['invoice.created', 'invoice.paid', 'payment.received'],
        ['quote.signed', 'project.created', 'task.completed'],
        ['expense.created', 'supplier.invoice.received'],
      ][index % 3],
      secret: uuidFromSeed(`${userSeed}:webhook-secret:x${code}`).replace(/-/g, ''),
      failure_count: index % 3 === 0 ? 1 : 0,
      last_triggered_at: triggeredAt,
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 4), 10 + (index % 12)), 8),
      updated_at: triggeredAt,
    };
  });

  let webhookDeliveryRows = [
    ['001', webhookRows[0].id, 'invoice.created', { invoice_id: enhancedInvoiceRows[0].id }, true, 1, 200, '{"ok":true}', timestampFor(isoDate(CURRENT_YEAR, 1, 10), 9)],
    ['002', webhookRows[0].id, 'payment.received', { payment_id: paymentRows[0]?.id || null }, true, 1, 202, '{"accepted":true}', timestampFor(isoDate(CURRENT_YEAR, 1, 24), 16)],
    ['003', webhookRows[1].id, 'expense.created', { source: 'demo-seed', label: config.label }, false, 2, 500, 'temporary upstream error', timestampFor(isoDate(CURRENT_YEAR, 2, 20), 11)],
  ].map(([code, webhookEndpointId, event, payload, delivered, attempts, statusCode, responseBody, createdAt]) => ({
    id: uuidFromSeed(`${userSeed}:webhook-delivery:${code}`),
    webhook_endpoint_id: webhookEndpointId,
    event,
    payload,
    delivered,
    attempts,
    status_code: statusCode,
    response_body: responseBody,
    created_at: createdAt,
  }));
  webhookDeliveryRows = [
    ...webhookDeliveryRows,
    ...webhookRows.slice(2).map((webhook, index) => ({
      id: uuidFromSeed(`${userSeed}:webhook-delivery:x${String(index + 4).padStart(3, '0')}`),
      webhook_endpoint_id: webhook.id,
      event: pickCyclic(webhook.events || ['invoice.created'], 0) || 'invoice.created',
      payload: { demo: true, index: index + 1, country: config.country },
      delivered: index % 3 !== 0,
      attempts: index % 3 === 0 ? 2 : 1,
      status_code: index % 3 === 0 ? 500 : 200,
      response_body: index % 3 === 0 ? 'temporary upstream error' : '{"ok":true}',
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 5), 10 + (index % 12)), 11),
    })),
  ];

  let bankConnectionRows = [
    ['001', locale.bank.primaryInstitutionId, locale.bank.primaryInstitutionName, `${config.country.toLowerCase()}-req-001`, `${config.country.toLowerCase()}-agr-001`, `${config.country.toLowerCase()}-acct-001`, locale.bank.accountName, locale.bank.iban, locale.bank.balance, 'active', timestampFor(isoDate(CURRENT_YEAR, 3, 1), 7), timestampFor(isoDate(CURRENT_YEAR, 5, 30), 0), null],
    ['002', locale.bank.secondaryInstitutionId, locale.bank.secondaryInstitutionName, `${config.country.toLowerCase()}-req-002`, `${config.country.toLowerCase()}-agr-002`, `${config.country.toLowerCase()}-acct-002`, 'Compte secondaire', null, null, 'expired', timestampFor(isoDate(CURRENT_YEAR, 2, 14), 7), timestampFor(isoDate(CURRENT_YEAR, 2, 15), 0), 'Consent expired'],
  ].map(([code, institutionId, institutionName, requisitionId, agreementId, accountId, accountName, accountIban, accountBalance, status, lastSyncAt, expiresAt, syncError], index) => ({
    id: uuidFromSeed(`${userSeed}:bank-connection:${code}`),
    user_id: userId,
    company_id: resolveScopedCompanyId(index),
    institution_id: institutionId,
    institution_name: institutionName,
    institution_logo: null,
    requisition_id: requisitionId,
    agreement_id: agreementId,
    account_id: accountId,
    account_name: accountName,
    account_iban: accountIban,
    account_currency: currency,
    account_balance: accountBalance,
    status,
    last_sync_at: lastSyncAt,
    expires_at: expiresAt,
    sync_error: syncError,
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 12 + index * 8), 8),
    updated_at: lastSyncAt,
  }));
  bankConnectionRows = ensureMinimumRows(bankConnectionRows, minimumRecords, (template, index) => {
    const code = String(index + 1).padStart(3, '0');
    const lastSyncAt = timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 5), 12 + (index % 10)), 7);
    const activeStatuses = ['active', 'expired', 'error', 'active', 'pending', 'active', 'revoked'];
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:bank-connection:x${code}`),
      company_id: resolveScopedCompanyId(index, template.company_id || defaultCompanyId),
      institution_id: `${config.country.toLowerCase()}-inst-${code}`,
      institution_name: `${locale.bank.primaryInstitutionName} ${index + 1}`,
      requisition_id: `${config.country.toLowerCase()}-req-${code}`,
      agreement_id: `${config.country.toLowerCase()}-agr-${code}`,
      account_id: `${config.country.toLowerCase()}-acct-${code}`,
      account_name: `${locale.bank.accountName} ${index + 1}`,
      account_iban: template.account_iban || (currency === 'EUR' ? `${locale.bank.iban || ''}${code}`.trim() : null),
      account_balance: Number(locale.bank.balance || 0) + index * amount(120),
      status: activeStatuses[index % activeStatuses.length],
      last_sync_at: lastSyncAt,
      expires_at: timestampFor(addDays(lastSyncAt.slice(0, 10), 60 - index * 3), 0),
      sync_error: activeStatuses[index % activeStatuses.length] === 'error' ? 'Sync failed' : null,
      created_at: timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 4), 12 + (index % 8)), 8),
      updated_at: lastSyncAt,
    };
  });
  const bankConnectionCompanyById = new Map(
    bankConnectionRows.map((row) => [row.id, row.company_id || defaultCompanyId])
  );

  let bankSyncHistoryRows = [
    ['001', bankConnectionRows[0].id, 'full', 'success', 4, timestampFor(isoDate(CURRENT_YEAR, 1, 12), 8), timestampFor(isoDate(CURRENT_YEAR, 1, 12), 8, 3), null],
    ['002', bankConnectionRows[0].id, 'transactions', 'success', 2, timestampFor(isoDate(CURRENT_YEAR, 3, 1), 7), timestampFor(isoDate(CURRENT_YEAR, 3, 1), 7, 2), null],
    ['003', bankConnectionRows[1].id, 'transactions', 'error', 0, timestampFor(isoDate(CURRENT_YEAR, 2, 15), 7), timestampFor(isoDate(CURRENT_YEAR, 2, 15), 7, 1), 'Consent expired'],
  ].map(([code, bankConnectionId, syncType, status, transactionsSynced, startedAt, completedAt, errorMessage]) => ({
    id: uuidFromSeed(`${userSeed}:bank-sync:${code}`),
    user_id: userId,
    company_id: bankConnectionCompanyById.get(bankConnectionId) || defaultCompanyId,
    bank_connection_id: bankConnectionId,
    sync_type: syncType,
    status,
    transactions_synced: transactionsSynced,
    started_at: startedAt,
    completed_at: completedAt,
    error_message: errorMessage,
  }));
  bankSyncHistoryRows = [
    ...bankSyncHistoryRows,
    ...bankConnectionRows.slice(2).map((connection, index) => {
      const startedAt = timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 5), 10 + (index % 14)), 7);
      const status = connection.status === 'error' || connection.status === 'expired' ? 'error' : 'success';
      return {
        id: uuidFromSeed(`${userSeed}:bank-sync:x${String(index + 4).padStart(3, '0')}`),
        user_id: userId,
        company_id: connection.company_id || defaultCompanyId,
        bank_connection_id: connection.id,
        sync_type: index % 2 === 0 ? 'transactions' : 'balance',
        status,
        transactions_synced: status === 'success' ? 2 + (index % 5) : 0,
        started_at: startedAt,
        completed_at: timestampFor(startedAt.slice(0, 10), 7, 2),
        error_message: status === 'success' ? null : 'Consent expired',
      };
    }),
  ];

  let bankTransactionRows = [
    ['001', bankConnectionRows[0].id, enhancedInvoiceRows[0].id, paymentRows[0]?.amount || 0, paymentRows[0]?.payment_date || isoDate(CURRENT_YEAR, 1, 24), enhancedClientRows[0].company_name, 'matched', 0.99, paymentRows[0]?.payment_date || isoDate(CURRENT_YEAR, 1, 24), enhancedInvoiceRows[0].invoice_number],
    ['002', bankConnectionRows[0].id, enhancedInvoiceRows[1].id, paymentRows[1]?.amount || 0, paymentRows[1]?.payment_date || isoDate(CURRENT_YEAR, 2, 26), enhancedClientRows[1].company_name, 'matched', 0.97, paymentRows[1]?.payment_date || isoDate(CURRENT_YEAR, 2, 26), enhancedInvoiceRows[1].invoice_number],
    ['003', bankConnectionRows[0].id, null, -supplierOrderRows[1].total_amount, isoDate(CURRENT_YEAR, 2, 25), supplierRows[2].company_name, 'unreconciled', null, null, supplierInvoiceRows[1].invoice_number],
    ['004', bankConnectionRows[0].id, null, -amount(2100), isoDate(CURRENT_YEAR, 2, 18), 'Operations payroll', 'unreconciled', null, null, 'Payroll Feb'],
    ['005', bankConnectionRows[0].id, null, debtPaymentRows[0].amount, debtPaymentRows[0].payment_date, receivableRows[0].debtor_name, 'unreconciled', null, null, 'Debt repayment demo'],
  ].map(([code, bankConnectionId, invoiceId, valueAmount, date, counterparty, reconciliationStatus, matchConfidence, matchedAtDate, remittanceInfo]) => ({
    id: uuidFromSeed(`${userSeed}:bank-transaction:${code}`),
    user_id: userId,
    company_id:
      bankConnectionCompanyById.get(bankConnectionId) ||
      invoiceCompanyById.get(invoiceId) ||
      defaultCompanyId,
    bank_connection_id: bankConnectionId,
    invoice_id: invoiceId,
    external_id: `${config.country.toLowerCase()}-txn-${code}`,
    amount: valueAmount,
    currency,
    date,
    booking_date: date,
    value_date: date,
    description: counterparty,
    debtor_name: valueAmount >= 0 ? counterparty : config.company.company_name,
    creditor_name: valueAmount >= 0 ? config.company.company_name : counterparty,
    remittance_info: remittanceInfo,
    reference: `BANK-${config.country}-${code}`,
    reconciliation_status: reconciliationStatus,
    match_confidence: matchConfidence,
    matched_at: matchedAtDate ? timestampFor(matchedAtDate, 16) : null,
    raw_data: { demo: true },
    created_at: timestampFor(date, 16),
    updated_at: timestampFor(date, 16),
  }));
  bankTransactionRows = ensureMinimumRows(bankTransactionRows, minimumRecords * 2, (template, index) => {
    const bankConnection = pickCyclic(bankConnectionRows, index);
    const invoice = pickCyclic(enhancedInvoiceRows, index);
    const counterparty = index % 2 === 0
      ? (enhancedClientRows.find((row) => row.id === invoice?.client_id)?.company_name || template.description)
      : (pickCyclic(supplierRows, index)?.company_name || template.description);
    const date = isoDate(CURRENT_YEAR, 1 + (index % 6), 10 + (index % 16));
    const amountValue = index % 2 === 0 ? amount(950 + index * 160) : -amount(680 + index * 140);
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:bank-transaction:x${String(index + 1).padStart(3, '0')}`),
      company_id:
        bankConnection?.company_id ||
        invoiceCompanyById.get(invoice?.id) ||
        template.company_id ||
        defaultCompanyId,
      bank_connection_id: bankConnection?.id || template.bank_connection_id,
      invoice_id: index % 2 === 0 ? (invoice?.id || null) : null,
      external_id: `${config.country.toLowerCase()}-txn-x${String(index + 1).padStart(3, '0')}`,
      amount: amountValue,
      date,
      booking_date: date,
      value_date: date,
      description: counterparty,
      debtor_name: amountValue >= 0 ? counterparty : config.company.company_name,
      creditor_name: amountValue >= 0 ? config.company.company_name : counterparty,
      remittance_info: index % 2 === 0 ? (invoice?.invoice_number || 'Invoice settlement') : `Charge ${index + 1}`,
      reference: `BANK-${config.country}-X${String(index + 1).padStart(3, '0')}`,
      reconciliation_status: amountValue >= 0 ? 'matched' : ['unreconciled', 'ignored', 'matched'][index % 3],
      match_confidence: amountValue >= 0 ? 0.94 : null,
      matched_at: amountValue >= 0 ? timestampFor(date, 16) : null,
      created_at: timestampFor(date, 16),
      updated_at: timestampFor(date, 16),
    };
  });

  let peppolLogRows = [
    ['001', enhancedInvoiceRows[0].id, 'outbound', 'delivered', enhancedClientRows[0].peppol_endpoint_id, enhancedInvoiceRows[0].peppol_document_id, timestampFor(isoDate(CURRENT_YEAR, 1, 10), 14)],
    ['002', enhancedInvoiceRows[1].id, 'outbound', 'pending', enhancedClientRows[1].peppol_endpoint_id, enhancedInvoiceRows[1].peppol_document_id, timestampFor(isoDate(CURRENT_YEAR, 2, 15), 14)],
    ['003', enhancedInvoiceRows[0].id, 'inbound', 'accepted', locale.companyPeppol, `INBOUND-${config.country}-${CURRENT_YEAR}-001`, timestampFor(isoDate(CURRENT_YEAR, 2, 5), 10)],
  ].map(([code, invoiceId, direction, status, receiverEndpoint, apDocumentId, createdAt], index) => ({
    id: uuidFromSeed(`${userSeed}:peppol-log:${code}`),
    user_id: userId,
    invoice_id: invoiceId,
    company_id: invoiceCompanyById.get(invoiceId) || resolveScopedCompanyId(index),
    direction,
    status,
    ap_provider: 'scrada',
    ap_document_id: apDocumentId,
    sender_endpoint: direction === 'outbound' ? locale.companyPeppol : enhancedClientRows[0].peppol_endpoint_id,
    receiver_endpoint: receiverEndpoint,
    error_message: null,
    metadata: { country: config.country, demo: true },
    created_at: createdAt,
    updated_at: createdAt,
  }));
  peppolLogRows = ensureMinimumRows(peppolLogRows, minimumRecords, (template, index) => {
    const invoice = pickCyclic(enhancedInvoiceRows, index);
    const client = enhancedClientRows.find((row) => row.id === invoice?.client_id) || pickCyclic(enhancedClientRows, index);
    const date = timestampFor(isoDate(CURRENT_YEAR, 1 + (index % 6), 10 + (index % 12)), 14);
    const direction = ['outbound', 'outbound', 'inbound'][index % 3];
    const status = direction === 'inbound'
      ? ['accepted', 'accepted', 'delivered'][index % 3]
      : ['delivered', 'pending', 'accepted', 'error'][index % 4];
    return {
      ...template,
      id: uuidFromSeed(`${userSeed}:peppol-log:x${String(index + 1).padStart(3, '0')}`),
      invoice_id: direction === 'outbound' ? (invoice?.id || template.invoice_id) : template.invoice_id,
      company_id: invoiceCompanyById.get(invoice?.id) || client?.company_id || template.company_id || defaultCompanyId,
      direction,
      status,
      ap_document_id: `${direction === 'inbound' ? 'INBOUND' : 'OUTBOUND'}-${config.country}-${CURRENT_YEAR}-${String(index + 1).padStart(3, '0')}`,
      sender_endpoint: direction === 'outbound' ? locale.companyPeppol : (client?.peppol_endpoint_id || template.sender_endpoint),
      receiver_endpoint: direction === 'outbound' ? (client?.peppol_endpoint_id || template.receiver_endpoint) : locale.companyPeppol,
      error_message: status === 'error' ? 'Temporary AP timeout' : null,
      metadata: { country: config.country, demo: true, index: index + 1 },
      created_at: date,
      updated_at: date,
    };
  });

  const billingPlan = ['free', 'starter', 'pro', 'enterprise'].includes(locale.demoPlan.slug)
    ? locale.demoPlan.slug
    : 'pro';

  const billingInfoRow = {
    id: uuidFromSeed(`${userSeed}:billing-info`),
    user_id: userId,
    company_name: config.company.company_name,
    address: config.company.address,
    city: config.company.city,
    postal_code: config.company.postal_code,
    country: config.company.country,
    vat_number: config.company.tax_id,
    siret: config.company.registration_number,
    plan: billingPlan,
    plan_price: locale.demoPlan.price,
    plan_interval: 'month',
    next_billing_date: isoDate(CURRENT_YEAR, 3, 20),
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 3), 8),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 27), 8),
  };

  const invoiceSettingsRow = {
    id: uuidFromSeed(`${userSeed}:invoice-settings`),
    user_id: userId,
    template_id: 'premium',
    show_logo: true,
    show_bank_details: true,
    show_payment_terms: true,
    color_theme: 'orange',
    font_family: 'Manrope',
    footer_text: 'CashPilot demo document',
    custom_labels: { note: 'Demo', locale: config.country },
    created_at: timestampFor(isoDate(CURRENT_YEAR, 1, 3), 8),
    updated_at: timestampFor(isoDate(CURRENT_YEAR, 2, 27), 8),
  };

  return {
    companyPatch,
    clientRows: enhancedClientRows,
    invoiceRows: enhancedInvoiceRows,
    paymentRows,
    paymentTermRows,
    productCategoryRows,
    serviceCategoryRows,
    supplierRows,
    supplierProductCategoryRows,
    supplierProductRows,
    supplierServiceRows,
    productRows,
    serviceRows,
    invoiceItemRows,
    paymentAllocationRows,
    quoteRows,
    purchaseOrderRows,
    recurringInvoiceRows,
    recurringInvoiceLineItemRows,
    paymentReminderRuleRows,
    paymentReminderLogRows,
    supplierOrderRows,
    supplierOrderItemRows,
    supplierInvoiceRows,
    supplierInvoiceLineItemRows,
    projectRows,
    taskRows,
    subtaskRows,
    timesheetRows,
    creditNoteRows,
    creditNoteItemRows,
    deliveryNoteRows,
    deliveryNoteItemRows,
    receivableRows,
    payableRows,
    debtPaymentRows,
    productStockHistoryRows,
    stockAlertRows,
    teamMemberRows,
    notificationPreferencesRow,
    notificationRows,
    webhookRows,
    webhookDeliveryRows,
    bankConnectionRows,
    bankSyncHistoryRows,
    bankTransactionRows,
    peppolLogRows,
    billingInfoRow,
    invoiceSettingsRow,
  };
}
