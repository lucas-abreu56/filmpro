// A lógica de `Escolher correspondencia`, isolada para poder ser testada.
//
// ── Leia antes de editar ────────────────────────────────────────────────────
//
// O nó do n8n NÃO importa este arquivo: nó Code não resolve import do
// repositório. O corpo destas funções é COPIADO para o `jsCode` do nó.
//
// Isso parece o mesmo problema das cinco cópias de sanitização — e é, com uma
// diferença que decide tudo: aqui a cópia é **verificada**. O teste de paridade
// (`paridade.test.js`) compara os dois lados e falha quando um muda sozinho.
// Antes, a lógica não tinha teste algum e a divergência seria invisível.
//
// Por isso o estilo é ES5-ish (`var`/`function`, sem optional chaining), igual
// ao sandbox do n8n: o corpo tem de poder ser colado lá **sem tradução**.
// Tradução à mão é onde a divergência nasce.
//
// Mora em `n8n/logica/` e não em `n8n/nos/` porque
// `scripts/exportar-workflow.mjs` apaga `nos/` inteiro a cada exportação.

/** Tira acento e pontuação para comparar títulos de idiomas diferentes. */
function normalizar(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Nota de um candidato do TMDB contra o título que o curador pediu.
 *
 * A calibração e o porquê de cada peso estão no comentário do próprio nó
 * (`n8n/nos/escolher-correspondencia.js`), com os números das execuções que os
 * justificam. Resumo: `popularity` mede acesso recente e não importância,
 * então vale pouco; `vote_count` separa filme real de registro-fantasma, então
 * vale muito, por log; e casamento exato com cadastro incompleto não ganha o
 * bônus cheio, porque foi assim que um filme hindi vazio de 6 votos venceu o
 * Lee Chang-dong de 1883.
 */
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

/**
 * Resolve os títulos do curador em ids do TMDB.
 *
 * Recebe arrays puros (`pedidos` na ordem, `respostas[i].results` do TMDB) em
 * vez de ler `$('Nó')`, para poder rodar fora do n8n. No nó, as duas primeiras
 * linhas fazem essa ponte; daqui para baixo o código é o mesmo.
 *
 * Devolve `{ saida, vazio }` — e **não lança** quando nada confirma. O nó é
 * que decide o que fazer com a lista vazia; `types.ts` documenta esse caso
 * como "200, não erro".
 */
function escolher(pedidos, respostas) {
  const vistos = Object.create(null);
  const saida = [];
  for (let i = 0; i < pedidos.length; i++) {
    const pedido = pedidos[i];
    const resultados = (respostas[i] && Array.isArray(respostas[i].results))
      ? respostas[i].results : [];
    if (!resultados.length) continue;

    const melhor = resultados
      .map(function (r) { return pontuar(r, pedido); })
      .sort(function (a, b) { return b.nota - a.nota; })[0];

    // Sem titulo exato E sem ano proximo, e outro filme. Buraco assumido e
    // melhor que card errado — a interface conta quantos foram descartados.
    if (!melhor.exato && melhor.distancia > 1) continue;

    // Dois titulos DIFERENTES do curador podem cair no mesmo filme (execucao
    // 1874). Alem do card repetido, o `Gravar L2` faz INSERT ... ON CONFLICT
    // DO UPDATE, e o Postgres recusa a mesma chave duas vezes no mesmo
    // comando com "cannot affect row a second time".
    if (vistos[melhor.r.id]) continue;
    vistos[melhor.r.id] = true;

    saida.push(Object.assign({}, pedido, { tmdbId: melhor.r.id }));
  }
  return { saida: saida, vazio: saida.length === 0 };
}

export { normalizar, pontuar, escolher };
