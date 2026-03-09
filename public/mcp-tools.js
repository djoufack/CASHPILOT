// MCP Tools page — search & category filter
(function() {
  var searchInput = document.getElementById('searchInput');
  var searchCount = document.getElementById('searchCount');

  // Search functionality
  searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    var allCards = document.querySelectorAll('.tool-card');
    var allCrudRows = document.querySelectorAll('.crud-table tbody tr');
    var categories = document.querySelectorAll('.category');
    var visibleCount = 0;

    if (!query) {
      allCards.forEach(function(c) { c.style.display = ''; });
      allCrudRows.forEach(function(r) { r.style.display = ''; });
      categories.forEach(function(c) { c.style.display = ''; });
      searchCount.textContent = '';
      return;
    }

    // Filter tool cards
    allCards.forEach(function(card) {
      var nameEl = card.querySelector('.tool-name');
      var descEl = card.querySelector('.tool-desc');
      var searchData = (card.getAttribute('data-search') || '') + ' ' +
        (nameEl ? nameEl.textContent : '') + ' ' +
        (descEl ? descEl.textContent : '');
      var match = searchData.toLowerCase().indexOf(query) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    // Filter CRUD rows
    allCrudRows.forEach(function(row) {
      var entityEl = row.querySelector('.entity-name');
      var searchData = (row.getAttribute('data-search') || '') + ' ' +
        (entityEl ? entityEl.textContent : '') + ' ' + row.textContent;
      var match = searchData.toLowerCase().indexOf(query) !== -1;
      row.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    // Hide empty categories
    categories.forEach(function(cat) {
      var catName = cat.getAttribute('data-cat');
      if (catName === 'crud') {
        var visibleRows = cat.querySelectorAll('.crud-table tbody tr');
        var hasVisible = false;
        visibleRows.forEach(function(r) { if (r.style.display !== 'none') hasVisible = true; });
        cat.style.display = hasVisible ? '' : 'none';
      } else {
        var visibleCards = cat.querySelectorAll('.tool-card');
        var hasVisibleCard = false;
        visibleCards.forEach(function(c) { if (c.style.display !== 'none') hasVisibleCard = true; });
        cat.style.display = hasVisibleCard ? '' : 'none';
      }
    });

    searchCount.textContent = visibleCount + ' resultat' + (visibleCount > 1 ? 's' : '') + ' pour "' + query + '"';
  });

  // Category filter
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cat = this.getAttribute('data-target');
      var categories = document.querySelectorAll('.category');
      var allCards = document.querySelectorAll('.tool-card');
      var allCrudRows = document.querySelectorAll('.crud-table tbody tr');

      // Reset search
      searchInput.value = '';
      searchCount.textContent = '';
      allCards.forEach(function(c) { c.style.display = ''; });
      allCrudRows.forEach(function(r) { r.style.display = ''; });

      // Update nav buttons
      document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      if (cat === 'all') {
        categories.forEach(function(c) { c.style.display = ''; });
      } else {
        categories.forEach(function(c) {
          c.style.display = c.getAttribute('data-cat') === cat ? '' : 'none';
        });
      }

      // Scroll to top of content
      if (cat !== 'all') {
        var target = document.getElementById('cat-' + cat);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
