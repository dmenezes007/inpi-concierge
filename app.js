const DATA_FILE = './base-conhecimento-inpi.json';
const PAGE_SIZE = 40;

const state = {
  allRows: [],
  filteredRows: [],
  visibleCount: PAGE_SIZE,
  selectedTemas: [],
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
    if (!response.ok) throw new Error(`Falha ao carregar base (${response.status})`);

    const jsonData = await response.json();
    state.allRows = normalizeRows(jsonData);
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
  const hasTemaFilter = state.selectedTemas.length > 0;

  if (!term && !hasTemaFilter) {
    state.filteredRows = [];
    renderStats();
    renderResults();
    return;
  }

  state.filteredRows = state.allRows.filter((row) => {
    if (hasTemaFilter && !state.selectedTemas.includes(row.tema_macro)) return false;

    const haystack = [
      row.titulo_item,
      row.conteudo,
      (row.conteudo_blocos || []).join(' '),
      row.resumo_ia,
      row.intencao_consulta_ia,
      row.orientacao_ao_usuario_ia,
      row.termos_sugeridos_ia,
      row.secao,
      row.palavras_chave,
      row.fonte_arquivo,
      row.tema_macro,
      Object.values(row.dados_csv || {}).join(' '),
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
    { label: 'Registros localizados', value: rows.length.toLocaleString('pt-BR') },
    { label: 'Fontes consultadas', value: uniqueValues(rows, 'fonte_arquivo').length.toLocaleString('pt-BR') },
    { label: 'Temas associados', value: uniqueValues(rows, 'tema_macro').length.toLocaleString('pt-BR') },
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

    const contentBlocks = Array.isArray(row.conteudo_blocos) && row.conteudo_blocos.length
      ? row.conteudo_blocos
      : [row.conteudo || row.resumo_ia || ''];
    const orientation = (row.orientacao_ao_usuario_ia || '').replace(/\s*Referência:\s*.*$/i, '').trim();
    const link = row.link || '';

    node.querySelector('.result-meta').textContent = `${row.tema_macro || 'Sem tema'} | ${row.intencao_consulta_ia || 'Consulta geral'}`;

    const bodyNode = node.querySelector('.result-body');
    bodyNode.innerHTML = '';
    if (row.fonte_tipo === 'csv' && row.dados_csv && Object.keys(row.dados_csv).length) {
      bodyNode.appendChild(renderCsvTable(row.dados_csv, term, row.fonte_arquivo));
    } else {
      for (const block of contentBlocks) {
        if (!String(block || '').trim()) continue;
        const p = document.createElement('p');
        p.className = 'result-paragraph';
        p.innerHTML = highlight(escapeHtml(String(block)), term);
        bodyNode.appendChild(p);
      }
    }

    const guidanceNode = node.querySelector('.result-guidance');
    guidanceNode.innerHTML = orientation
      ? `<strong>Orientação:</strong> ${highlight(escapeHtml(orientation), term)}`
      : '';

    const linkAnchor = node.querySelector('.result-link-btn');
    const linkWrap = node.querySelector('.result-link-wrap');
    if (link) {
      linkAnchor.href = link;
      linkAnchor.textContent = 'Acessar fonte';
      linkWrap.style.display = 'block';
    } else {
      linkWrap.style.display = 'none';
    }

    els.resultsContainer.appendChild(node);
  }

  const showing = Math.min(state.visibleCount, total);
  els.resultInfo.textContent = `${showing.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros exibidos`;

  const hasMore = showing < total;
  els.loadMoreBtn.disabled = !hasMore;
  els.loadMoreBtn.textContent = hasMore ? 'Carregar mais' : 'Fim dos resultados';
}

function renderTemaButtons(values) {
  els.temaButtons.innerHTML = '';
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
    if (!value) {
      state.selectedTemas = [];
    } else if (state.selectedTemas.includes(value)) {
      state.selectedTemas = state.selectedTemas.filter((tema) => tema !== value);
    } else {
      state.selectedTemas = [...state.selectedTemas, value];
    }

    state.visibleCount = PAGE_SIZE;
    refreshTemaButtonsState();
    applyFilters();
  });
  return btn;
}

function refreshTemaButtonsState() {
  document.querySelectorAll('.tema-btn').forEach((node) => {
    const tema = node.dataset.tema || '';
    if (!tema) {
      node.classList.toggle('active', state.selectedTemas.length === 0);
    } else {
      node.classList.toggle('active', state.selectedTemas.includes(tema));
    }
  });
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

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    conteudo_blocos: Array.isArray(row.conteudo_blocos)
      ? row.conteudo_blocos
      : row.conteudo_blocos
        ? [String(row.conteudo_blocos)]
        : [],
    dados_csv: parseStructuredJson(row.dados_estruturados_json),
  }));
}

function parseStructuredJson(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function renderCsvTable(data, term, sourceFile) {
  const wrap = document.createElement('div');
  wrap.className = 'result-table-wrap';

  const table = document.createElement('table');
  table.className = 'result-table';

  const tbody = document.createElement('tbody');

  for (const [key, rawValue] of Object.entries(data)) {
    if (!shouldDisplayCsvField(sourceFile, key)) continue;

    const value = String(rawValue ?? '').trim();
    if (!value) continue;

    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.textContent = formatFieldLabel(key);

    const td = document.createElement('td');
    if (isLikelyUrl(value)) {
      const a = document.createElement('a');
      a.className = 'result-table-link';
      a.href = value;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = value;
      td.appendChild(a);
    } else {
      td.innerHTML = highlight(escapeHtml(value), term);
    }

    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function shouldDisplayCsvField(sourceFile, key) {
  const source = String(sourceFile || '').toLowerCase();
  const field = normalizeFieldKey(key);

  if (source === 'legislacao-inpi.csv' && ['cor', 'corsituacao', 'acesso'].includes(field)) {
    return false;
  }

  if (source === 'pareceres-pfe-inpi.csv' && field === 'link') {
    return false;
  }

  return true;
}

function normalizeFieldKey(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function isLikelyUrl(text) {
  return /^https?:\/\//i.test(text);
}

function formatFieldLabel(label) {
  const normalizedMap = {
    acesso: 'Acesso',
    link: 'Link',
    legislacao: 'Legislação',
    descricao: 'Descrição',
    situacao: 'Situação',
    numero: 'Número',
    corsituacao: 'Cor da Situação',
    temamacro: 'Tema',
    tema: 'Tema',
    tituloitem: 'Título',
    conteudo: 'Conteúdo',
    fontearquivo: 'Fonte',
    tipoitem: 'Tipo de item',
    definicao: 'Definição',
    especie: 'Espécie',
    correlacoes: 'Correlações',
  };

  const normalizedKey = normalizeFieldKey(label);
  if (normalizedMap[normalizedKey]) return normalizedMap[normalizedKey];

  const normalized = String(label || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
