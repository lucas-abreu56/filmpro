// Nó "Escolher correspondencia" — n8n-nodes-base.code
// O no HTTP devolve um item por item de entrada, na mesma ordem, e
// continueRegularOutput preserva essa ordem tambem em falha. E o que permite
// reassociar cada resposta ao pedido que a gerou.
const pedidos = $('Enfileirar titulos').all();
const respostas = $input.all();

function normalizar(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Medido na execucao 1660 (01/09/2026). Para 'Cure' (1997) o TMDB devolveu
// tres candidatos: 'The Cure' (1995), 'Say It, Fight It, Cure It' (1997, UM
// voto, documentario) e o do Kurosawa (1997, 856 votos), que era o pedido.
// Pegar o primeiro com o ano batendo escolhia o documentario.
//
// E comparar titulo exato NAO resolveria: o titulo original do filme certo
// esta em japones. O que separa os dois e a popularidade. Dai a pontuacao:
// ano e titulo entram, mas votos desempatam, e e o desempate que decide.
function pontuar(r, pedido) {
  const alvo = normalizar(pedido.originalTitle);
  const ano = Number(String(r.release_date || '').slice(0, 4)) || null;
  const distancia = (pedido.year && ano) ? Math.abs(ano - pedido.year) : 99;
  const exato = normalizar(r.original_title) === alvo || normalizar(r.title) === alvo;

  let nota = 0;
  if (exato) nota += 60;
  if (distancia === 0) nota += 40;
  else if (distancia <= 1) nota += 20;
  else if (distancia > 3) nota -= 40;
  nota += Math.min(Number(r.popularity) || 0, 20) * 2;
  nota += Math.min(Number(r.vote_count) || 0, 5000) / 250;
  return { r: r, nota: nota, exato: exato, distancia: distancia };
}

const saida = [];
for (let i = 0; i < pedidos.length; i++) {
  const pedido = pedidos[i].json;
  const corpo = (respostas[i] && respostas[i].json) || {};
  const resultados = Array.isArray(corpo.results) ? corpo.results : [];
  if (!resultados.length) continue;

  const melhor = resultados
    .map(function (r) { return pontuar(r, pedido); })
    .sort(function (a, b) { return b.nota - a.nota; })[0];

  // Sem titulo exato E sem ano proximo, e outro filme. Buraco assumido e
  // melhor que card errado — a interface conta quantos foram descartados.
  if (!melhor.exato && melhor.distancia > 1) continue;

  saida.push({ json: Object.assign({}, pedido, { tmdbId: melhor.r.id }) });
}
if (!saida.length) {
  throw new Error('Nenhum titulo do agente foi confirmado no TMDB.');
}
return saida;
