// Nó "Montar linhas" — n8n-nodes-base.code
// Reassocia resposta a pedido pela ORDEM, do mesmo jeito que 'Escolher
// correspondencia' faz: o no HTTP devolve um item por item de entrada, na
// mesma ordem, e continueRegularOutput preserva isso tambem em falha.
const pedidos = $('Enfileirar temas').all().map(function (i) { return i.json; });
const respostas = $input.all().map(function (i) { return i.json; });

// Fileira curta parece defeito na tela. Se um tema so rendeu 5 filmes, e
// melhor a semana ter 4 fileiras cheias que 5 com uma capenga.
const MINIMO = 6;

// O n8n embrulha a falha num OBJETO, nao numa string. A primeira versao disto
// fazia String(e) e escrevia '[object Object]' cinco vezes: a mensagem que
// existia para explicar a falha nao explicava nada, e custou duas rodadas de
// diagnostico em 05/09/2026. O erro real estava em e.message — era
// 'connect ECONNREFUSED 127.0.1.1:443'.
function descrever(e) {
  if (e == null) return 'sem detalhe';
  if (typeof e === 'string') return e.slice(0, 200);
  const partes = [e.code, e.httpCode, e.message, e.description]
    .filter(function (p) { return p; })
    .map(function (p) { return String(p); });
  if (partes.length) return partes.join(' — ').slice(0, 200);
  try { return JSON.stringify(e).slice(0, 200); } catch (x) { return 'erro nao serializavel'; }
}

const linhas = [];
const recusados = [];
for (let i = 0; i < pedidos.length; i++) {
  const r = respostas[i];
  const motivo = !r ? 'sem resposta'
    : r.error ? descrever(r.error)
    : !Array.isArray(r.movies) ? ('resposta sem movies: ' + descrever(r))
    : r.movies.length < MINIMO ? ('so ' + r.movies.length + ' filmes')
    : null;
  if (motivo) { recusados.push('posicao ' + pedidos[i].position + ': ' + motivo); continue; }
  linhas.push({
    position: pedidos[i].position,
    theme: pedidos[i].tema,
    title: r.collectionTitle,
    // Rotulo curto da fileira. Guardado cru, como theme e title — a sanitizacao
    // roda na leitura ('Montar fileiras') e de novo no Next.
    label: pedidos[i].rotulo || null,
    // Mesmo formato de search_cache.picks, com rank base zero, para a leitura
    // da home poder usar a mesma logica de montagem.
    picks: r.movies.map(function (m, k) {
      return { tmdb_id: m.tmdbId, reason: m.reason, rank: k };
    }),
  });
}

// Se NADA sobreviveu, falhar alto: a home cai para a semana anterior sozinha,
// e a execucao vermelha e o unico sinal de que a semana nao aconteceu.
if (!linhas.length) {
  throw new Error('Nenhuma fileira sobreviveu. ' + recusados.join(' | '));
}
return [{ json: { linhas: linhas, recusados: recusados } }];
