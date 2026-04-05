import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const serverFile = path.join(repoRoot, 'mcp-server', 'src', 'server.ts');
const toolsDir = path.join(repoRoot, 'mcp-server', 'src', 'tools');
const outputHtml = path.join(repoRoot, 'public', 'mcp-tools.html');

const GENERATED_FILES = ['generated_crud.ts', 'generated_crud_hr.ts', 'generated_crud_projects.ts'];

const CATEGORY_CONFIG = {
  __auth__: { slug: 'auth', title: 'Authentification', desc: 'Connexion et session utilisateur', icon: '🔐' },
  'clients.ts': { slug: 'clients', title: 'Clients', desc: 'Gestion du portefeuille client', icon: '👥' },
  'invoices.ts': { slug: 'invoices', title: 'Factures', desc: 'Facturation et relances', icon: '🧾' },
  'payments.ts': { slug: 'payments', title: 'Paiements', desc: 'Encaissements et créances', icon: '💳' },
  'documents.ts': { slug: 'documents', title: 'Documents', desc: 'Devis, avoirs, dépenses, GED', icon: '📄' },
  'supplier-invoices.ts': {
    slug: 'suppliers',
    title: 'Fournisseurs',
    desc: 'Factures fournisseurs et extraction IA',
    icon: '🏢',
  },
  'accounting.ts': { slug: 'accounting', title: 'Comptabilité', desc: 'Écritures, audit, taxes', icon: '📚' },
  'bank-reconciliation.ts': {
    slug: 'bank',
    title: 'Banque',
    desc: 'Rapprochement bancaire',
    icon: '🏦',
  },
  'analytics.ts': { slug: 'analytics', title: 'Analytics', desc: 'KPI et cash flow', icon: '📈' },
  'reporting.ts': { slug: 'reporting', title: 'Reporting', desc: 'P&L, bilan, ageing', icon: '📊' },
  'exports.ts': { slug: 'exports', title: 'Exports', desc: 'FEC, SAF-T, Factur-X, UBL', icon: '📤' },
  'financial-instruments.ts': {
    slug: 'instruments',
    title: 'Instruments financiers',
    desc: 'Comptes, cartes, transactions, transferts',
    icon: '💼',
  },
  'company-finance.ts': {
    slug: 'company_finance',
    title: 'Finance par société',
    desc: 'KPIs et états financiers par company',
    icon: '🏭',
  },
  'crm.ts': { slug: 'crm', title: 'CRM', desc: 'Leads et pipeline commercial', icon: '🤝' },
  'cfo.ts': { slug: 'cfo', title: 'CFO IA', desc: 'Score santé, risques, recommandations', icon: '🧠' },
  'mobile_money.ts': {
    slug: 'mobile_money',
    title: 'Mobile Money',
    desc: 'Paiements mobile et WhatsApp',
    icon: '📱',
  },
  'syscohada.ts': {
    slug: 'syscohada',
    title: 'SYSCOHADA',
    desc: 'Conformité comptable OHADA',
    icon: '⚖️',
  },
};

const CRUD_SOURCE_LABEL = {
  'generated_crud.ts': 'Core',
  'generated_crud_hr.ts': 'RH',
  'generated_crud_projects.ts': 'CRM/Projets/Matériel',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripDeadFalseBlocks(src) {
  let out = '';
  let i = 0;
  const marker = 'if (false) {';

  while (i < src.length) {
    const idx = src.indexOf(marker, i);
    if (idx === -1) {
      out += src.slice(i);
      break;
    }

    out += src.slice(i, idx);
    let j = idx + marker.length;
    let depth = 1;

    while (j < src.length && depth > 0) {
      const ch = src[j];
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      j += 1;
    }

    i = j;
  }

  return out;
}

function skipSpaces(src, index) {
  let i = index;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  return i;
}

function parseStringLiteral(src, index) {
  const quote = src[index];
  if (!quote || !['\'', '"', '`'].includes(quote)) return null;

  let i = index + 1;
  let raw = '';

  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      if (i + 1 < src.length) {
        raw += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      raw += ch;
      i += 1;
      continue;
    }

    if (ch === quote) {
      const decoded = raw
        .replaceAll('\\n', ' ')
        .replaceAll('\\r', ' ')
        .replaceAll('\\t', ' ')
        .replaceAll('\\"', '"')
        .replaceAll("\\'", "'")
        .replaceAll('\\`', '`')
        .replaceAll('\\\\', '\\')
        .trim();
      return { value: decoded, end: i + 1 };
    }

    raw += ch;
    i += 1;
  }

  return null;
}

function extractToolsFromSource(source) {
  const src = stripDeadFalseBlocks(source);
  const out = [];
  let i = 0;
  const marker = 'server.tool(';

  while (i < src.length) {
    const idx = src.indexOf(marker, i);
    if (idx === -1) break;

    let p = skipSpaces(src, idx + marker.length);
    const nameLit = parseStringLiteral(src, p);
    if (!nameLit) {
      i = idx + marker.length;
      continue;
    }

    p = skipSpaces(src, nameLit.end);
    if (src[p] !== ',') {
      i = nameLit.end;
      continue;
    }

    p = skipSpaces(src, p + 1);
    const descLit = parseStringLiteral(src, p);

    out.push({
      name: nameLit.value,
      description: descLit ? descLit.value : '',
    });

    i = descLit ? descLit.end : p;
  }

  return out;
}

function readTools(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return extractToolsFromSource(source);
}

function buildData() {
  const authTools = readTools(serverFile);

  const toolFiles = fs
    .readdirSync(toolsDir)
    .filter((name) => name.endsWith('.ts'))
    .sort((a, b) => a.localeCompare(b));

  const byFile = {};
  for (const file of toolFiles) {
    byFile[file] = readTools(path.join(toolsDir, file));
  }

  const generatedTools = GENERATED_FILES.flatMap((f) => byFile[f] || []).map((tool) => ({
    ...tool,
    sourceFile: GENERATED_FILES.find((f) => (byFile[f] || []).some((t) => t.name === tool.name)),
  }));

  const businessSections = [
    {
      file: '__auth__',
      ...CATEGORY_CONFIG.__auth__,
      tools: authTools,
    },
    ...Object.entries(byFile)
      .filter(([file]) => !GENERATED_FILES.includes(file) && CATEGORY_CONFIG[file])
      .map(([file, tools]) => ({ file, ...CATEGORY_CONFIG[file], tools })),
  ];

  const businessTools = businessSections.flatMap((section) =>
    section.tools.map((tool) => ({
      ...tool,
      categorySlug: section.slug,
      categoryTitle: section.title,
      source: section.file,
    }))
  );

  const crudEntityMap = new Map();
  for (const file of GENERATED_FILES) {
    for (const tool of byFile[file] || []) {
      const match = tool.name.match(/^(create|get|list|update|delete)_(.+)$/);
      if (!match) continue;

      const operation = match[1];
      const entity = match[2];

      if (!crudEntityMap.has(entity)) {
        crudEntityMap.set(entity, { entity, source: CRUD_SOURCE_LABEL[file], ops: new Set() });
      }

      crudEntityMap.get(entity).ops.add(operation);
    }
  }

  const crudEntities = [...crudEntityMap.values()]
    .map((row) => ({
      entity: row.entity,
      source: row.source,
      ops: ['create', 'get', 'list', 'update', 'delete'].filter((op) => row.ops.has(op)),
    }))
    .sort((a, b) => a.entity.localeCompare(b.entity));

  const allTools = [
    ...businessTools,
    ...generatedTools.map((tool) => ({
      ...tool,
      categorySlug: 'crud',
      categoryTitle: `CRUD ${CRUD_SOURCE_LABEL[tool.sourceFile] || 'Core'}`,
      source: tool.sourceFile || 'generated',
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return {
    businessSections,
    crudEntities,
    allTools,
    stats: {
      total: allTools.length,
      business: businessTools.length,
      crud: generatedTools.length,
      entities: crudEntities.length,
      categories: businessSections.length + 2,
    },
  };
}

function renderToolCard(tool) {
  const params = [];
  const desc = tool.description || 'Description non spécifiée dans le code source.';

  const paramsHtml = params.length
    ? `<div class="tool-params">${params
        .map((param) => `<span class="param-tag">${escapeHtml(param)}</span>`)
        .join('')}</div>`
    : '';

  return `<article class="tool-card" data-search="${escapeHtml(`${tool.name} ${desc}`)}">
    <div class="tool-name">${escapeHtml(tool.name)}</div>
    <div class="tool-desc">${escapeHtml(desc)}</div>
    ${paramsHtml}
  </article>`;
}

function renderSection(section) {
  return `<section class="category" data-cat="${escapeHtml(section.slug)}" id="cat-${escapeHtml(section.slug)}">
    <div class="category-header">
      <div class="category-icon">${escapeHtml(section.icon)}</div>
      <h2 class="category-title">${escapeHtml(section.title)}</h2>
      <span class="category-count">${section.tools.length} outils</span>
      <span class="category-desc">${escapeHtml(section.desc)}</span>
    </div>
    <div class="tools-grid">
      ${section.tools.map(renderToolCard).join('\n')}
    </div>
  </section>`;
}

function renderCrudRows(rows) {
  return rows
    .map(
      (row) => `<tr data-search="${escapeHtml(`${row.entity} ${row.source} ${row.ops.join(' ')}`)}">
      <td class="entity-name">${escapeHtml(row.entity)}</td>
      <td>${escapeHtml(row.source)}</td>
      <td>
        <div class="crud-ops">${row.ops
          .map((op) => `<span class="crud-op">${escapeHtml(op)}</span>`)
          .join('')}</div>
      </td>
    </tr>`
    )
    .join('\n');
}

function renderIndexRows(rows) {
  return rows
    .map(
      (row) => `<tr data-search="${escapeHtml(`${row.name} ${row.categoryTitle} ${row.source}`)}">
      <td class="index-tool">${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.categoryTitle)}</td>
      <td>${escapeHtml(row.source)}</td>
    </tr>`
    )
    .join('\n');
}

function buildHtml(data) {
  const navButtons = [
    `<button class="nav-btn active" data-target="all">Tous</button>`,
    ...data.businessSections.map(
      (section) =>
        `<button class="nav-btn" data-target="${escapeHtml(section.slug)}">${escapeHtml(section.title)}</button>`
    ),
    `<button class="nav-btn" data-target="crud_entities">Entités CRUD</button>`,
    `<button class="nav-btn" data-target="tool_index">Index complet</button>`,
  ].join('\n');

  const sectionsHtml = data.businessSections.map(renderSection).join('\n');

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CashPilot MCP - Catalogue des outils</title>
    <style>
      :root { --bg:#0f172a; --surface:#1e293b; --surface2:#334155; --border:#475569; --text:#e2e8f0; --text-muted:#94a3b8; --accent:#38bdf8; }
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:Inter,Segoe UI,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
      .hero { padding:2rem; border-bottom:1px solid var(--border); text-align:center; background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%); }
      .hero-logo { font-size:2.2rem; font-weight:800; color:var(--accent); }
      .hero-sub { color:var(--text-muted); margin:.4rem auto 1rem; max-width:820px; }
      .hero-stats { display:flex; flex-wrap:wrap; justify-content:center; gap:1.2rem; }
      .stat { min-width:120px; }
      .stat-number { font-weight:700; font-size:1.6rem; color:var(--accent); }
      .stat-label { font-size:.75rem; color:var(--text-muted); text-transform:uppercase; }
      .search-container { max-width:760px; margin:1rem auto 0; }
      .search-input { width:100%; padding:.7rem .9rem; border:1px solid var(--border); border-radius:.6rem; background:var(--surface); color:var(--text); }
      .search-count { margin-top:.5rem; color:var(--text-muted); font-size:.85rem; }
      .nav { position:sticky; top:0; z-index:10; border-bottom:1px solid var(--border); backdrop-filter: blur(8px); background:rgba(15,23,42,.9); }
      .nav-inner { max-width:1400px; margin:0 auto; padding:.65rem 1rem; display:flex; flex-wrap:wrap; gap:.45rem; justify-content:center; }
      .nav-btn { border:1px solid var(--border); border-radius:999px; background:transparent; color:var(--text-muted); padding:.34rem .75rem; font-size:.8rem; cursor:pointer; }
      .nav-btn.active { background:var(--accent); border-color:var(--accent); color:#0f172a; }
      .main { max-width:1400px; margin:0 auto; padding:1.3rem; }
      .category { margin-bottom:2rem; }
      .category-header { display:flex; align-items:center; gap:.6rem; border-bottom:1px solid var(--surface2); padding-bottom:.5rem; margin-bottom:.8rem; flex-wrap:wrap; }
      .category-icon { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(56,189,248,.12); }
      .category-title { font-size:1.2rem; }
      .category-count { color:var(--text-muted); background:var(--surface2); border-radius:999px; padding:.1rem .5rem; font-size:.75rem; }
      .category-desc { color:var(--text-muted); font-size:.84rem; }
      .tools-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:.75rem; }
      .tool-card { border:1px solid var(--surface2); background:var(--surface); border-radius:.6rem; padding:.85rem; }
      .tool-name { font-family:ui-monospace,Consolas,monospace; color:var(--accent); font-weight:700; font-size:.86rem; }
      .tool-desc { margin-top:.4rem; color:var(--text-muted); font-size:.82rem; }
      .table-wrap { overflow:auto; border:1px solid var(--surface2); border-radius:.6rem; }
      table { width:100%; min-width:720px; border-collapse:collapse; }
      th,td { border-bottom:1px solid var(--surface2); padding:.55rem .6rem; text-align:left; font-size:.84rem; }
      th { background:var(--surface); color:var(--text-muted); text-transform:uppercase; font-size:.72rem; }
      .crud-ops { display:flex; gap:.35rem; flex-wrap:wrap; }
      .crud-op { border:1px solid rgba(56,189,248,.3); color:var(--accent); background:rgba(56,189,248,.12); border-radius:999px; font-size:.68rem; padding:.08rem .45rem; }
      .index-tool, .entity-name { font-family:ui-monospace,Consolas,monospace; color:var(--accent); }
      .footer { border-top:1px solid var(--border); padding:1rem; text-align:center; color:var(--text-muted); font-size:.8rem; }
      @media (max-width: 760px) { .hero { padding:1.3rem .9rem; } .main { padding:.8rem; } .stat-number { font-size:1.25rem; } }
    </style>
  </head>
  <body>
    <header class="hero">
      <div class="hero-logo">CashPilot MCP</div>
      <p class="hero-sub">Liste générée automatiquement depuis <code>mcp-server/src</code> (source de vérité). Bloc <code>if (false)</code> exclu.</p>
      <div class="hero-stats">
        <div class="stat"><div class="stat-number">${data.stats.total}</div><div class="stat-label">Outils total</div></div>
        <div class="stat"><div class="stat-number">${data.stats.business}</div><div class="stat-label">Outils métier</div></div>
        <div class="stat"><div class="stat-number">${data.stats.crud}</div><div class="stat-label">Opérations CRUD</div></div>
        <div class="stat"><div class="stat-number">${data.stats.entities}</div><div class="stat-label">Entités CRUD</div></div>
        <div class="stat"><div class="stat-number">${data.stats.categories}</div><div class="stat-label">Catégories</div></div>
      </div>
      <div class="search-container">
        <input type="text" class="search-input" id="searchInput" placeholder="Rechercher un tool, une catégorie, une entité..." autocomplete="off" />
        <div class="search-count" id="searchCount"></div>
      </div>
    </header>

    <nav class="nav">
      <div class="nav-inner">
        ${navButtons}
      </div>
    </nav>

    <main class="main">
      ${sectionsHtml}

      <section class="category" data-cat="crud_entities" id="cat-crud_entities">
        <div class="category-header">
          <div class="category-icon">⚙️</div>
          <h2 class="category-title">Entités CRUD générées</h2>
          <span class="category-count">${data.stats.entities} entités</span>
          <span class="category-desc">Core, RH, CRM/Projets/Matériel</span>
        </div>
        <div class="table-wrap">
          <table class="crud-table">
            <thead>
              <tr><th>Entité</th><th>Source</th><th>Opérations</th></tr>
            </thead>
            <tbody>
              ${renderCrudRows(data.crudEntities)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="category" data-cat="tool_index" id="cat-tool_index">
        <div class="category-header">
          <div class="category-icon">🧭</div>
          <h2 class="category-title">Index complet des tools</h2>
          <span class="category-count">${data.stats.total} tools</span>
          <span class="category-desc">Noms exacts exposés par le serveur</span>
        </div>
        <div class="table-wrap">
          <table class="index-table">
            <thead>
              <tr><th>Tool</th><th>Catégorie</th><th>Fichier source</th></tr>
            </thead>
            <tbody>
              ${renderIndexRows(data.allTools)}
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <footer class="footer">
      Généré automatiquement depuis le code source MCP CashPilot.
    </footer>

    <script>
      (function () {
        const searchInput = document.getElementById('searchInput');
        const searchCount = document.getElementById('searchCount');
        const categories = Array.from(document.querySelectorAll('.category'));
        const cards = Array.from(document.querySelectorAll('.tool-card'));
        const tableRows = Array.from(document.querySelectorAll('.crud-table tbody tr, .index-table tbody tr'));
        const navButtons = Array.from(document.querySelectorAll('.nav-btn'));

        function applySearch() {
          const q = (searchInput.value || '').toLowerCase().trim();
          let visible = 0;

          cards.forEach((card) => {
            const txt = (card.getAttribute('data-search') || '') + ' ' + card.textContent;
            const match = !q || txt.toLowerCase().includes(q);
            card.style.display = match ? '' : 'none';
            if (match) visible += 1;
          });

          tableRows.forEach((row) => {
            const txt = (row.getAttribute('data-search') || '') + ' ' + row.textContent;
            const match = !q || txt.toLowerCase().includes(q);
            row.style.display = match ? '' : 'none';
            if (match) visible += 1;
          });

          categories.forEach((category) => {
            const hasVisibleCard = Array.from(category.querySelectorAll('.tool-card')).some((el) => el.style.display !== 'none');
            const hasVisibleRow = Array.from(category.querySelectorAll('tbody tr')).some((el) => el.style.display !== 'none');
            category.style.display = hasVisibleCard || hasVisibleRow ? '' : 'none';
          });

          searchCount.textContent = q ? (visible + ' résultat(s) pour \"' + q + '\"') : '';
        }

        navButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            navButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            if (target === 'all') {
              categories.forEach((category) => { category.style.display = ''; });
            } else {
              categories.forEach((category) => {
                category.style.display = category.getAttribute('data-cat') === target ? '' : 'none';
              });
            }

            searchInput.value = '';
            searchCount.textContent = '';
            cards.forEach((card) => (card.style.display = ''));
            tableRows.forEach((row) => (row.style.display = ''));
          });
        });

        searchInput.addEventListener('input', applySearch);
      })();
    </script>
  </body>
</html>`;

  return html;
}

const data = buildData();
const html = buildHtml(data);
fs.writeFileSync(outputHtml, html, 'utf8');

console.log(`Generated ${path.relative(repoRoot, outputHtml)}`);
console.log(
  `Stats => total=${data.stats.total}, business=${data.stats.business}, crud=${data.stats.crud}, entities=${data.stats.entities}`
);
