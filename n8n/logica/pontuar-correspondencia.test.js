/**
 * Testes de mesa da resolução de títulos no TMDB.
 *
 * Cada caso aqui é um defeito que JÁ aconteceu em produção, com o payload da
 * execução que o revelou. Não são exemplos inventados: são a regressão que a
 * calibração de 09/09/2026 (commit 436a8c1) consertou, mais o caso mais antigo
 * que ela não podia quebrar.
 *
 * Os campos dos candidatos são os que `pontuar()` lê — `original_title`,
 * `title`, `release_date`, `vote_count`, `popularity`, `genre_ids`. O resto da
 * resposta do TMDB foi omitido de propósito: incluir campo que a função ignora
 * dá a impressão falsa de que ele importa.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { escolher, normalizar, pontuar } from "./pontuar-correspondencia.js";

/** Ordena como o nó ordena e devolve o vencedor. */
function vencedor(candidatos, pedido) {
  return candidatos
    .map((r) => pontuar(r, pedido))
    .sort((a, b) => b.nota - a.nota)[0].r;
}

describe("pontuar — o filme certo vence o homônimo obscuro", () => {
  it("'The Assassin' (2015) resolve para Hou Hsiao-hsien, não para o terror B", () => {
    // Execuções 2318/2328. O curador pediu o vencedor de Cannes; o sistema
    // entregava 'The Sand' (IMDb 3.8) descrito como "filme de época taiwanês".
    // Ninguém casa exato aqui: o original é chinês e o TMDB devolveu o título
    // em pt-BR. A decisão caía inteira na popularidade — 14.1 contra 7.8.
    const candidatos = [
      { id: 347847, original_title: "The Sand", title: "A Praia Assassina", release_date: "2015-08-28", vote_count: 281, popularity: 7.03, genre_ids: [27, 878, 35] },
      { id: 253450, original_title: "刺客聶隱娘", title: "A Assassina", release_date: "2015-08-27", vote_count: 574, popularity: 3.9, genre_ids: [28, 18, 36] },
      { id: 345991, original_title: "Pearl: The Assassin", title: "Pearl: The Assassin", release_date: "2015-06-09", vote_count: 4, popularity: 1.11, genre_ids: [28] },
      { id: 326057, original_title: "Assassin", title: "Assassin", release_date: "2015-03-09", vote_count: 35, popularity: 1.63, genre_ids: [28] },
    ];
    assert.equal(
      vencedor(candidatos, { originalTitle: "The Assassin", year: 2015 }).id,
      253450,
    );
  });

  it("'Burning' (2018) resolve para Lee Chang-dong, não para o registro vazio", () => {
    // Execução 2329. O id 813106 é um cadastro hindi SEM gênero, SEM sinopse,
    // com 6 votos — e `original_title` literalmente "Burning", o que lhe dava
    // o +60 de título exato. O filme certo tem original coreano e não casa:
    // 103.2 contra 64.4, apesar de 1883 votos contra 6.
    const candidatos = [
      { id: 813106, original_title: "Burning", title: "Burning", release_date: "2018-11-20", vote_count: 6, popularity: 1.59, genre_ids: [] },
      { id: 491584, original_title: "버닝", title: "Em Chamas", release_date: "2018-05-17", vote_count: 1883, popularity: 8.44, genre_ids: [9648, 18, 53] },
      { id: 467240, original_title: "Burning Shadow", title: "Sombra Ardente", release_date: "2018-08-07", vote_count: 19, popularity: 1.24, genre_ids: [27] },
      { id: 706449, original_title: "Highbushes burning", title: "Highbushes burning", release_date: "2018-12-24", vote_count: 0, popularity: 1.1, genre_ids: [] },
    ];
    assert.equal(
      vencedor(candidatos, { originalTitle: "Burning", year: 2018 }).id,
      491584,
    );
  });

  it("REGRESSÃO: 'Cure' (1997) segue resolvendo para o Kurosawa", () => {
    // Execução 1660, de 01/09/2026 — o caso que a fórmula ANTIGA já acertava.
    // Um documentário homônimo de 1 voto não pode vencer o filme de 856.
    const candidatos = [
      { id: 9822, original_title: "The Cure", title: "O Segredo", release_date: "1995-04-21", vote_count: 400, popularity: 5.0, genre_ids: [18] },
      { id: 999001, original_title: "Say It, Fight It, Cure It", title: "Say It, Fight It, Cure It", release_date: "1997-01-01", vote_count: 1, popularity: 0.6, genre_ids: [99] },
      { id: 40389, original_title: "キュア", title: "Cure", release_date: "1997-12-27", vote_count: 856, popularity: 9.1, genre_ids: [27, 53, 80] },
    ];
    assert.equal(
      vencedor(candidatos, { originalTitle: "Cure", year: 1997 }).id,
      40389,
    );
  });

  it("cinema de arte obscuro não perde para homônimo popular de outro ano", () => {
    // A defesa contra a correção óbvia que foi DESCARTADA por medição: um piso
    // de vote_count cortaria o acervo que o produto existe para defender.
    // Medido em 09/09/2026: legítimos têm de 1 a 39 votos (Baara tem 10).
    // Aqui o ano é que decide, e é assim que deve ser.
    const candidatos = [
      { id: 82011, original_title: "Baara", title: "Baara", release_date: "1978-01-01", vote_count: 10, popularity: 0.7, genre_ids: [18] },
      { id: 999002, original_title: "Baara", title: "Baara", release_date: "2019-01-01", vote_count: 3000, popularity: 15.0, genre_ids: [28] },
    ];
    assert.equal(
      vencedor(candidatos, { originalTitle: "Baara", year: 1978 }).id,
      82011,
    );
  });

  it("registro-fantasma não ganha o bônus cheio de título exato", () => {
    const fantasma = { id: 1, original_title: "Solaris", title: "Solaris", release_date: "1972-01-01", vote_count: 3, popularity: 0.5, genre_ids: [] };
    const real = { id: 2, original_title: "Солярис", title: "Solaris", release_date: "1972-03-20", vote_count: 1500, popularity: 9.0, genre_ids: [878, 18] };
    const pedido = { originalTitle: "Solaris", year: 1972 };
    // Os dois casam exato (o `title` do real também é "Solaris"), mas só o
    // fantasma leva o bônus reduzido.
    assert.ok(pontuar(fantasma, pedido).nota < pontuar(real, pedido).nota);
  });
});

describe("escolher — o que entra na lista e o que fica de fora", () => {
  const acerto = {
    results: [
      { id: 603, original_title: "The Matrix", title: "Matrix", release_date: "1999-03-30", vote_count: 25000, popularity: 50, genre_ids: [28, 878] },
    ],
  };

  it("preserva a ordem do curador, que é informação", () => {
    const pedidos = [
      { rank: 0, originalTitle: "The Matrix", year: 1999 },
      { rank: 1, originalTitle: "The Matrix", year: 1999 },
    ];
    const { saida } = escolher(pedidos, [acerto, acerto]);
    assert.equal(saida[0].rank, 0);
  });

  it("deduplica quando dois títulos caem no mesmo filme", () => {
    // Execução 1874: 'Sombras' e outro pedido resolveram ambos para o
    // tmdb_id 84956. Além do card repetido, o INSERT ... ON CONFLICT do
    // 'Gravar L2' morria com "cannot affect row a second time".
    const pedidos = [
      { rank: 0, originalTitle: "The Matrix", year: 1999 },
      { rank: 1, originalTitle: "Matrix", year: 1999 },
    ];
    const { saida } = escolher(pedidos, [acerto, acerto]);
    assert.equal(saida.length, 1, "o mesmo tmdbId entrou duas vezes");
    assert.equal(saida[0].tmdbId, 603);
  });

  it("descarta candidato sem título exato e com ano distante", () => {
    const longe = {
      results: [
        { id: 99, original_title: "Outro Filme", title: "Outro Filme", release_date: "1950-01-01", vote_count: 10, popularity: 1, genre_ids: [18] },
      ],
    };
    const { saida, vazio } = escolher(
      [{ rank: 0, originalTitle: "Um Filme Inventado", year: 1999 }],
      [longe],
    );
    assert.equal(saida.length, 0);
    assert.equal(vazio, true);
  });

  it("sinaliza lista vazia em vez de lançar", () => {
    // `types.ts` documenta `movies: []` com `notFound` cheio como "200, não
    // erro". Quem decide o que fazer com isso é o nó, não esta função.
    const { saida, vazio } = escolher([], []);
    assert.deepEqual(saida, []);
    assert.equal(vazio, true);
  });

  it("ignora pedido cujo TMDB não devolveu resultado nenhum", () => {
    const { saida } = escolher(
      [
        { rank: 0, originalTitle: "The Matrix", year: 1999 },
        { rank: 1, originalTitle: "Nada", year: 2000 },
      ],
      [acerto, { results: [] }],
    );
    assert.equal(saida.length, 1);
  });
});

describe("normalizar — comparar títulos de idiomas diferentes", () => {
  it("ignora acento, caixa e pontuação", () => {
    assert.equal(normalizar("Amélie"), normalizar("AMELIE"));
    assert.equal(normalizar("Spider-Man"), "spider man");
    assert.equal(normalizar("  O  Iluminado! "), "o iluminado");
  });

  it("não quebra com nulo nem com título em outro alfabeto", () => {
    assert.equal(normalizar(null), "");
    assert.equal(normalizar(undefined), "");
    // Sem letras latinas sobra string vazia — daí o desempate por ano e votos.
    assert.equal(normalizar("버닝"), "");
  });
});
