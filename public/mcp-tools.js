(function () {
  const searchInput = document.getElementById('searchInput');
  const categorySelect = document.getElementById('categorySelect');
  const statusEl = document.getElementById('status');
  const cardsEl = document.getElementById('cards');
  const indexBodyEl = document.getElementById('indexBody');
  const resultsMetaEl = document.getElementById('resultsMeta');

  const statTotal = document.getElementById('statTotal');
  const statCategories = document.getElementById('statCategories');
  const statGenerated = document.getElementById('statGenerated');
  const statManual = document.getElementById('statManual');

  let allTools = [];

  const CATEGORY_LABELS = {
    accounting: 'Comptabilite',
    analytics: 'Analytics',
    auth: 'Authentification',
    bank: 'Banque et rapprochement',
    cfo: 'Pilotage CFO',
    clients: 'Clients',
    company_finance: 'Finance multi-societes',
    crm: 'CRM',
    crud_core: 'CRUD coeur metier',
    crud_hr: 'CRUD ressources humaines',
    crud_projects: 'CRUD projets et materiel',
    documents: 'Documents commerciaux',
    exports: 'Exports et conformite',
    general: 'General',
    instruments: 'Instruments financiers',
    invoices: 'Facturation',
    mobile_money: 'Mobile money',
    payments: 'Paiements',
    reporting: 'Reporting',
    suppliers: 'Fournisseurs',
    syscohada: 'Conformite SYSCOHADA',
  };

  const MODULE_LABELS = {
    'server.ts': 'Serveur MCP',
    'accounting.ts': 'Comptabilite',
    'analytics.ts': 'Analytics',
    'bank-reconciliation.ts': 'Rapprochement bancaire',
    'cfo.ts': 'CFO',
    'clients.ts': 'Clients',
    'company-finance.ts': 'Finance multi-societes',
    'crm.ts': 'CRM',
    'documents.ts': 'Documents',
    'exports.ts': 'Exports',
    'financial-instruments.ts': 'Instruments financiers',
    'generated_crud.ts': 'CRUD coeur metier',
    'generated_crud_hr.ts': 'CRUD RH',
    'generated_crud_projects.ts': 'CRUD projets et materiel',
    'invoices.ts': 'Facturation',
    'mobile_money.ts': 'Mobile money',
    'payments.ts': 'Paiements',
    'reporting.ts': 'Reporting',
    'supplier-invoices.ts': 'Fournisseurs',
    'syscohada.ts': 'SYSCOHADA',
  };

  const TAG_LABELS = {
    business: 'Metier',
    crud: 'CRUD',
    system: 'Systeme',
    generated_crud: 'CRUD coeur metier',
    generated_crud_hr: 'CRUD RH',
    generated_crud_projects: 'CRUD projets et materiel',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replaceAll('-', '_');
  }

  function startCase(value) {
    return String(value || '')
      .trim()
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function categoryLabel(value) {
    const key = normalizeToken(value);
    return CATEGORY_LABELS[key] || startCase(key || 'general');
  }

  function moduleLabel(value) {
    const source = String(value || '').trim();
    if (MODULE_LABELS[source]) return MODULE_LABELS[source];
    const normalized = source.replace(/\.ts$/i, '');
    return startCase(normalized || 'manual');
  }

  function tagLabel(value) {
    const key = normalizeToken(value);
    if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
    if (TAG_LABELS[key]) return TAG_LABELS[key];
    return startCase(key);
  }

  function toolDisplayName(row) {
    const displayName = String(row.display_name || '').trim();
    if (displayName) {
      return displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
    return startCase(row.tool_name || 'Tool');
  }

  function buildVisibleKeywords(row) {
    const sourceTag = normalizeToken(String(row.source_module || '').replace(/\.ts$/i, ''));
    const categoryTag = normalizeToken(row.category);
    const hiddenTags = new Set([sourceTag, categoryTag, 'business', 'crud', 'manual']);
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const labels = [];
    const seen = new Set();

    for (const rawTag of tags) {
      const token = normalizeToken(rawTag);
      if (!token) continue;
      if (hiddenTags.has(token)) continue;
      const label = tagLabel(token);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
      if (labels.length >= 3) break;
    }

    return labels;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'status error' : 'status';
  }

  function renderCategoryOptions(rows) {
    const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b))
    );

    categorySelect.innerHTML = ['<option value="all">Tous les domaines</option>']
      .concat(
        categories.map(
          (category) => `<option value="${escapeHtml(category)}">${escapeHtml(categoryLabel(category))}</option>`
        )
      )
      .join('');
  }

  function matchesFilter(row, query, category) {
    if (category !== 'all' && row.category !== category) return false;

    if (!query) return true;

    const haystack = [
      row.tool_name,
      row.display_name,
      row.category,
      row.source_module,
      row.description,
      categoryLabel(row.category),
      moduleLabel(row.source_module),
      ...(buildVisibleKeywords(row) || []),
      ...(Array.isArray(row.tags) ? row.tags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }

  function renderRows(rows) {
    cardsEl.innerHTML = rows
      .map((row) => {
        const categoryText = categoryLabel(row.category || 'general');
        const moduleText = moduleLabel(row.source_module || 'manual');
        const modeText = row.is_generated ? 'Genere automatiquement' : 'Configure manuellement';
        const keywords = buildVisibleKeywords(row);
        return `
          <article class="card">
            <h3>${escapeHtml(toolDisplayName(row))}</h3>
            <div class="tool-id">${escapeHtml(row.tool_name)}</div>
            <p class="desc">${escapeHtml(row.description || 'Aucune description disponible.')}</p>
            <div class="chips">
              <span class="chip">${escapeHtml(categoryText)}</span>
              <span class="chip secondary">${escapeHtml(moduleText)}</span>
              <span class="chip secondary">${escapeHtml(modeText)}</span>
              ${keywords.map((keyword) => `<span class="chip secondary">${escapeHtml(keyword)}</span>`).join('')}
            </div>
          </article>
        `;
      })
      .join('');

    indexBodyEl.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>
              <div class="tool-title">${escapeHtml(toolDisplayName(row))}</div>
              <div class="tool-sub">${escapeHtml(row.tool_name)}</div>
            </td>
            <td>${escapeHtml(categoryLabel(row.category || '-'))}</td>
            <td>${escapeHtml(moduleLabel(row.source_module || '-'))}</td>
            <td>${escapeHtml(buildVisibleKeywords(row).join(', ') || '-')}</td>
            <td>${escapeHtml(formatDateTime(row.updated_at || row.last_changed_at))}</td>
          </tr>
        `
      )
      .join('');
  }

  function applyFilters() {
    const query = String(searchInput.value || '')
      .toLowerCase()
      .trim();
    const category = categorySelect.value || 'all';

    const filtered = allTools.filter((row) => matchesFilter(row, query, category));
    renderRows(filtered);

    resultsMetaEl.textContent = `${filtered.length} resultat(s) sur ${allTools.length} outils actifs`;
  }

  async function load() {
    setStatus('Chargement du catalogue MCP...', false);

    try {
      const response = await fetch('/api/mcp-tools', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Requete /api/mcp-tools en echec');
      }

      allTools = Array.isArray(payload.data) ? payload.data : [];

      renderCategoryOptions(allTools);
      applyFilters();

      const stats = payload.stats || {};
      statTotal.textContent = Number(stats.total || allTools.length);
      statCategories.textContent = Number(stats.categories || 0);
      statGenerated.textContent = Number(stats.generated || 0);
      statManual.textContent = Number(stats.manual || 0);

      const updatedLabel = payload.updatedAt
        ? `Derniere mise a jour du catalogue: ${formatDateTime(payload.updatedAt)}`
        : 'Catalogue a jour.';
      setStatus(updatedLabel, false);
    } catch (error) {
      setStatus(`Erreur de chargement: ${error.message || String(error)}`, true);
      cardsEl.innerHTML = '';
      indexBodyEl.innerHTML = '';
      resultsMetaEl.textContent = '';
      statTotal.textContent = '0';
      statCategories.textContent = '0';
      statGenerated.textContent = '0';
      statManual.textContent = '0';
    }
  }

  searchInput.addEventListener('input', applyFilters);
  categorySelect.addEventListener('change', applyFilters);

  load();
})();
