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
//
// ── Recalibrado em 09/09/2026, com os payloads das execucoes 2318/2328/2329 ──
//
// A versao anterior errava DOIS casos reais, e por motivos opostos:
//
// 1. Pedido 'The Assassin' (2015), o de Hou Hsiao-hsien. NINGUEM casava exato
//    (o original e chines, e o TMDB devolveu 'A Assassina' em pt-BR). A decisao
//    caiu inteira na popularidade, e 'The Sand' — terror B, IMDb 3.8 — ganhou
//    por 14.1 a 7.8. Um filme errado venceu um vencedor de Cannes porque
//    'popularity' do TMDB mede acesso recente, nao importancia.
//
// 2. Pedido 'Burning' (2018), o de Lee Chang-dong. Um registro hindi vazio
//    (id 813106: SEM genero, SEM sinopse, 6 votos) tem original_title
//    literalmente 'Burning' e levou o +60 de exato, fechando 103.2 contra 64.4
//    do filme certo (id 491584, 1883 votos) — cujo original_title e '버닝' e
//    portanto NAO casa. Titulo exato premiava o homonimo obscuro.
//
// As tres mudancas, cada uma contra um desses numeros:
//
// a) 'popularity' cai de *2 (ate +40) para *0.5 (ate +10). Ela e o sinal mais
//    volatil do TMDB e era o maior peso da formula; virou desempate, que e o
//    papel que o comentario acima ja dizia que ela tinha.
// b) 'vote_count' passa a valer ate +45, por log. Votos sao o sinal que melhor
//    separa filme real de registro-fantasma, e valiam no maximo +20 — na
//    pratica, decimos. Log e nao linear porque a diferenca que importa e entre
//    6 e 1883 votos, nao entre 3000 e 5000.
// c) Casamento exato com registro SEM GENERO nao ganha o bonus cheio. Medicao
//    de 09/09/2026 sobre 56 filmes legitimos — incluindo cinema africano e
//    tailandes com 1 a 39 votos: NENHUM tinha genre_ids vazio. Registro sem
//    genero no TMDB e cadastro incompleto, nao filme obscuro, e essa e a
//    distincao que um piso de votos nao conseguiria fazer sem cortar o acervo
//    de arte que o produto existe para defender (por isso piso foi descartado).
function pontuar(r, pedido) {
  const alvo = normalizar(pedido.originalTitle);
  const ano = Number(String(r.release_date || '').slice(0, 4)) || null;
  const distancia = (pedido.year && ano) ? Math.abs(ano - pedido.year) : 99;
  const exato = normalizar(r.original_title) === alvo || normalizar(r.title) === alvo;

  // Cadastro incompleto: sem genero E sem voto nenhum. Os dois juntos, porque
  // filme de arte recem-catalogado pode ter zero voto e ainda ter genero.
  const generos = Array.isArray(r.genre_ids) ? r.genre_ids : [];
  const votos = Math.max(Number(r.vote_count) || 0, 0);
  const fantasma = generos.length === 0 && votos < 10;

  let nota = 0;
  if (exato) nota += fantasma ? 15 : 60;
  if (distancia === 0) nota += 40;
  else if (distancia <= 1) nota += 20;
  else if (distancia > 3) nota -= 40;
  nota += Math.min(Number(r.popularity) || 0, 20) * 0.5;
  // log10(1884) ~ 3.27, entao ~+45 para um filme muito votado e ~+8 para 6
  // votos. O +1 evita log(0).
  nota += Math.min(Math.log10(votos + 1) * 14, 45);
  return { r: r, nota: nota, exato: exato, distancia: distancia };
}

// Dois titulos DIFERENTES do curador podem cair no mesmo filme. Aconteceu na
// execucao 1874 (03/09/2026): 'Sombras' e outro pedido resolveram ambos para
// o tmdb_id 84956 (Schatten). O prompt proibe repetir filme, mas a colisao
// nasce DEPOIS, na resolucao do TMDB, onde o prompt nao alcanca.
//
// E nao era so um card repetido: o 'Gravar L2' faz INSERT ... ON CONFLICT DO
// UPDATE, e o Postgres recusa a mesma chave duas vezes no mesmo comando com
// "cannot affect row a second time". O workflow morria, e o webhook devolvia
// 200 com corpo VAZIO — que no BFF vira "Falha de rede", mensagem que nao
// tem nada a ver com o que aconteceu. Deduplicar aqui e o unico lugar que
// conserta os dois sintomas de uma vez: e aqui que o id passa a existir.
//
// Fica o de melhor rank, que e a ordem em que o curador defenderia.
const vistos = Object.create(null);
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

  if (vistos[melhor.r.id]) continue;
  vistos[melhor.r.id] = true;

  saida.push({ json: Object.assign({}, pedido, { tmdbId: melhor.r.id }) });
}

// Zero confirmados NAO e erro — e o caso-limite da mesma regra da linha 105.
// "Buraco assumido e melhor que card errado" vale para um titulo e vale para
// todos: se nenhum passou, a resposta honesta e uma colecao vazia com a lista
// do que foi descartado, que e exatamente o que types.ts:287 ja documenta como
// "200, nao erro". Ate 09/09/2026 isto lancava, e o throw tornava aquele 200
// inalcancavel — o contrato se contradizia, e quem pagava era o usuario: o
// workflow morria sem passar pelo 'Responder', o webhook pendurava, e o BFF
// desistia em 45 s dizendo "A busca demorou demais" sobre uma falha que o
// sistema conheceu em ~3 s.
//
// Devolver [] aqui NAO resolveria: um no Code que devolve zero itens interrompe
// o ramo em silencio e reproduz o mesmo 504. Por isso sai um item marcado, e um
// IF ('Achou algum?') desvia para 'Montar resposta', que ja sabe montar este
// caso — o bloco naoAchados filtra pedidos sem correspondencia, e com zero
// casados devolve todos naturalmente.
if (!saida.length) {
  return [{ json: { vazio: true } }];
}
return saida;
