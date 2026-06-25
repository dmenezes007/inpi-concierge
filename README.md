# INPI Concierge

Aplicacao web estatica para consulta da base consolidada de Propriedade Intelectual do INPI, usando o arquivo `base-conhecimento-inpi.csv` via `fetch` no navegador.

## Arquivos principais

- `index.html`: estrutura da interface
- `styles.css`: design system inspirado no padrao visual do projeto `pgc-inpi`
- `app.js`: carregamento, parsing CSV, filtros e renderizacao dos resultados
- `base-conhecimento-inpi.csv`: base de conhecimento consolidada
- `vercel.json`: configuracao para deploy na Vercel

## Como funciona

1. O navegador carrega `base-conhecimento-inpi.csv`.
2. O parser de CSV em `app.js` transforma o arquivo em objetos.
3. A interface aplica busca textual e filtros por:
   - tema macro
   - arquivo de origem
   - tipo de item
   - formato de origem
4. Os resultados sao renderizados com paginacao incremental.

## Deploy na Vercel

1. Conecte o repositorio `dmenezes007/inpi-concierge` na Vercel.
2. Framework preset: `Other`.
3. Build command: vazio.
4. Output directory: raiz do repositorio.
5. Deploy.

A aplicacao e estatica e nao requer Node.js em runtime.
