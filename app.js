const DATA_FILE = './base-conhecimento-inpi.csv';
const PAGE_SIZE = 40;

const state = {
  allRows: [],
  filteredRows: [],
  visibleCount: PAGE_SIZE,
};

const els = {
  searchInput: document.querySelector('#searchInput'),
  temaFilter: document.querySelector('#temaFilter'),
  fonteFilter: document.querySelector('#fonteFilter'),
  tipoFilter: document.querySelector('#tipoFilter'),
  formatoFilter: document.querySelector('#formatoFilter'),
  statsGrid: document.querySelector('#statsGrid'),
  resultsContainer: document.querySelector('#resultsContainer'),
  resultInfo: document.querySelector('#resultInfo'),
  loadMoreBtn: document.querySelector('#loadMoreBtn'),
  cardTemplate: document.querySelector('#resultCardTemplate'),
};

init();

async function init() {
  try {
    const response = await fetch(DATA_FILE, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha ao carregar CSV (${response.status})`);

    const csvText = await response.text();
    state.allRows = parseCSV(csvText);
    state.filteredRows = [...state.allRows];

    fillSelect(els.temaFilter, uniqueValues(state.allRows, 'tema_macro'));
    fillSelect(els.fonteFilter, uniqueValues(state.allRows, 'fonte_arquivo'));
    fillSelect(els.tipoFilter, uniqueValues(state.allRows, 'tipo_item'));
    fillSelect(els.formatoFilter, uniqueValues(state.allRows, 'fonte_tipo'));

    bindEvents();
    renderStats();
    renderResults();
  } catch (error) {
    els.resultInfo.textContent = String(error.message || error);
  }
}

function bindEvents() {
  const onFilterChange = () => {
    state.visibleCount = PAGE_SIZE;
    applyFilters();
  };

  els.searchInput.addEventListener('input', debounce(onFilterChange, 180));
  els.temaFilter.addEventListener('change', onFilterChange);
  els.fonteFilter.addEventListener('change', onFilterChange);
  els.tipoFilter.addEventListener('change', onFilterChange);
  els.formatoFilter.addEventListener('change', onFilterChange);

  els.loadMoreBtn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderResults();
  });
}

function applyFilters() {
  const term = els.searchInput.value.trim().toLowerCase();
  const tema = els.temaFilter.value;
  const fonte = els.fonteFilter.value;
  const tipo = els.tipoFilter.value;
  const formato = els.formatoFilter.value;

  state.filteredRows = state.allRows.filter((row) => {
    if (tema && row.tema_macro !== tema) return false;
    if (fonte && row.fonte_arquivo !== fonte) return false;
    if (tipo && row.tipo_item !== tipo) return false;
    if (formato && row.fonte_tipo !== formato) return false;

    if (!term) return true;

    const haystack = [
      row.titulo_item,
      row.conteudo,
      row.secao,
      row.palavras_chave,
      row.fonte_arquivo,
      row.tema_macro,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(term);
  });

  renderStats();
  renderResults();
}

function renderStats() {
  const rows = state.filteredRows;
  const stats = [
    { label: 'Registros filtrados', value: rows.length.toLocaleString('pt-BR') },
    { label: 'Arquivos cobertos', value: uniqueValues(rows, 'fonte_arquivo').length.toLocaleString('pt-BR') },
    { label: 'Temas macro', value: uniqueValues(rows, 'tema_macro').length.toLocaleString('pt-BR') },
    { label: 'Tipos de item', value: uniqueValues(rows, 'tipo_item').length.toLocaleString('pt-BR') },
  ];

  els.statsGrid.innerHTML = stats
    .map(
      (s) => `
      <article class="stat">
        <p class="stat-label">${escapeHtml(s.label)}</p>
        <p class="stat-value">${escapeHtml(s.value)}</p>
      </article>
    `,
    )
    .join('');
}

function renderResults() {
  const total = state.filteredRows.length;
  const visible = state.filteredRows.slice(0, state.visibleCount);
  const term = els.searchInput.value.trim();

  els.resultsContainer.innerHTML = '';

  for (const row of visible) {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);

    const title = row.titulo_item || row.secao || row.tipo_item || 'Registro sem titulo';
    const excerpt = truncate(row.conteudo || '', 520);

    node.querySelector('.result-title').innerHTML = highlight(escapeHtml(title), term);
    node.querySelector('.result-meta').textContent = `${row.tema_macro || 'Sem tema'} | ${row.fonte_arquivo || 'Fonte nao identificada'} | ${row.tipo_item || 'item'}`;
    node.querySelector('.result-content').innerHTML = highlight(escapeHtml(excerpt), term);
    node.querySelector('.result-ref').textContent = row.referencia || '';

    els.resultsContainer.appendChild(node);
  }

  const showing = Math.min(state.visibleCount, total);
  els.resultInfo.textContent = `${showing.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros exibidos`;

  const hasMore = showing < total;
  els.loadMoreBtn.disabled = !hasMore;
  els.loadMoreBtn.textContent = hasMore ? 'Carregar mais' : 'Fim dos resultados';
}

function fillSelect(select, values) {
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => (row[key] || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

function parseCSV(csvText) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  const text = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = (rows.shift() || []).map((h) => h.trim());
  return rows.map((cols) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (cols[index] || '').trim();
    });
    return obj;
  });
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlight(htmlText, term) {
  if (!term) return htmlText;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return htmlText.replace(regex, '<mark>$1</mark>');
}

function debounce(fn, waitMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
