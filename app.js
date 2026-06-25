const DATA_FILE = './base-conhecimento-inpi.csv';
const PAGE_SIZE = 40;

const state = {
  allRows: [],
  filteredRows: [],
  visibleCount: PAGE_SIZE,
  selectedTema: '',
};

const els = {
  searchInput: document.querySelector('#searchInput'),
  temaButtons: document.querySelector('#temaButtons'),
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
    state.filteredRows = [];

    renderTemaButtons(uniqueValues(state.allRows, 'tema_macro'));

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

  els.loadMoreBtn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderResults();
  });
}

function applyFilters() {
  const term = els.searchInput.value.trim().toLowerCase();
  const tema = state.selectedTema;

  if (!term) {
    state.filteredRows = [];
    renderStats();
    renderResults();
    return;
  }

  state.filteredRows = state.allRows.filter((row) => {
    if (tema && row.tema_macro !== tema) return false;

    const haystack = [
      row.titulo_item,
      row.conteudo,
      row.resumo_ia,
      row.intencao_consulta_ia,
      row.orientacao_ao_usuario_ia,
      row.termos_sugeridos_ia,
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

  if (!term) {
    els.resultInfo.textContent = 'Digite sua consulta para visualizar resultados.';
    els.loadMoreBtn.disabled = true;
    els.loadMoreBtn.textContent = 'Carregar mais';
    return;
  }

  for (const row of visible) {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);

    const excerpt = row.conteudo || row.resumo_ia || '';
    const orientation = row.orientacao_ao_usuario_ia || '';
    const terms = row.termos_sugeridos_ia || '';
    const link = row.link || '';

    node.querySelector('.result-meta').textContent = `${row.tema_macro || 'Sem tema'} | ${row.intencao_consulta_ia || 'Consulta geral'}`;
    node.querySelector('.result-content').innerHTML = highlight(escapeHtml(excerpt), term);

    const guidanceNode = node.querySelector('.result-guidance');
    guidanceNode.innerHTML = orientation
      ? `<strong>Orientação:</strong> ${highlight(escapeHtml(orientation), term)}`
      : '';

    const termsNode = node.querySelector('.result-terms');
    termsNode.textContent = terms ? `Termos sugeridos: ${terms}` : '';

    const linkAnchor = node.querySelector('.result-link');
    const linkWrap = node.querySelector('.result-link-wrap');
    if (link) {
      linkAnchor.href = link;
      linkAnchor.textContent = 'Acessar fonte';
      linkWrap.style.display = 'block';
    } else {
      linkWrap.style.display = 'none';
    }

    node.querySelector('.result-ref').textContent = row.referencia || '';

    els.resultsContainer.appendChild(node);
  }

  const showing = Math.min(state.visibleCount, total);
  els.resultInfo.textContent = `${showing.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros exibidos`;

  const hasMore = showing < total;
  els.loadMoreBtn.disabled = !hasMore;
  els.loadMoreBtn.textContent = hasMore ? 'Carregar mais' : 'Fim dos resultados';
}

function renderTemaButtons(values) {
  const allBtn = buildTemaButton('Todos', '');
  allBtn.classList.add('active');
  els.temaButtons.appendChild(allBtn);

  for (const value of values) {
    els.temaButtons.appendChild(buildTemaButton(value, value));
  }
}

function buildTemaButton(label, value) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tema-btn';
  btn.textContent = formatTemaLabel(label);
  btn.dataset.tema = value;
  btn.addEventListener('click', () => {
    state.selectedTema = value;
    state.visibleCount = PAGE_SIZE;
    document.querySelectorAll('.tema-btn').forEach((node) => node.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });
  return btn;
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => (row[key] || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

function formatTemaLabel(label) {
  const map = {
    'Carta de Servicos': 'Carta de Serviços',
    'Desenhos Industriais': 'Desenhos Industriais',
    'Glossario de PI': 'Glossário de PI',
    'Governanca e Visao Sistematica': 'Governança e Visão Sistemática',
    'Indicacoes Geograficas': 'Indicações Geográficas',
    'Legislacao e Normas': 'Legislação e Normas',
    'Marcas': 'Marcas',
    'Pareceres Juridicos': 'Pareceres Jurídicos',
    'Patentes': 'Patentes',
    'Programas de Computador': 'Programas de Computador',
    'Retribuicoes e Taxas': 'Retribuições e Taxas',
    'Topografias de Circuitos Integrados': 'Topografias de Circuitos Integrados',
    'Contratos de Tecnologia': 'Contratos de Tecnologia',
    'Todos': 'Todos',
  };

  return map[label] || label;
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

function escapeHtml(text) {
  return String(text || '')
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
