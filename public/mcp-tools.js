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

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
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
      String(a).localeCompare(String(b))
    );

    categorySelect.innerHTML = ['<option value="all">Toutes categories</option>']
      .concat(categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`))
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
        const tags = Array.isArray(row.tags) && row.tags.length ? row.tags : [];
        return `
          <article class="card">
            <h3>${escapeHtml(row.tool_name)}</h3>
            <p class="desc">${escapeHtml(row.description || row.display_name || 'Aucune description.')}</p>
            <div class="chips">
              <span class="chip">${escapeHtml(row.category || 'general')}</span>
              <span class="chip secondary">${escapeHtml(row.source_module || 'manual')}</span>
              ${row.is_generated ? '<span class="chip secondary">genere</span>' : '<span class="chip secondary">manuel</span>'}
              ${tags.map((tag) => `<span class="chip secondary">${escapeHtml(tag)}</span>`).join('')}
            </div>
          </article>
        `;
      })
      .join('');

    indexBodyEl.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td class="mono">${escapeHtml(row.tool_name)}</td>
            <td>${escapeHtml(row.category || '-')}</td>
            <td>${escapeHtml(row.source_module || '-')}</td>
            <td>${escapeHtml(Array.isArray(row.tags) && row.tags.length ? row.tags.join(', ') : '-')}</td>
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

    resultsMetaEl.textContent = `${filtered.length} resultat(s) sur ${allTools.length} tools actifs`;
  }

  async function load() {
    setStatus('Chargement des tools MCP depuis la base...', false);

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
        ? `Derniere mise a jour: ${formatDateTime(payload.updatedAt)}`
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
