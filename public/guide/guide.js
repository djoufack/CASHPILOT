(function () {
  // === Scroll Reveal ===
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  // === Sidebar Elements ===
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const progressBar = document.getElementById('progressBar');
  const sidebarSections = document.querySelectorAll('.sidebar-section');
  const sidebarSubLinks = document.querySelectorAll('.sidebar-sub-link');
  const sidebarHeaders = document.querySelectorAll('.sidebar-section-header');
  const contentSections = document.querySelectorAll('.section[id]');

  // === Sidebar Toggle (Desktop/Tablet) ===
  function isMobile() {
    return window.innerWidth <= 768;
  }

  sidebarToggle.addEventListener('click', function () {
    if (isMobile()) {
      closeMobileMenu();
    } else {
      sidebar.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed');
      try {
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
      } catch (e) {}
    }
  });

  // Restore collapsed state from localStorage
  try {
    if (localStorage.getItem('sidebar-collapsed') === 'true' && !isMobile()) {
      sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
    }
  } catch (e) {}

  // === Mobile Menu ===
  function openMobileMenu() {
    sidebar.classList.add('mobile-open');
    sidebarOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileMenu() {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', openMobileMenu);
  sidebarOverlay.addEventListener('click', closeMobileMenu);

  // Close mobile menu on link click
  sidebarSubLinks.forEach((link) => {
    link.addEventListener('click', function () {
      if (isMobile()) closeMobileMenu();
    });
  });
  document.querySelector('.sidebar-home').addEventListener('click', function () {
    if (isMobile()) closeMobileMenu();
  });

  // === Section Expand/Collapse ===
  sidebarSections.forEach((section) => {
    const header = section.querySelector('.sidebar-section-header');
    header.addEventListener('click', function (_e) {
      // If sidebar is collapsed on desktop, expand first
      if (sidebar.classList.contains('collapsed') && !isMobile()) {
        sidebar.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
        try {
          localStorage.setItem('sidebar-collapsed', 'false');
        } catch (e) {}
      }
      // Toggle open/close
      const wasOpen = section.classList.contains('open');
      // Close all others
      sidebarSections.forEach((s) => s.classList.remove('open'));
      if (!wasOpen) section.classList.add('open');
    });
  });

  // === Progress Bar ===
  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = progress + '%';
  }

  // === Active Section Tracking ===
  function updateActiveSection() {
    const scrollTop = window.scrollY + 100;
    let currentSection = '';

    contentSections.forEach((section) => {
      if (section.offsetTop <= scrollTop) currentSection = section.id;
    });

    // Update section headers
    sidebarHeaders.forEach((header) => {
      const section = header.closest('.sidebar-section');
      const sectionId = section ? section.getAttribute('data-section') : '';
      header.classList.toggle('active', sectionId === currentSection);
      // Auto-open the active section
      if (sectionId === currentSection && !section.classList.contains('open')) {
        sidebarSections.forEach((s) => {
          if (s !== section) s.classList.remove('open');
        });
        section.classList.add('open');
      }
    });

    // Update sub-links: find the closest element with an id before current scroll position
    const allIdElements = document.querySelectorAll('[id]');
    let currentSubId = '';
    allIdElements.forEach((el) => {
      if (el.offsetTop <= scrollTop + 120) {
        const id = el.id;
        // Only consider sub-link targets
        const matchingLink = document.querySelector('.sidebar-sub-link[href="#' + id + '"]');
        if (matchingLink) currentSubId = id;
      }
    });
    sidebarSubLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + currentSubId);
    });
  }

  // === Scroll Handler ===
  function handleScroll() {
    updateProgress();
    updateActiveSection();
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  updateProgress();
  updateActiveSection();

  // === Responsive Resize ===
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    const w = window.innerWidth;
    if (lastWidth > 768 && w <= 768) {
      // Entered mobile
      sidebar.classList.remove('collapsed');
      sidebar.classList.remove('mobile-open');
      sidebarOverlay.classList.remove('visible');
      document.body.classList.remove('sidebar-collapsed');
      document.body.style.overflow = '';
    } else if (lastWidth <= 768 && w > 768) {
      // Left mobile
      closeMobileMenu();
      try {
        if (localStorage.getItem('sidebar-collapsed') === 'true') {
          sidebar.classList.add('collapsed');
          document.body.classList.add('sidebar-collapsed');
        }
      } catch (e) {}
    }
    lastWidth = w;
  });

  // === Inject Contact Strips in all content sections ===
  document.querySelectorAll('.section[id]:not(#toc)').forEach((section) => {
    const container = section.querySelector('.container');
    if (!container) return;
    const strip = document.createElement('div');
    strip.className = 'section-contact-strip';
    strip.innerHTML =
      '<div class="strip-left">' +
      '<span class="strip-name">Eric Georges Djoufack</span>' +
      '<span class="strip-sep">&bull;</span>' +
      '<span class="strip-role">AI Project Manager</span>' +
      '</div>' +
      '<div class="strip-right">' +
      '<a href="https://www.dmgmanagement.tech" target="_blank" rel="noopener">dmgmanagement.tech</a>' +
      '<a href="tel:+32472544765" class="strip-phone">(+32) 472.544.765</a>' +
      '</div>';
    container.appendChild(strip);
  });

  // === INTERNATIONALIZATION (i18n) ===
  var i18n = {
    en: {
      // Page
      page_title: 'CashPilot - User Guide',
      // Sidebar
      home: 'Home',
      sidebar_guide: 'Guide v4',
      // Sidebar sections
      nav_01: 'Getting Started',
      nav_02: 'Dashboard',
      nav_03: 'Commercial',
      nav_04: 'Invoicing',
      nav_05: 'Finance',
      nav_06: 'Accounting',
      nav_07: 'Projects & Time',
      nav_08: 'Stock & Products',
      nav_09: 'Artificial Intelligence',
      nav_10: 'Banking & Integrations',
      nav_11: 'Settings & Admin',
      nav_12: 'Shortcuts & Tips',
      nav_13: 'Strategic Steering',
      // Sidebar sub-links
      sub_overview: 'Overview',
      sub_creer_compte: 'Create an account',
      sub_se_connecter: 'Sign in',
      sub_configurer: 'Configure your company',
      sub_kpis: 'Real-time KPIs',
      sub_graphiques: 'Interactive charts',
      sub_actions_rapides: 'Quick actions',
      sub_export_dashboard: 'PDF & HTML Export',
      sub_clients: 'Clients',
      sub_fournisseurs: 'Suppliers',
      sub_devis: 'Quote \u2192 Invoice',
      sub_factures_rec: 'Recurring invoices',
      sub_avoirs: 'Credit notes',
      sub_bons_livraison: 'Delivery notes',
      sub_modes_affichage: '4 display modes',
      sub_creer_facture: 'Create an invoice',
      sub_depenses: 'Expenses',
      sub_creances_dettes: 'Receivables & Payables',
      sub_tresorerie: 'Cash Flow',
      sub_plan_comptable: 'Chart of Accounts',
      sub_bilan_resultat: 'Balance Sheet & P&L',
      sub_declaration_tva: 'VAT Return',
      sub_estimation_impot: 'Tax Estimation',
      sub_rapprochement: 'Bank Reconciliation',
      sub_compta_auto: 'Automatic Accounting',
      sub_gestion_projets: 'Project Management',
      sub_feuilles_temps: 'Timesheets',
      sub_facturation_directe: 'Direct invoicing',
      sub_inventaire: 'Full inventory',
      sub_alertes_stock: 'Stock alerts',
      sub_scanner: 'Barcode scanner',
      sub_assistant_ia: 'AI Assistant',
      sub_serveur_mcp: 'MCP Server',
      sub_automatisation: 'Automation',
      sub_chat_ia: 'Contextual AI Chat',
      sub_ocr: 'OCR & Extraction',
      sub_anomalies: 'Anomaly Detection',
      sub_previsions: 'Forecasts',
      sub_api_rest: 'REST API',
      sub_connexions_bancaires: 'Bank Connections',
      sub_rapprochement_intelligent: 'Smart Reconciliation',
      sub_api_mcp: 'REST API & MCP',
      sub_profil: 'Profile & Company',
      sub_equipe: 'Team & Roles',
      sub_securite: 'Security',
      sub_sauvegardes: 'Backups',
      sub_multilingue: 'Multilingual',
      sub_rgpd: 'GDPR & Export',
      sub_modes_vues: '4 Display Modes',
      sub_formats_export: 'Export Formats',
      sub_credits: 'Credits System',
      sub_onboarding: 'Guided Onboarding',
      sub_quick_invoice: 'Quick Invoicing',
      sub_pilotage_comptable: 'Accounting Analysis',
      sub_pilotage_financier: 'Financial Analysis',
      sub_pilotage_fiscal: 'Taxation & Valuation',
      sub_pilotage_simulateur: 'Simulator',
      sub_pilotage_audit: 'AI Audit',
      // Hero
      hero_badge: 'Official User Guide',
      hero_sub: 'Complete User Guide',
      hero_desc:
        'Everything you need to know to manage your financial activity. Invoicing, accounting, projects, cash flow and artificial intelligence \u2014 master every feature of your platform.',
      hero_cta: 'Access CashPilot',
      hero_read: 'Read the guide',
      hero_powered: 'Powered by',
      hero_explore: 'EXPLORE',
      // TOC
      toc_badge: 'Contents',
      toc_title_1: 'Table of ',
      toc_title_2: 'Contents',
      toc_subtitle: '13 chapters to master CashPilot from A to Z.',
      toc_01: 'Getting Started',
      toc_01_desc: 'Login, registration, MFA and navigation',
      toc_02: 'Dashboard',
      toc_02_desc: 'KPIs, charts and quick actions',
      toc_03: 'Commercial Management',
      toc_03_desc: 'Clients, suppliers and contacts',
      toc_04: 'Invoicing Cycle',
      toc_04_desc: 'Quotes, invoices, credit notes and delivery notes',
      toc_05: 'Financial Management',
      toc_05_desc: 'Expenses, receivables, payables, cash flow',
      toc_06: 'Accounting',
      toc_06_desc: 'Chart of accounts, balance sheet, P&L, VAT',
      toc_07: 'Projects & Time',
      toc_07_desc: 'Projects, timesheets, tasks',
      toc_08: 'Stock & Products',
      toc_08_desc: 'Inventory, alerts, barcodes',
      toc_09: 'Artificial Intelligence',
      toc_09_desc: 'AI Chat, OCR, anomalies, forecasts',
      toc_10: 'Banking & Integrations',
      toc_10_desc: 'Open Banking, reconciliation, API',
      toc_11: 'Settings & Admin',
      toc_11_desc: 'Profile, company, team, GDPR',
      toc_12: 'Shortcuts & Tips',
      toc_12_desc: 'Shortcuts, multi-views, exports',
      toc_13: 'Strategic Steering',
      toc_13_desc: 'Ratios, benchmarks, taxation, valuation',
      // Section badges
      badge_01: 'Chapter 01',
      badge_02: 'Chapter 02',
      badge_03: 'Chapter 03',
      badge_04: 'Chapter 04',
      badge_05: 'Chapter 05',
      badge_06: 'Chapter 06',
      badge_07: 'Chapter 07',
      badge_08: 'Chapter 08',
      badge_09: 'Chapter 09',
      badge_10: 'Chapter 10',
      badge_11: 'Chapter 11',
      badge_12: 'Chapter 12',
      badge_13: 'Chapter 13',
      // Section 1
      s1_title_1: 'Getting ',
      s1_title_2: 'Started',
      s1_subtitle: 'Sign up, log in and discover the interface in minutes.',
      s1_step1_title: 'Create an account',
      s1_step1_desc:
        'Go to the registration page. Enter your email, choose a password and validate your account via the link received by email.',
      s1_step2_title: 'Sign in',
      s1_step2_desc:
        'Enter your credentials on the login page. Enable two-factor authentication (MFA) in the security settings to protect your account.',
      s1_step3_title: 'Configure your company',
      s1_step3_desc:
        'Go to <strong style="color:#fff">Settings \u2192 Company</strong> to enter the name, address, VAT number and logo of your company.',
      s1_step4_title: 'Explore navigation',
      s1_step4_desc:
        'The sidebar gives you access to all sections: Dashboard, Clients, Invoices, Accounting, Projects and more. It is collapsible to save space.',
      s1_tip:
        '<strong>Enhanced security:</strong> Enable two-factor authentication (MFA) from your first login via <strong>Settings \u2192 Security</strong>. CashPilot supports TOTP codes and biometric authentication.',
      // Section 2
      s2_title_1: '',
      s2_title_2: 'Dashboard',
      s2_subtitle: 'Your central hub to monitor your business activity in real time.',
      s2_kpis_title: 'Real-time KPIs',
      s2_kpis_desc: 'Total revenue, profit margin and occupancy rate calculated automatically from your data.',
      s2_graphiques_title: 'Interactive charts',
      s2_graphiques_desc: 'Visualize the monthly evolution of your revenue and the breakdown by client.',
      s2_actions_title: 'Quick actions',
      s2_actions_desc: 'Create an invoice, a timesheet or a new client in a single click from the dashboard.',
      s2_export_title: 'PDF & HTML Export',
      s2_export_desc: 'Download a complete report of your dashboard in PDF or HTML page.',
      // Section 3
      s3_title_1: 'Commercial ',
      s3_title_2: 'Management',
      s3_subtitle: 'Manage your client and supplier portfolio with an integrated CRM.',
      s3_clients_title: 'Clients',
      s3_clients_desc:
        'Centralize all your client information: company name, contact, email, address, VAT number and preferred currency. Each client file gathers the history of invoices, payments and projects.',
      s3_fournisseurs_title: 'Suppliers',
      s3_fournisseurs_desc:
        'Create a complete supplier directory with contacts, products/services, and purchase history. View your suppliers on an <strong style="color:#fff;">interactive map</strong> and generate performance reports.',
      s3_tip:
        "<strong>Multi-currency:</strong> CashPilot supports EUR, USD and GBP. The client's preferred currency is automatically applied when creating invoices.",
      // Section 4
      s4_title_1: 'Invoicing ',
      s4_title_2: 'Cycle',
      s4_subtitle: 'From quote to credit note, manage the complete invoicing cycle with multiple views.',
      s4_devis_title: 'Quote \u2192 Invoice',
      s4_devis_desc:
        'Create a quote, have it validated by the client, then convert it to an invoice in one click. All data is transferred automatically.',
      s4_recurrentes_title: 'Recurring invoices',
      s4_recurrentes_desc:
        'Define templates with a frequency (weekly, monthly, quarterly). Invoices are generated and sent automatically.',
      s4_avoirs_title: 'Credit notes',
      s4_avoirs_desc:
        'Generate credit notes linked to an existing invoice. Partial or full refund with automatic VAT adjustment.',
      s4_bons_title: 'Delivery notes',
      s4_bons_desc: 'Generate delivery notes linked to your orders. Item tracking, delivery date and signature.',
      s4_modes_title: '4 display modes',
      s4_modes_desc:
        'Switch between <strong style="color:#fff;">List</strong>, <strong style="color:#fff;">Calendar</strong>, <strong style="color:#fff;">Agenda</strong> and <strong style="color:#fff;">Kanban</strong> views to organize your invoices as you wish.',
      s4_email_title: 'Email sending',
      s4_email_desc:
        'Send your invoices directly by email from CashPilot. The PDF is automatically attached to the message.',
      s4_creer_title: 'Create an invoice step by step',
      s4_step1_title: 'Select the client',
      s4_step1_desc: 'Choose an existing client or create a new one directly.',
      s4_step2_title: 'Add lines',
      s4_step2_desc: 'Import timesheets or add manual lines with description, quantity and unit price.',
      s4_step3_title: 'Configure VAT',
      s4_step3_desc:
        'The VAT rate is applied automatically. The amounts excl. VAT, VAT and incl. VAT are calculated in real time.',
      s4_step4_title: 'Generate and send',
      s4_step4_desc: 'Click "Generate invoice", then export to PDF or send by email.',
      // Section 5
      s5_title_1: 'Financial ',
      s5_title_2: 'Management',
      s5_subtitle: 'Track your expenses, manage your receivables and payables, and manage your cash flow.',
      s5_depenses_title: 'Expenses',
      s5_depenses_desc:
        'Record each expense with category, amount, date and receipt. Bulk import from a CSV file or use <strong style="color:#fff">voice input</strong> to record your expenses on the go.',
      s5_creances_title: 'Receivables & Payables',
      s5_creances_desc:
        'The <strong style="color:#fff">Receivables/Payables Manager</strong> centralizes everything owed to you and everything you owe. View in Calendar, Agenda or Kanban mode, and record payments by method (cash, transfer, check, mobile money).',
      s5_tresorerie_title: 'Cash Flow',
      s5_tresorerie_desc:
        'View your cash history over 6 months and <strong style="color:#fff">3-month forecasts</strong>. The bar chart displays revenue vs expenses with a trend line.',
      s5_tip:
        '<strong>Voice input:</strong> On mobile, press the microphone to dictate your expenses. CashPilot automatically extracts the amount, category and description.',
      // Section 6
      s6_title_1: 'Integrated ',
      s6_title_2: 'Accounting',
      s6_subtitle:
        'A complete accounting module with 10 tabs: chart of accounts, balance sheet, income statement, VAT, tax estimation and bank reconciliation.',
      s6_plan_title: 'Chart of Accounts',
      s6_plan_desc:
        'Import your chart of accounts from a CSV. Search and filter by code or account type. Presets for France, Belgium and OHADA.',
      s6_bilan_title: 'Balance Sheet & P&L',
      s6_bilan_desc:
        'Automatic generation of the balance sheet (Assets/Liabilities/Equity) and income statement (Revenue/Expenses). PDF export included.',
      s6_tva_title: 'VAT Return',
      s6_tva_desc:
        'Automatic calculation of collected VAT, deductible VAT and VAT payable. Monthly history and PDF export for your declaration.',
      s6_impot_title: 'Tax Estimation',
      s6_impot_desc:
        'Calculate your estimated tax by customizable brackets. Quarterly provisions and effective rate. Country presets.',
      s6_rapprochement_title: 'Bank Reconciliation',
      s6_rapprochement_desc:
        'Import your statements (PDF, Excel, CSV). Automatic reconciliation with confidence scoring. Manual matching interface.',
      s6_auto_title: 'Automatic Accounting',
      s6_auto_desc:
        'Every invoice, expense and payment automatically generates the corresponding accounting entries in real time.',
      // Section 7
      s7_title_1: 'Projects & ',
      s7_title_2: 'Time',
      s7_subtitle: 'Track your projects, record time spent and manage your tasks with multiple views.',
      s7_projets_title: 'Project Management',
      s7_projets_desc:
        'Create projects with client, hour budget, team and timeline. Track progress with real-time statistics: hours consumed, remaining budget and completion rate.',
      s7_feuilles_title: 'Timesheets',
      s7_feuilles_desc:
        'Record your hours with start/end time, automatic duration calculation, and assignment to client and project. 4 display modes: <strong style="color:#fff">Calendar, List, Kanban and Agenda</strong>.',
      s7_facturation_title: 'Direct invoicing',
      s7_facturation_desc:
        'Select timesheets and generate an invoice in one click. Approved hours are automatically converted into invoice lines.',
      // Section 8
      s8_title_1: 'Stock & ',
      s8_title_2: 'Products',
      s8_subtitle: 'Manage your inventory, receive low stock alerts and scan barcodes.',
      s8_inventaire_title: 'Full inventory',
      s8_inventaire_desc:
        'Reference your products with SKU, category, quantity and alert threshold. Stock movements tracked automatically.',
      s8_alertes_title: 'Stock alerts',
      s8_alertes_desc:
        'Automatic notifications when a product falls below the alert threshold. Visual color coding: green (OK), orange (low), red (out of stock).',
      s8_scanner_title: 'Barcode scanner',
      s8_scanner_desc: 'Use your device camera to scan barcodes and update stock instantly.',
      // Section 9
      s9_title_1: 'Artificial ',
      s9_title_2: 'Intelligence',
      s9_subtitle: '6 integrated AI features and MCP compatibility with all major language models.',
      s9_assistant_title: 'Integrated AI Assistant',
      s9_assistant_desc:
        'A floating AI chat widget, always accessible, that answers your financial questions in context. It analyzes your data and provides personalized recommendations.',
      s9_mcp_title: 'MCP Server \u2014 169 Tools',
      s9_mcp_desc:
        'CashPilot integrates an <strong style="color:#fff">MCP server (Model Context Protocol)</strong> with 169 tools, allowing any compatible LLM to manage your finances by voice or text:',
      s9_mcp_any: 'Any MCP-compatible LLM',
      s9_mcp_example:
        'Simply ask: <em style="color:var(--amber);">"Create an invoice for Acme Corp of \u20AC3200"</em> from Claude, ChatGPT or Gemini \u2014 the MCP server executes the command directly in CashPilot.',
      s9_auto_title: 'CashPilot as an Automation Tool',
      s9_auto_desc:
        'Beyond its own automations, <strong style="color:#fff">CashPilot can be used as a tool in your external automation chains</strong> (Rube.app, Gumloop, Zapier, Make, n8n, etc.). Thanks to its REST API and MCP server, you can integrate invoicing, accounting and financial management into any automated workflow.',
      s9_chat_title: 'Contextual AI Chat',
      s9_chat_desc:
        'Ask questions in natural language about your finances. The AI accesses your real-time data for accurate answers.',
      s9_ocr_title: 'OCR & Extraction',
      s9_ocr_desc:
        'Upload a received invoice or receipt: the AI automatically extracts the amount, date, supplier and lines.',
      s9_anomalies_title: 'Anomaly Detection',
      s9_anomalies_desc:
        'The AI monitors your transactions and alerts you to unusual expenses, budget overruns or suspicious variations.',
      s9_previsions_title: 'Forecasts & Scenarios',
      s9_previsions_desc:
        'Create financial scenarios with custom assumptions. Compare results side by side and identify the break-even point.',
      s9_outils_title: '29 MCP Tools',
      s9_outils_desc:
        'Invoice creation, client search, accounting export, financial summary \u2014 26 tools usable from any MCP-compatible LLM.',
      s9_api_title: 'Complete REST API',
      s9_api_desc:
        'A documented REST API (OpenAPI 3.1) to integrate CashPilot into your Rube.app, Gumloop, Zapier, Make, n8n automations or custom scripts.',
      s9_tip:
        '<strong>Ultimate automation:</strong> Connect CashPilot to <strong>Rube.app</strong> or any automation platform. Example: receive a supplier invoice email \u2192 AI extraction \u2192 automatic creation in CashPilot \u2192 Slack notification. Your financial management becomes a building block in your automated pipeline.',
      // Section 10
      s10_title_1: 'Banking & ',
      s10_title_2: 'Integrations',
      s10_subtitle:
        'Connect your bank accounts, reconcile your transactions and integrate CashPilot into your ecosystem.',
      s10_connexions_title: 'Bank Connections',
      s10_connexions_desc:
        'Connect your bank accounts to automatically synchronize your transactions. Multi-bank support.',
      s10_rapprochement_title: 'Smart Reconciliation',
      s10_rapprochement_desc:
        'The automatic matching algorithm reconciles your statements with your invoices and expenses with a confidence score.',
      s10_api_title: 'REST API & MCP',
      s10_api_desc: 'Integrate CashPilot into your ecosystem via the REST API (OpenAPI 3.1) or MCP protocol for LLMs.',
      // Section 11
      s11_title_1: 'Settings & ',
      s11_title_2: 'Administration',
      s11_subtitle: 'Customize CashPilot, manage your team and secure your data.',
      s11_profil_title: 'Profile & Company',
      s11_profil_desc:
        'Name, logo, address, VAT, fiscal year. Customize your invoices with 5 templates (Classic, Modern, Professional, Minimal, Bold).',
      s11_equipe_title: 'Team & Roles',
      s11_equipe_desc:
        'Invite collaborators and assign roles with granular permissions. Control access to each section.',
      s11_securite_title: 'Security',
      s11_securite_desc:
        'MFA authentication (TOTP), session management, login history, biometric authentication and API keys.',
      s11_sauvegardes_title: 'Backups',
      s11_sauvegardes_desc:
        'Local JSON backup, cloud backup (multi-providers), automatic scheduling (daily, weekly, monthly).',
      s11_multilingue_title: 'Multilingual',
      s11_multilingue_desc: 'Interface available in French, English and Dutch. Instant language switch.',
      s11_rgpd_title: 'GDPR & Export',
      s11_rgpd_desc: 'Export all your data for GDPR compliance. Delete your account and data at any time.',
      // Section 12
      s12_title_1: 'Shortcuts & ',
      s12_title_2: 'Tips',
      s12_subtitle: 'Become a CashPilot power user with these tips and shortcuts.',
      s12_modes_title: '4 Display Modes',
      s12_modes_desc:
        'Invoices, timesheets and receivables have 4 views: <strong style="color:#fff">List</strong> (table), <strong style="color:#fff">Calendar</strong> (month), <strong style="color:#fff">Agenda</strong> (priority) and <strong style="color:#fff">Kanban</strong> (drag & drop).',
      s12_export_title: 'Export Formats',
      s12_export_desc:
        '<strong style="color:#fff">PDF</strong> for printing, <strong style="color:#fff">HTML</strong> for web, <strong style="color:#fff">CSV</strong> for spreadsheets, <strong style="color:#fff">Excel</strong> for advanced analysis. All documents are exportable.',
      s12_credits_title: 'Credits System',
      s12_credits_desc:
        'PDF exports and AI features consume credits. Monitor your balance in the navigation bar. Free credits are offered each month.',
      s12_onboarding_title: 'Guided Onboarding',
      s12_onboarding_desc:
        'On first login, an interactive tour guides you through the key features. Replay it at any time from the settings.',
      s12_quick_title: 'Quick Invoicing',
      s12_quick_desc:
        'The <strong style="color:#fff">Quick Invoice</strong> mode allows you to create an invoice in less than 30 seconds with a minimalist form.',
      s12_auto_title: 'CashPilot = Automation Tool',
      s12_auto_desc:
        'Thanks to the MCP server and REST API, CashPilot is not just software \u2014 it\'s a <strong style="color:#fff">reusable building block</strong> in your automation pipelines (Rube.app, Gumloop, Zapier, Make, n8n).',
      s12_tip:
        '<strong>Collapsible sidebar:</strong> Click the arrow in the sidebar to collapse it to icon mode. Hover over an icon to see the tooltip with the section name.',
      // Section 13
      s13_title_1: 'Strategic ',
      s13_title_2: 'Steering',
      s13_subtitle: 'A unified steering center with 6 tabs to pilot your company with precision.',
      s13_overview_title: 'Overview',
      s13_overview_desc:
        '5 key KPIs (Revenue, EBITDA, Net Income, Free Cash Flow, Valuation), trend charts, and automatic financial alerts with color-coded severity.',
      s13_comptable_title: 'Accounting Analysis',
      s13_comptable_desc:
        'Structure ratios (financial independence, gearing, coverage), activity ratios (DSO, DPO, CCC, WCR/Revenue) with traffic-light rating.',
      s13_financier_title: 'Financial Analysis',
      s13_financier_desc:
        'Margins (gross, EBITDA, operating, net), profitability (ROE, ROA, ROCE), capital structure breakdown and multi-period trends.',
      s13_fiscal_title: 'Taxation & Valuation',
      s13_fiscal_desc:
        'Multi-zone corporate tax (France 25%/15% SME, Belgium 25%/20%, OHADA 30%+IMF), tax credits, EBITDA multiples + simplified DCF valuation, WACC sensitivity.',
      s13_simulateur_title: 'Simulator',
      s13_simulateur_desc:
        'What-if scenarios with side-by-side comparison and direct link to the ScenarioBuilder for advanced modeling.',
      s13_audit_title: 'AI Audit',
      s13_audit_desc:
        'Accounting health score, categorized audit checks (completeness, coherence, compliance), and AI-generated recommendations.',
      s13_tip:
        '<strong>Quick access:</strong> The Steering module is accessible from the sidebar via the target icon. Each tab is designed to work independently or as part of the full analysis.',
      // CTA
      cta_badge: 'Online platform',
      cta_headline_1: 'Ready to transform your',
      cta_headline_2: 'financial management',
      cta_subtext:
        'Join the businesses that manage their invoicing, accounting, cash flow and projects from a single platform powered by artificial intelligence. <strong style="color:#fff;">Try CashPilot now.</strong>',
      cta_btn_primary: 'Discover CashPilot',
      cta_btn_secondary: 'Contact the team',
      cta_stat_features: 'Features',
      cta_stat_mcp: 'MCP / AI Tools',
      cta_stat_modules: 'Modules',
      cta_stat_api: 'REST + OpenAPI 3.1',
      // Footer
      footer_text_1: 'User Guide v4.0 \u2022 February 2026 \u2022 \u00A9 CashPilot. All rights reserved.',
      footer_text_2: 'Financial Management Platform',
    },
    nl: {
      page_title: 'CashPilot - Gebruikershandleiding',
      home: 'Startpagina',
      sidebar_guide: 'Gids v4',
      nav_01: 'Aan de slag',
      nav_02: 'Dashboard',
      nav_03: 'Commercieel',
      nav_04: 'Facturatie',
      nav_05: 'Financi\u00ebn',
      nav_06: 'Boekhouding',
      nav_07: 'Projecten & Tijd',
      nav_08: 'Voorraad & Producten',
      nav_09: 'Kunstmatige Intelligentie',
      nav_10: 'Bank & Integraties',
      nav_11: 'Instellingen & Beheer',
      nav_12: 'Sneltoetsen & Tips',
      nav_13: 'Strategisch Sturen',
      sub_overview: 'Overzicht',
      sub_creer_compte: 'Account aanmaken',
      sub_se_connecter: 'Inloggen',
      sub_configurer: 'Bedrijf configureren',
      sub_kpis: "Real-time KPI's",
      sub_graphiques: 'Interactieve grafieken',
      sub_actions_rapides: 'Snelle acties',
      sub_export_dashboard: 'PDF & HTML Export',
      sub_clients: 'Klanten',
      sub_fournisseurs: 'Leveranciers',
      sub_devis: 'Offerte \u2192 Factuur',
      sub_factures_rec: 'Terugkerende facturen',
      sub_avoirs: "Creditnota's",
      sub_bons_livraison: 'Leveringsbonnen',
      sub_modes_affichage: '4 weergavemodi',
      sub_creer_facture: 'Factuur aanmaken',
      sub_depenses: 'Uitgaven',
      sub_creances_dettes: 'Vorderingen & Schulden',
      sub_tresorerie: 'Kasstroom',
      sub_plan_comptable: 'Rekeningschema',
      sub_bilan_resultat: 'Balans & Resultaat',
      sub_declaration_tva: 'BTW-aangifte',
      sub_estimation_impot: 'Belastingschatting',
      sub_rapprochement: 'Bankreconciliatie',
      sub_compta_auto: 'Automatische boekhouding',
      sub_gestion_projets: 'Projectbeheer',
      sub_feuilles_temps: 'Urenstaten',
      sub_facturation_directe: 'Directe facturatie',
      sub_inventaire: 'Volledige inventaris',
      sub_alertes_stock: 'Voorraadwaarschuwingen',
      sub_scanner: 'Barcodescanner',
      sub_assistant_ia: 'AI-assistent',
      sub_serveur_mcp: 'MCP-server',
      sub_automatisation: 'Automatisering',
      sub_chat_ia: 'Contextuele AI-chat',
      sub_ocr: 'OCR & Extractie',
      sub_anomalies: 'Anomaliedetectie',
      sub_previsions: 'Voorspellingen',
      sub_api_rest: 'REST API',
      sub_connexions_bancaires: 'Bankverbindingen',
      sub_rapprochement_intelligent: 'Slimme reconciliatie',
      sub_api_mcp: 'REST API & MCP',
      sub_profil: 'Profiel & Bedrijf',
      sub_equipe: 'Team & Rollen',
      sub_securite: 'Beveiliging',
      sub_sauvegardes: 'Back-ups',
      sub_multilingue: 'Meertalig',
      sub_rgpd: 'AVG & Export',
      sub_modes_vues: '4 Weergavemodi',
      sub_formats_export: 'Exportformaten',
      sub_credits: 'Creditsysteem',
      sub_onboarding: 'Begeleide onboarding',
      sub_quick_invoice: 'Snelle facturatie',
      sub_pilotage_comptable: 'Boekhoudkundige Analyse',
      sub_pilotage_financier: 'Financi\u00eble Analyse',
      sub_pilotage_fiscal: 'Fiscaliteit & Waardering',
      sub_pilotage_simulateur: 'Simulator',
      sub_pilotage_audit: 'AI Audit',
      hero_badge: 'Offici\u00eble gebruikershandleiding',
      hero_sub: 'Volledige gebruikershandleiding',
      hero_desc:
        'Alles wat u moet weten om uw financi\u00eble activiteiten te beheren. Facturatie, boekhouding, projecten, kasstroom en kunstmatige intelligentie \u2014 beheers elke functie van uw platform.',
      hero_cta: 'Naar CashPilot',
      hero_read: 'Lees de gids',
      hero_powered: 'Aangedreven door',
      hero_explore: 'ONTDEKKEN',
      toc_badge: 'Inhoud',
      toc_title_1: 'Inhouds',
      toc_title_2: 'opgave',
      toc_subtitle: '13 hoofdstukken om CashPilot van A tot Z te beheersen.',
      toc_01: 'Aan de slag',
      toc_01_desc: 'Inloggen, registratie, MFA en navigatie',
      toc_02: 'Dashboard',
      toc_02_desc: "KPI's, grafieken en snelle acties",
      toc_03: 'Commercieel beheer',
      toc_03_desc: 'Klanten, leveranciers en contacten',
      toc_04: 'Facturatiecyclus',
      toc_04_desc: "Offertes, facturen, creditnota's en leveringsbonnen",
      toc_05: 'Financieel beheer',
      toc_05_desc: 'Uitgaven, vorderingen, schulden, kasstroom',
      toc_06: 'Boekhouding',
      toc_06_desc: 'Rekeningschema, balans, resultaat, BTW',
      toc_07: 'Projecten & Tijd',
      toc_07_desc: 'Projecten, urenstaten, taken',
      toc_08: 'Voorraad & Producten',
      toc_08_desc: 'Inventaris, waarschuwingen, barcodes',
      toc_09: 'Kunstmatige Intelligentie',
      toc_09_desc: 'AI-chat, OCR, anomalie\u00ebn, voorspellingen',
      toc_10: 'Bank & Integraties',
      toc_10_desc: 'Open Banking, reconciliatie, API',
      toc_11: 'Instellingen & Beheer',
      toc_11_desc: 'Profiel, bedrijf, team, AVG',
      toc_12: 'Sneltoetsen & Tips',
      toc_12_desc: 'Sneltoetsen, multi-weergaven, exports',
      toc_13: 'Strategisch Sturen',
      toc_13_desc: "Ratio's, benchmarks, fiscaliteit, waardering",
      badge_01: 'Hoofdstuk 01',
      badge_02: 'Hoofdstuk 02',
      badge_03: 'Hoofdstuk 03',
      badge_04: 'Hoofdstuk 04',
      badge_05: 'Hoofdstuk 05',
      badge_06: 'Hoofdstuk 06',
      badge_07: 'Hoofdstuk 07',
      badge_08: 'Hoofdstuk 08',
      badge_09: 'Hoofdstuk 09',
      badge_10: 'Hoofdstuk 10',
      badge_11: 'Hoofdstuk 11',
      badge_12: 'Hoofdstuk 12',
      badge_13: 'Hoofdstuk 13',
      s1_title_1: 'Aan de ',
      s1_title_2: 'Slag',
      s1_subtitle: 'Schrijf u in, log in en ontdek de interface in enkele minuten.',
      s1_step1_title: 'Account aanmaken',
      s1_step1_desc:
        'Ga naar de registratiepagina. Voer uw e-mail in, kies een wachtwoord en valideer uw account via de link die u per e-mail ontvangt.',
      s1_step2_title: 'Inloggen',
      s1_step2_desc:
        'Voer uw inloggegevens in op de inlogpagina. Schakel tweefactorauthenticatie (MFA) in bij de beveiligingsinstellingen om uw account te beschermen.',
      s1_step3_title: 'Uw bedrijf configureren',
      s1_step3_desc:
        'Ga naar <strong style="color:#fff">Instellingen \u2192 Bedrijf</strong> om de naam, het adres, het BTW-nummer en het logo van uw bedrijf in te voeren.',
      s1_step4_title: 'Navigatie verkennen',
      s1_step4_desc:
        'De zijbalk geeft u toegang tot alle secties: Dashboard, Klanten, Facturen, Boekhouding, Projecten en meer. Hij is inklapbaar om ruimte te besparen.',
      s1_tip:
        '<strong>Verbeterde beveiliging:</strong> Schakel tweefactorauthenticatie (MFA) in vanaf uw eerste login via <strong>Instellingen \u2192 Beveiliging</strong>. CashPilot ondersteunt TOTP-codes en biometrische authenticatie.',
      s2_title_1: '',
      s2_title_2: 'Dashboard',
      s2_subtitle: 'Uw centrale hub om uw bedrijfsactiviteit in realtime te volgen.',
      s2_kpis_title: "Real-time KPI's",
      s2_kpis_desc: 'Totale omzet, winstmarge en bezettingsgraad automatisch berekend op basis van uw gegevens.',
      s2_graphiques_title: 'Interactieve grafieken',
      s2_graphiques_desc: 'Visualiseer de maandelijkse evolutie van uw omzet en de verdeling per klant.',
      s2_actions_title: 'Snelle acties',
      s2_actions_desc: 'Maak een factuur, urenstaat of nieuwe klant aan met \u00e9\u00e9n klik vanuit het dashboard.',
      s2_export_title: 'PDF & HTML Export',
      s2_export_desc: 'Download een volledig rapport van uw dashboard in PDF of HTML.',
      s3_title_1: 'Commercieel ',
      s3_title_2: 'Beheer',
      s3_subtitle: 'Beheer uw klanten- en leveranciersportfolio met een ge\u00efntegreerd CRM.',
      s3_clients_title: 'Klanten',
      s3_clients_desc:
        'Centraliseer alle klantinformatie: bedrijfsnaam, contact, e-mail, adres, BTW-nummer en voorkeursvaluta. Elke klantfiche groepeert de historie van facturen, betalingen en projecten.',
      s3_fournisseurs_title: 'Leveranciers',
      s3_fournisseurs_desc:
        'Maak een volledig leveranciersdirectory aan met contacten, producten/diensten en aankoopgeschiedenis. Bekijk uw leveranciers op een <strong style="color:#fff;">interactieve kaart</strong> en genereer prestatierapporten.',
      s3_tip:
        '<strong>Multi-valuta:</strong> CashPilot ondersteunt EUR, USD en GBP. De voorkeursvaluta van de klant wordt automatisch toegepast bij het aanmaken van facturen.',
      s4_title_1: 'Facturatie',
      s4_title_2: 'cyclus',
      s4_subtitle: 'Van offerte tot creditnota, beheer de volledige facturatiecyclus met meerdere weergaven.',
      s4_devis_title: 'Offerte \u2192 Factuur',
      s4_devis_desc:
        'Maak een offerte aan, laat deze goedkeuren door de klant en converteer deze met \u00e9\u00e9n klik naar een factuur. Alle gegevens worden automatisch overgedragen.',
      s4_recurrentes_title: 'Terugkerende facturen',
      s4_recurrentes_desc:
        'Definieer sjablonen met een frequentie (wekelijks, maandelijks, driemaandelijks). Facturen worden automatisch gegenereerd en verzonden.',
      s4_avoirs_title: "Creditnota's",
      s4_avoirs_desc:
        "Genereer creditnota's gekoppeld aan een bestaande factuur. Gedeeltelijke of volledige terugbetaling met automatische BTW-aanpassing.",
      s4_bons_title: 'Leveringsbonnen',
      s4_bons_desc:
        'Genereer leveringsbonnen gekoppeld aan uw bestellingen. Artikeltracking, leveringsdatum en handtekening.',
      s4_modes_title: '4 weergavemodi',
      s4_modes_desc:
        'Schakel tussen <strong style="color:#fff;">Lijst</strong>, <strong style="color:#fff;">Kalender</strong>, <strong style="color:#fff;">Agenda</strong> en <strong style="color:#fff;">Kanban</strong> weergaven om uw facturen naar wens te organiseren.',
      s4_email_title: 'E-mail verzenden',
      s4_email_desc:
        'Verzend uw facturen rechtstreeks per e-mail vanuit CashPilot. De PDF wordt automatisch bijgevoegd.',
      s4_creer_title: 'Stap voor stap een factuur aanmaken',
      s4_step1_title: 'Klant selecteren',
      s4_step1_desc: 'Kies een bestaande klant of maak direct een nieuwe aan.',
      s4_step2_title: 'Regels toevoegen',
      s4_step2_desc:
        'Importeer urenstaten of voeg handmatige regels toe met omschrijving, hoeveelheid en eenheidsprijs.',
      s4_step3_title: 'BTW configureren',
      s4_step3_desc:
        'Het BTW-tarief wordt automatisch toegepast. De bedragen excl. BTW, BTW en incl. BTW worden in realtime berekend.',
      s4_step4_title: 'Genereren en verzenden',
      s4_step4_desc: 'Klik op "Factuur genereren" en exporteer naar PDF of verzend per e-mail.',
      s5_title_1: 'Financieel ',
      s5_title_2: 'Beheer',
      s5_subtitle: 'Volg uw uitgaven, beheer uw vorderingen en schulden en beheer uw kasstroom.',
      s5_depenses_title: 'Uitgaven',
      s5_depenses_desc:
        'Registreer elke uitgave met categorie, bedrag, datum en bon. Bulk importeren vanuit een CSV-bestand of gebruik <strong style="color:#fff">spraakinvoer</strong> om uw uitgaven onderweg vast te leggen.',
      s5_creances_title: 'Vorderingen & Schulden',
      s5_creances_desc:
        'De <strong style="color:#fff">Vorderingen/Schulden Manager</strong> centraliseert alles wat men u verschuldigd is en alles wat u verschuldigd bent. Bekijk in Kalender, Agenda of Kanban modus en registreer betalingen per methode (contant, overschrijving, cheque, mobile money).',
      s5_tresorerie_title: 'Kasstroom',
      s5_tresorerie_desc:
        'Bekijk uw kasstroomgeschiedenis over 6 maanden en <strong style="color:#fff">voorspellingen voor 3 maanden</strong>. Het staafdiagram toont inkomsten vs uitgaven met een trendlijn.',
      s5_tip:
        '<strong>Spraakinvoer:</strong> Druk op mobiel op de microfoon om uw uitgaven te dicteren. CashPilot extraheert automatisch het bedrag, de categorie en de omschrijving.',
      s6_title_1: 'Ge\u00efntegreerde ',
      s6_title_2: 'Boekhouding',
      s6_subtitle:
        'Een complete boekhoudmodule met 10 tabbladen: rekeningschema, balans, resultatenrekening, BTW, belastingschatting en bankreconciliatie.',
      s6_plan_title: 'Rekeningschema',
      s6_plan_desc:
        'Importeer uw rekeningschema vanuit een CSV. Zoek en filter op code of rekeningtype. Voorinstellingen voor Frankrijk, Belgi\u00eb en OHADA.',
      s6_bilan_title: 'Balans & Resultaat',
      s6_bilan_desc:
        'Automatische generatie van de balans (Activa/Passiva/Eigen vermogen) en de resultatenrekening (Opbrengsten/Kosten). PDF-export inbegrepen.',
      s6_tva_title: 'BTW-aangifte',
      s6_tva_desc:
        'Automatische berekening van ge\u00efnde BTW, aftrekbare BTW en te betalen BTW. Maandelijks overzicht en PDF-export voor uw aangifte.',
      s6_impot_title: 'Belastingschatting',
      s6_impot_desc:
        'Bereken uw geschatte belasting per aanpasbare schijf. Kwartaalvoorzieningen en effectief tarief. Landvoorinstellingen.',
      s6_rapprochement_title: 'Bankreconciliatie',
      s6_rapprochement_desc:
        'Importeer uw afschriften (PDF, Excel, CSV). Automatische reconciliatie met betrouwbaarheidsscore. Handmatige matching-interface.',
      s6_auto_title: 'Automatische boekhouding',
      s6_auto_desc:
        'Elke factuur, uitgave en betaling genereert automatisch de bijbehorende boekingsregels in realtime.',
      s7_title_1: 'Projecten & ',
      s7_title_2: 'Tijd',
      s7_subtitle: 'Volg uw projecten, registreer bestede tijd en beheer uw taken met meerdere weergaven.',
      s7_projets_title: 'Projectbeheer',
      s7_projets_desc:
        'Maak projecten aan met klant, urenbudget, team en tijdlijn. Volg de voortgang met real-time statistieken: verbruikte uren, resterend budget en voltooiingspercentage.',
      s7_feuilles_title: 'Urenstaten',
      s7_feuilles_desc:
        'Registreer uw uren met begin-/eindtijd, automatische duurberekening en toewijzing aan klant en project. 4 weergavemodi: <strong style="color:#fff">Kalender, Lijst, Kanban en Agenda</strong>.',
      s7_facturation_title: 'Directe facturatie',
      s7_facturation_desc:
        'Selecteer urenstaten en genereer een factuur met \u00e9\u00e9n klik. Goedgekeurde uren worden automatisch omgezet in factuurregels.',
      s8_title_1: 'Voorraad & ',
      s8_title_2: 'Producten',
      s8_subtitle: 'Beheer uw inventaris, ontvang voorraadwaarschuwingen en scan barcodes.',
      s8_inventaire_title: 'Volledige inventaris',
      s8_inventaire_desc:
        'Refereer uw producten met SKU, categorie, hoeveelheid en waarschuwingsdrempel. Voorraadbewegingen automatisch bijgehouden.',
      s8_alertes_title: 'Voorraadwaarschuwingen',
      s8_alertes_desc:
        'Automatische meldingen wanneer een product onder de waarschuwingsdrempel valt. Visuele kleurcodering: groen (OK), oranje (laag), rood (uitverkocht).',
      s8_scanner_title: 'Barcodescanner',
      s8_scanner_desc: 'Gebruik de camera van uw apparaat om barcodes te scannen en de voorraad direct bij te werken.',
      s9_title_1: 'Kunstmatige ',
      s9_title_2: 'Intelligentie',
      s9_subtitle: '6 ge\u00efntegreerde AI-functies en MCP-compatibiliteit met alle grote taalmodellen.',
      s9_assistant_title: 'Ge\u00efntegreerde AI-assistent',
      s9_assistant_desc:
        'Een zwevende AI-chatwidget, altijd toegankelijk, die uw financi\u00eble vragen in context beantwoordt. Het analyseert uw gegevens en biedt gepersonaliseerde aanbevelingen.',
      s9_mcp_title: 'MCP-server \u2014 169 Tools',
      s9_mcp_desc:
        'CashPilot integreert een <strong style="color:#fff">MCP-server (Model Context Protocol)</strong> met 169 tools, waarmee elke compatibele LLM uw financi\u00ebn kan beheren via spraak of tekst:',
      s9_mcp_any: 'Elke MCP-compatibele LLM',
      s9_mcp_example:
        'Vraag gewoon: <em style="color:var(--amber);">"Maak een factuur voor Acme Corp van \u20AC3200"</em> vanuit Claude, ChatGPT of Gemini \u2014 de MCP-server voert het commando rechtstreeks uit in CashPilot.',
      s9_auto_title: 'CashPilot als automatiseringstool',
      s9_auto_desc:
        'Naast zijn eigen automatiseringen kan <strong style="color:#fff">CashPilot worden gebruikt als tool in uw externe automatiseringsketens</strong> (Rube.app, Gumloop, Zapier, Make, n8n, etc.). Dankzij de REST API en MCP-server kunt u facturatie, boekhouding en financieel beheer integreren in elke geautomatiseerde workflow.',
      s9_chat_title: 'Contextuele AI-chat',
      s9_chat_desc:
        'Stel vragen in natuurlijke taal over uw financi\u00ebn. De AI heeft toegang tot uw real-time gegevens voor nauwkeurige antwoorden.',
      s9_ocr_title: 'OCR & Extractie',
      s9_ocr_desc:
        'Upload een ontvangen factuur of bon: de AI extraheert automatisch het bedrag, de datum, de leverancier en de regels.',
      s9_anomalies_title: 'Anomaliedetectie',
      s9_anomalies_desc:
        'De AI bewaakt uw transacties en waarschuwt u bij ongebruikelijke uitgaven, budgetoverschrijdingen of verdachte variaties.',
      s9_previsions_title: "Voorspellingen & Scenario's",
      s9_previsions_desc:
        "Maak financi\u00eble scenario's met aangepaste aannames. Vergelijk resultaten naast elkaar en identificeer het break-evenpunt.",
      s9_outils_title: '29 MCP-tools',
      s9_outils_desc:
        'Factuuraanmaak, klantenzoekopdracht, boekhoudexport, financieel overzicht \u2014 26 tools bruikbaar vanuit elke MCP-compatibele LLM.',
      s9_api_title: 'Volledige REST API',
      s9_api_desc:
        'Een gedocumenteerde REST API (OpenAPI 3.1) om CashPilot te integreren in uw Rube.app, Gumloop, Zapier, Make, n8n automatiseringen of aangepaste scripts.',
      s9_tip:
        '<strong>Ultieme automatisering:</strong> Verbind CashPilot met <strong>Rube.app</strong> of elk automatiseringsplatform. Voorbeeld: leveranciersfactuur e-mail ontvangen \u2192 AI-extractie \u2192 automatische aanmaak in CashPilot \u2192 Slack-melding. Uw financieel beheer wordt een bouwsteen in uw geautomatiseerde pipeline.',
      s10_title_1: 'Bank & ',
      s10_title_2: 'Integraties',
      s10_subtitle: 'Verbind uw bankrekeningen, reconcilieer uw transacties en integreer CashPilot in uw ecosysteem.',
      s10_connexions_title: 'Bankverbindingen',
      s10_connexions_desc:
        'Verbind uw bankrekeningen om uw transacties automatisch te synchroniseren. Multi-bank ondersteuning.',
      s10_rapprochement_title: 'Slimme reconciliatie',
      s10_rapprochement_desc:
        'Het automatische matching-algoritme reconcilieert uw afschriften met uw facturen en uitgaven met een betrouwbaarheidsscore.',
      s10_api_title: 'REST API & MCP',
      s10_api_desc:
        "Integreer CashPilot in uw ecosysteem via de REST API (OpenAPI 3.1) of het MCP-protocol voor LLM's.",
      s11_title_1: 'Instellingen & ',
      s11_title_2: 'Beheer',
      s11_subtitle: 'Pas CashPilot aan, beheer uw team en beveilig uw gegevens.',
      s11_profil_title: 'Profiel & Bedrijf',
      s11_profil_desc:
        'Naam, logo, adres, BTW, boekjaar. Pas uw facturen aan met 5 sjablonen (Classic, Modern, Professional, Minimal, Bold).',
      s11_equipe_title: 'Team & Rollen',
      s11_equipe_desc:
        'Nodig medewerkers uit en wijs rollen toe met gedetailleerde rechten. Beheer de toegang tot elke sectie.',
      s11_securite_title: 'Beveiliging',
      s11_securite_desc:
        'MFA-authenticatie (TOTP), sessiebeheer, inloggeschiedenis, biometrische authenticatie en API-sleutels.',
      s11_sauvegardes_title: 'Back-ups',
      s11_sauvegardes_desc:
        'Lokale JSON-back-up, cloud-back-up (multi-providers), automatische planning (dagelijks, wekelijks, maandelijks).',
      s11_multilingue_title: 'Meertalig',
      s11_multilingue_desc: 'Interface beschikbaar in Frans, Engels en Nederlands. Onmiddellijke taalwissel.',
      s11_rgpd_title: 'AVG & Export',
      s11_rgpd_desc: 'Exporteer al uw gegevens voor AVG-conformiteit. Verwijder uw account en gegevens op elk moment.',
      s12_title_1: 'Sneltoetsen & ',
      s12_title_2: 'Tips',
      s12_subtitle: 'Word een CashPilot power user met deze tips en sneltoetsen.',
      s12_modes_title: '4 Weergavemodi',
      s12_modes_desc:
        'Facturen, urenstaten en vorderingen hebben 4 weergaven: <strong style="color:#fff">Lijst</strong> (tabel), <strong style="color:#fff">Kalender</strong> (maand), <strong style="color:#fff">Agenda</strong> (prioriteit) en <strong style="color:#fff">Kanban</strong> (drag & drop).',
      s12_export_title: 'Exportformaten',
      s12_export_desc:
        '<strong style="color:#fff">PDF</strong> voor afdrukken, <strong style="color:#fff">HTML</strong> voor web, <strong style="color:#fff">CSV</strong> voor spreadsheets, <strong style="color:#fff">Excel</strong> voor geavanceerde analyse. Alle documenten zijn exporteerbaar.',
      s12_credits_title: 'Creditsysteem',
      s12_credits_desc:
        'PDF-exports en AI-functies verbruiken credits. Volg uw saldo in de navigatiebalk. Gratis credits worden elke maand aangeboden.',
      s12_onboarding_title: 'Begeleide Onboarding',
      s12_onboarding_desc:
        'Bij de eerste login begeleidt een interactieve tour u door de belangrijkste functies. Speel het op elk moment opnieuw af vanuit de instellingen.',
      s12_quick_title: 'Snelle facturatie',
      s12_quick_desc:
        'De <strong style="color:#fff">Quick Invoice</strong> modus maakt het mogelijk om een factuur in minder dan 30 seconden aan te maken met een minimalistisch formulier.',
      s12_auto_title: 'CashPilot = Automatiseringstool',
      s12_auto_desc:
        'Dankzij de MCP-server en REST API is CashPilot niet alleen software \u2014 het is een <strong style="color:#fff">herbruikbare bouwsteen</strong> in uw automatiseringspipelines (Rube.app, Gumloop, Zapier, Make, n8n).',
      s12_tip:
        '<strong>Inklapbare zijbalk:</strong> Klik op de pijl in de zijbalk om deze in te klappen naar pictogrammodus. Zweef over een pictogram om de tooltip met de sectienaam te zien.',
      s13_title_1: 'Strategisch ',
      s13_title_2: 'Sturen',
      s13_subtitle: 'Een uniform stuurcentrum met 6 tabbladen om uw bedrijf nauwkeurig te besturen.',
      s13_overview_title: 'Overzicht',
      s13_overview_desc:
        "5 belangrijke KPI's (Omzet, EBITDA, Nettoresultaat, Vrije Kasstroom, Waardering), trendgrafieken en automatische financi\u00eble waarschuwingen met kleurcodering.",
      s13_comptable_title: 'Boekhoudkundige Analyse',
      s13_comptable_desc:
        "Structuurverhouding (financi\u00eble onafhankelijkheid, gearing, dekking), activiteitsratio's (DSO, DPO, CCC, WCR/Omzet) met verkeerslichtbeoordeling.",
      s13_financier_title: 'Financi\u00eble Analyse',
      s13_financier_desc:
        'Marges (bruto, EBITDA, operationeel, netto), rendabiliteit (ROE, ROA, ROCE), kapitaalstructuur en meerperiodetrends.',
      s13_fiscal_title: 'Fiscaliteit & Waardering',
      s13_fiscal_desc:
        'Multizone vennootschapsbelasting (Frankrijk 25%/15% KMO, Belgi\u00eb 25%/20%, OHADA 30%+IMF), belastingkredieten, EBITDA-multiples + vereenvoudigde DCF-waardering, WACC-gevoeligheid.',
      s13_simulateur_title: 'Simulator',
      s13_simulateur_desc:
        "What-if scenario's met vergelijking naast elkaar en directe link naar de ScenarioBuilder voor geavanceerde modellering.",
      s13_audit_title: 'AI Audit',
      s13_audit_desc:
        'Boekhoudkundige gezondheidsscore, gecategoriseerde auditcontroles (volledigheid, coherentie, naleving) en AI-gegenereerde aanbevelingen.',
      s13_tip:
        '<strong>Snelle toegang:</strong> De Stuurmodule is bereikbaar via de zijbalk via het doelpictogram. Elk tabblad is ontworpen om onafhankelijk te werken of als onderdeel van de volledige analyse.',
      cta_badge: 'Online platform',
      cta_headline_1: 'Klaar om uw',
      cta_headline_2: 'financieel beheer te transformeren',
      cta_subtext:
        'Sluit u aan bij de bedrijven die hun facturatie, boekhouding, kasstroom en projecten beheren vanuit \u00e9\u00e9n enkel platform aangedreven door kunstmatige intelligentie. <strong style="color:#fff;">Probeer CashPilot nu.</strong>',
      cta_btn_primary: 'Ontdek CashPilot',
      cta_btn_secondary: 'Contacteer het team',
      cta_stat_features: 'Functies',
      cta_stat_mcp: 'MCP / AI Tools',
      cta_stat_modules: 'Modules',
      cta_stat_api: 'REST + OpenAPI 3.1',
      footer_text_1:
        'Gebruikershandleiding v4.0 \u2022 Februari 2026 \u2022 \u00A9 CashPilot. Alle rechten voorbehouden.',
      footer_text_2: 'Platform voor Financieel Beheer',
    },
  };

  // === i18n Translation Engine ===
  var frCache = new Map();
  var currentLang = 'fr';

  function cacheAndSet(el, key, html) {
    if (!frCache.has(key)) frCache.set(key, el.innerHTML);
    el.innerHTML = html;
  }

  function restoreFr(el, key) {
    if (frCache.has(key)) el.innerHTML = frCache.get(key);
  }

  function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('guide-lang', lang);
    } catch (e) {}

    // Update lang switcher buttons
    document.querySelectorAll('.sidebar-lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    var isTranslate = lang !== 'fr';
    var dict = isTranslate ? i18n[lang] : null;

    // Helper
    function apply(selector, key) {
      var el = document.querySelector(selector);
      if (!el) return;
      if (isTranslate && dict[key]) {
        cacheAndSet(el, key, dict[key]);
      } else {
        restoreFr(el, key);
      }
    }

    // Page title
    apply('title[data-i18n="page_title"]', 'page_title');

    // Sidebar home
    apply('[data-i18n="home"]', 'home');

    // Sidebar version
    var verEl = document.querySelector('.sidebar-version');
    if (verEl) {
      if (isTranslate && dict.sidebar_guide) cacheAndSet(verEl, 'sidebar_guide', dict.sidebar_guide);
      else restoreFr(verEl, 'sidebar_guide');
    }

    // Sidebar section labels
    var sectionLabels = document.querySelectorAll('.sidebar-section-label');
    var navKeys = [
      'nav_01',
      'nav_02',
      'nav_03',
      'nav_04',
      'nav_05',
      'nav_06',
      'nav_07',
      'nav_08',
      'nav_09',
      'nav_10',
      'nav_11',
      'nav_12',
      'nav_13',
    ];
    sectionLabels.forEach(function (el, i) {
      var k = navKeys[i];
      if (!k) return;
      if (isTranslate && dict[k]) cacheAndSet(el, k, dict[k]);
      else restoreFr(el, k);
    });

    // Sidebar sub-links
    var subLinkMap = {
      'premiers-pas': ['sub_overview', 'sub_creer_compte', 'sub_se_connecter', 'sub_configurer'],
      dashboard: ['sub_overview', 'sub_kpis', 'sub_graphiques', 'sub_actions_rapides', 'sub_export_dashboard'],
      commercial: ['sub_overview', 'sub_clients', 'sub_fournisseurs'],
      facturation: [
        'sub_overview',
        'sub_devis',
        'sub_factures_rec',
        'sub_avoirs',
        'sub_bons_livraison',
        'sub_modes_affichage',
        'sub_creer_facture',
      ],
      finance: ['sub_overview', 'sub_depenses', 'sub_creances_dettes', 'sub_tresorerie'],
      comptabilite: [
        'sub_overview',
        'sub_plan_comptable',
        'sub_bilan_resultat',
        'sub_declaration_tva',
        'sub_estimation_impot',
        'sub_rapprochement',
        'sub_compta_auto',
      ],
      projets: ['sub_overview', 'sub_gestion_projets', 'sub_feuilles_temps', 'sub_facturation_directe'],
      stock: ['sub_overview', 'sub_inventaire', 'sub_alertes_stock', 'sub_scanner'],
      ia: [
        'sub_overview',
        'sub_assistant_ia',
        'sub_serveur_mcp',
        'sub_automatisation',
        'sub_chat_ia',
        'sub_ocr',
        'sub_anomalies',
        'sub_previsions',
        'sub_api_rest',
      ],
      banque: ['sub_overview', 'sub_connexions_bancaires', 'sub_rapprochement_intelligent', 'sub_api_mcp'],
      parametres: [
        'sub_overview',
        'sub_profil',
        'sub_equipe',
        'sub_securite',
        'sub_sauvegardes',
        'sub_multilingue',
        'sub_rgpd',
      ],
      astuces: [
        'sub_overview',
        'sub_modes_vues',
        'sub_formats_export',
        'sub_credits',
        'sub_onboarding',
        'sub_quick_invoice',
      ],
      pilotage: [
        'sub_overview',
        'sub_pilotage_comptable',
        'sub_pilotage_financier',
        'sub_pilotage_fiscal',
        'sub_pilotage_simulateur',
        'sub_pilotage_audit',
      ],
    };
    Object.keys(subLinkMap).forEach(function (section) {
      var links = document.querySelectorAll('.sidebar-section[data-section="' + section + '"] .sidebar-sub-link');
      subLinkMap[section].forEach(function (key, i) {
        if (links[i]) {
          if (isTranslate && dict[key]) cacheAndSet(links[i], section + '_' + key, dict[key]);
          else restoreFr(links[i], section + '_' + key);
        }
      });
    });

    // Hero
    apply('[data-i18n="hero_badge"]', 'hero_badge');
    apply('[data-i18n="hero_sub"]', 'hero_sub');
    apply('[data-i18n="hero_desc"]', 'hero_desc');
    apply('[data-i18n="hero_cta"]', 'hero_cta');
    apply('[data-i18n="hero_read"]', 'hero_read');
    apply('[data-i18n="hero_powered"]', 'hero_powered');
    apply('[data-i18n="hero_explore"]', 'hero_explore');

    // TOC
    var tocSection = document.getElementById('toc');
    if (tocSection) {
      var tocBadge = tocSection.querySelector('.section-badge');
      var tocTitle = tocSection.querySelector('.section-title');
      var tocSub = tocSection.querySelector('.section-subtitle');
      if (tocBadge) {
        if (isTranslate && dict.toc_badge) cacheAndSet(tocBadge, 'toc_badge', dict.toc_badge);
        else restoreFr(tocBadge, 'toc_badge');
      }
      if (tocTitle) {
        if (isTranslate)
          cacheAndSet(
            tocTitle,
            'toc_title',
            dict.toc_title_1 + '<span class="gradient-text">' + dict.toc_title_2 + '</span>'
          );
        else restoreFr(tocTitle, 'toc_title');
      }
      if (tocSub) {
        if (isTranslate && dict.toc_subtitle) cacheAndSet(tocSub, 'toc_subtitle', dict.toc_subtitle);
        else restoreFr(tocSub, 'toc_subtitle');
      }

      // TOC cards
      var tocCards = tocSection.querySelectorAll('.toc-card');
      var tocKeys = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];
      tocCards.forEach(function (card, i) {
        var num = tocKeys[i];
        if (!num) return;
        var h3 = card.querySelector('h3');
        var p = card.querySelector('p');
        if (h3) {
          if (isTranslate && dict['toc_' + num]) cacheAndSet(h3, 'toc_h3_' + num, dict['toc_' + num]);
          else restoreFr(h3, 'toc_h3_' + num);
        }
        if (p) {
          if (isTranslate && dict['toc_' + num + '_desc']) cacheAndSet(p, 'toc_p_' + num, dict['toc_' + num + '_desc']);
          else restoreFr(p, 'toc_p_' + num);
        }
      });
    }

    // Content sections (1-12)
    var sectionConfigs = [
      {
        id: 'premiers-pas',
        badge: 'badge_01',
        t1: 's1_title_1',
        t2: 's1_title_2',
        sub: 's1_subtitle',
        features: [],
        steps: [
          { t: 's1_step1_title', d: 's1_step1_desc' },
          { t: 's1_step2_title', d: 's1_step2_desc' },
          { t: 's1_step3_title', d: 's1_step3_desc' },
          { t: 's1_step4_title', d: 's1_step4_desc' },
        ],
        tip: 's1_tip',
      },
      {
        id: 'dashboard',
        badge: 'badge_02',
        t1: 's2_title_1',
        t2: 's2_title_2',
        sub: 's2_subtitle',
        features: [
          { t: 's2_kpis_title', d: 's2_kpis_desc' },
          { t: 's2_graphiques_title', d: 's2_graphiques_desc' },
          { t: 's2_actions_title', d: 's2_actions_desc' },
          { t: 's2_export_title', d: 's2_export_desc' },
        ],
      },
      {
        id: 'commercial',
        badge: 'badge_03',
        t1: 's3_title_1',
        t2: 's3_title_2',
        sub: 's3_subtitle',
        inlineH3: [
          { t: 's3_clients_title', d: 's3_clients_desc' },
          { t: 's3_fournisseurs_title', d: 's3_fournisseurs_desc' },
        ],
        tip: 's3_tip',
      },
      {
        id: 'facturation',
        badge: 'badge_04',
        t1: 's4_title_1',
        t2: 's4_title_2',
        sub: 's4_subtitle',
        features: [
          { t: 's4_devis_title', d: 's4_devis_desc' },
          { t: 's4_recurrentes_title', d: 's4_recurrentes_desc' },
          { t: 's4_avoirs_title', d: 's4_avoirs_desc' },
          { t: 's4_bons_title', d: 's4_bons_desc' },
          { t: 's4_modes_title', d: 's4_modes_desc' },
          { t: 's4_email_title', d: 's4_email_desc' },
        ],
        creerTitle: 's4_creer_title',
        steps: [
          { t: 's4_step1_title', d: 's4_step1_desc' },
          { t: 's4_step2_title', d: 's4_step2_desc' },
          { t: 's4_step3_title', d: 's4_step3_desc' },
          { t: 's4_step4_title', d: 's4_step4_desc' },
        ],
      },
      {
        id: 'finance',
        badge: 'badge_05',
        t1: 's5_title_1',
        t2: 's5_title_2',
        sub: 's5_subtitle',
        inlineH3: [
          { t: 's5_depenses_title', d: 's5_depenses_desc' },
          { t: 's5_creances_title', d: 's5_creances_desc' },
          { t: 's5_tresorerie_title', d: 's5_tresorerie_desc' },
        ],
        tip: 's5_tip',
      },
      {
        id: 'comptabilite',
        badge: 'badge_06',
        t1: 's6_title_1',
        t2: 's6_title_2',
        sub: 's6_subtitle',
        features: [
          { t: 's6_plan_title', d: 's6_plan_desc' },
          { t: 's6_bilan_title', d: 's6_bilan_desc' },
          { t: 's6_tva_title', d: 's6_tva_desc' },
          { t: 's6_impot_title', d: 's6_impot_desc' },
          { t: 's6_rapprochement_title', d: 's6_rapprochement_desc' },
          { t: 's6_auto_title', d: 's6_auto_desc' },
        ],
      },
      {
        id: 'projets',
        badge: 'badge_07',
        t1: 's7_title_1',
        t2: 's7_title_2',
        sub: 's7_subtitle',
        inlineH3: [
          { t: 's7_projets_title', d: 's7_projets_desc' },
          { t: 's7_feuilles_title', d: 's7_feuilles_desc' },
          { t: 's7_facturation_title', d: 's7_facturation_desc' },
        ],
      },
      {
        id: 'stock',
        badge: 'badge_08',
        t1: 's8_title_1',
        t2: 's8_title_2',
        sub: 's8_subtitle',
        features: [
          { t: 's8_inventaire_title', d: 's8_inventaire_desc' },
          { t: 's8_alertes_title', d: 's8_alertes_desc' },
          { t: 's8_scanner_title', d: 's8_scanner_desc' },
        ],
      },
      {
        id: 'ia',
        badge: 'badge_09',
        t1: 's9_title_1',
        t2: 's9_title_2',
        sub: 's9_subtitle',
        inlineH3: [
          { t: 's9_assistant_title', d: 's9_assistant_desc' },
          { t: 's9_mcp_title', d: 's9_mcp_desc' },
          { t: 's9_auto_title', d: 's9_auto_desc' },
        ],
        features: [
          { t: 's9_chat_title', d: 's9_chat_desc' },
          { t: 's9_ocr_title', d: 's9_ocr_desc' },
          { t: 's9_anomalies_title', d: 's9_anomalies_desc' },
          { t: 's9_previsions_title', d: 's9_previsions_desc' },
          { t: 's9_outils_title', d: 's9_outils_desc' },
          { t: 's9_api_title', d: 's9_api_desc' },
        ],
        tip: 's9_tip',
      },
      {
        id: 'banque',
        badge: 'badge_10',
        t1: 's10_title_1',
        t2: 's10_title_2',
        sub: 's10_subtitle',
        features: [
          { t: 's10_connexions_title', d: 's10_connexions_desc' },
          { t: 's10_rapprochement_title', d: 's10_rapprochement_desc' },
          { t: 's10_api_title', d: 's10_api_desc' },
        ],
      },
      {
        id: 'parametres',
        badge: 'badge_11',
        t1: 's11_title_1',
        t2: 's11_title_2',
        sub: 's11_subtitle',
        features: [
          { t: 's11_profil_title', d: 's11_profil_desc' },
          { t: 's11_equipe_title', d: 's11_equipe_desc' },
          { t: 's11_securite_title', d: 's11_securite_desc' },
          { t: 's11_sauvegardes_title', d: 's11_sauvegardes_desc' },
          { t: 's11_multilingue_title', d: 's11_multilingue_desc' },
          { t: 's11_rgpd_title', d: 's11_rgpd_desc' },
        ],
      },
      {
        id: 'astuces',
        badge: 'badge_12',
        t1: 's12_title_1',
        t2: 's12_title_2',
        sub: 's12_subtitle',
        features: [
          { t: 's12_modes_title', d: 's12_modes_desc' },
          { t: 's12_export_title', d: 's12_export_desc' },
          { t: 's12_credits_title', d: 's12_credits_desc' },
          { t: 's12_onboarding_title', d: 's12_onboarding_desc' },
          { t: 's12_quick_title', d: 's12_quick_desc' },
          { t: 's12_auto_title', d: 's12_auto_desc' },
        ],
        tip: 's12_tip',
      },
      {
        id: 'pilotage',
        badge: 'badge_13',
        t1: 's13_title_1',
        t2: 's13_title_2',
        sub: 's13_subtitle',
        features: [
          { t: 's13_overview_title', d: 's13_overview_desc' },
          { t: 's13_comptable_title', d: 's13_comptable_desc' },
          { t: 's13_financier_title', d: 's13_financier_desc' },
          { t: 's13_fiscal_title', d: 's13_fiscal_desc' },
          { t: 's13_simulateur_title', d: 's13_simulateur_desc' },
          { t: 's13_audit_title', d: 's13_audit_desc' },
        ],
        tip: 's13_tip',
      },
    ];

    sectionConfigs.forEach(function (cfg) {
      var sec = document.getElementById(cfg.id);
      if (!sec) return;

      // Badge
      var badge = sec.querySelector('.section-badge');
      if (badge) {
        if (isTranslate && dict[cfg.badge]) cacheAndSet(badge, cfg.badge, dict[cfg.badge]);
        else restoreFr(badge, cfg.badge);
      }

      // Section title
      var title = sec.querySelector('.section-title');
      if (title) {
        var k = cfg.id + '_title';
        if (isTranslate)
          cacheAndSet(title, k, dict[cfg.t1] + '<span class="gradient-text">' + dict[cfg.t2] + '</span>');
        else restoreFr(title, k);
      }

      // Subtitle
      var sub = sec.querySelector('.section-subtitle');
      if (sub) {
        if (isTranslate && dict[cfg.sub]) cacheAndSet(sub, cfg.sub, dict[cfg.sub]);
        else restoreFr(sub, cfg.sub);
      }

      // Feature cards
      if (cfg.features) {
        var cards = sec.querySelectorAll('.feature-card');
        cfg.features.forEach(function (f, i) {
          if (!cards[i]) return;
          var h3 = cards[i].querySelector('h3');
          var p = cards[i].querySelector('p');
          if (h3) {
            if (isTranslate && dict[f.t]) cacheAndSet(h3, f.t, dict[f.t]);
            else restoreFr(h3, f.t);
          }
          if (p) {
            if (isTranslate && dict[f.d]) cacheAndSet(p, f.d, dict[f.d]);
            else restoreFr(p, f.d);
          }
        });
      }

      // Inline h3 (two-col-text)
      if (cfg.inlineH3) {
        var twoColText = sec.querySelector('.two-col-text');
        if (twoColText) {
          var h3s = twoColText.querySelectorAll('h3');
          cfg.inlineH3.forEach(function (ih, i) {
            if (!h3s[i]) return;
            if (isTranslate && dict[ih.t]) cacheAndSet(h3s[i], ih.t, dict[ih.t]);
            else restoreFr(h3s[i], ih.t);
            // Next sibling p
            var p = h3s[i].nextElementSibling;
            if (p && p.tagName === 'P') {
              if (isTranslate && dict[ih.d]) cacheAndSet(p, ih.d, dict[ih.d]);
              else restoreFr(p, ih.d);
            }
          });
        }
      }

      // Steps
      if (cfg.steps) {
        var steps = sec.querySelectorAll('.step-content');
        cfg.steps.forEach(function (s, i) {
          if (!steps[i]) return;
          var h4 = steps[i].querySelector('h4');
          var p = steps[i].querySelector('p');
          if (h4) {
            if (isTranslate && dict[s.t]) cacheAndSet(h4, s.t, dict[s.t]);
            else restoreFr(h4, s.t);
          }
          if (p) {
            if (isTranslate && dict[s.d]) cacheAndSet(p, s.d, dict[s.d]);
            else restoreFr(p, s.d);
          }
        });
      }

      // Creer title (facturation)
      if (cfg.creerTitle) {
        var creerH3 = sec.querySelector('h3#creer-facture');
        if (creerH3) {
          if (isTranslate && dict[cfg.creerTitle]) cacheAndSet(creerH3, cfg.creerTitle, dict[cfg.creerTitle]);
          else restoreFr(creerH3, cfg.creerTitle);
        }
      }

      // Pro tip
      if (cfg.tip) {
        var tipEl = sec.querySelector('.pro-tip-text');
        if (tipEl) {
          if (isTranslate && dict[cfg.tip]) cacheAndSet(tipEl, cfg.tip, dict[cfg.tip]);
          else restoreFr(tipEl, cfg.tip);
        }
      }
    });

    // CTA Section
    var ctaSec = document.getElementById('cta');
    if (ctaSec) {
      var ctaBadgeEl = ctaSec.querySelector('.cta-badge');
      if (ctaBadgeEl) {
        if (isTranslate && dict.cta_badge)
          cacheAndSet(ctaBadgeEl, 'cta_badge', '<span class="cta-badge-dot"></span> ' + dict.cta_badge);
        else restoreFr(ctaBadgeEl, 'cta_badge');
      }
      var ctaHL = ctaSec.querySelector('.cta-headline');
      if (ctaHL) {
        if (isTranslate)
          cacheAndSet(
            ctaHL,
            'cta_headline',
            dict.cta_headline_1 + '<br><span class="gradient-text">' + dict.cta_headline_2 + '</span> ?'
          );
        else restoreFr(ctaHL, 'cta_headline');
      }
      var ctaSub = ctaSec.querySelector('.cta-subtext');
      if (ctaSub) {
        if (isTranslate && dict.cta_subtext) cacheAndSet(ctaSub, 'cta_subtext', dict.cta_subtext);
        else restoreFr(ctaSub, 'cta_subtext');
      }
      var ctaBtnP = ctaSec.querySelector('.cta-btn-primary');
      if (ctaBtnP) {
        if (isTranslate && dict.cta_btn_primary)
          cacheAndSet(
            ctaBtnP,
            'cta_btn_primary',
            dict.cta_btn_primary +
              ' <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
          );
        else restoreFr(ctaBtnP, 'cta_btn_primary');
      }
      var ctaBtnS = ctaSec.querySelector('.cta-btn-secondary');
      if (ctaBtnS) {
        if (isTranslate && dict.cta_btn_secondary)
          cacheAndSet(
            ctaBtnS,
            'cta_btn_secondary',
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' +
              dict.cta_btn_secondary
          );
        else restoreFr(ctaBtnS, 'cta_btn_secondary');
      }
      var ctaStats = ctaSec.querySelectorAll('.cta-stat-label');
      var statKeys = ['cta_stat_features', 'cta_stat_mcp', 'cta_stat_modules', 'cta_stat_api'];
      ctaStats.forEach(function (el, i) {
        var k = statKeys[i];
        if (k) {
          if (isTranslate && dict[k]) cacheAndSet(el, k, dict[k]);
          else restoreFr(el, k);
        }
      });
    }

    // Footer
    var footer = document.querySelector('.footer');
    if (footer) {
      var ftexts = footer.querySelectorAll('.footer-text');
      if (ftexts[0]) {
        if (isTranslate && dict.footer_text_1) cacheAndSet(ftexts[0], 'footer_text_1', dict.footer_text_1);
        else restoreFr(ftexts[0], 'footer_text_1');
      }
      if (ftexts[1]) {
        if (isTranslate && dict.footer_text_2) cacheAndSet(ftexts[1], 'footer_text_2', dict.footer_text_2);
        else restoreFr(ftexts[1], 'footer_text_2');
      }
    }
  }

  // === Language Switcher Events ===
  document.getElementById('langSwitcher').addEventListener('click', function (e) {
    var btn = e.target.closest('.sidebar-lang-btn');
    if (!btn) return;
    var lang = btn.getAttribute('data-lang');
    if (lang && lang !== currentLang) applyLanguage(lang);
  });

  // === Auto-detect language ===
  (function () {
    var saved = null;
    try {
      saved = localStorage.getItem('guide-lang');
    } catch (e) {}
    if (saved && i18n[saved]) {
      applyLanguage(saved);
    } else {
      var browserLang = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
      if (browserLang.startsWith('nl')) applyLanguage('nl');
      else if (browserLang.startsWith('en')) applyLanguage('en');
      // else keep FR (default)
    }
  })();
})();
