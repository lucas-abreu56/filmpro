/**
 * Testes de mesa da correção de acentuação do `reason`.
 *
 * O léxico é pequeno de propósito: só palavras cuja forma sem acento não
 * existe em português como outra palavra válida. Um léxico ambíguo criaria
 * falso positivo — a razão de "atmosfera" (que não leva acento) não entrar.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  corrigirAcentuacao,
  LEXICO_ACENTUACAO,
  SUFIXO_ATONO,
} from "./corrigir-acentuacao.js";

describe("corrigirAcentuacao — os casos medidos em produção", () => {
  it("corrige 'nao', 'psicologico', 'decada', 'japones' numa frase real", () => {
    const entrada =
      "Um drama psicologico japones que retrata uma familia na decada de 80, " +
      "e que nao teme a tragedia nem a solidao do protagonista.";
    const saida = corrigirAcentuacao(entrada);
    assert.equal(
      saida,
      "Um drama psicológico japonês que retrata uma família na década de 80, " +
        "e que não teme a tragédia nem a solidão do protagonista.",
    );
  });

  it("preserva maiúscula inicial (início de frase)", () => {
    assert.equal(corrigirAcentuacao("Nao é sobre isso."), "Não é sobre isso.");
  });

  it("não toca em 'atmosfera', que não leva acento", () => {
    assert.equal(
      corrigirAcentuacao("Um filme de atmosfera densa."),
      "Um filme de atmosfera densa.",
    );
  });

  it("não altera texto já correto", () => {
    const certo = "Um clássico policial sobre não ceder à violência.";
    assert.equal(corrigirAcentuacao(certo), certo);
  });

  it("não quebra com null, undefined ou vazio", () => {
    assert.equal(corrigirAcentuacao(null), "");
    assert.equal(corrigirAcentuacao(undefined), "");
    assert.equal(corrigirAcentuacao(""), "");
  });

  it("a tabela casa palavra inteira, não substring", () => {
    // 'psicologicamente' contém 'psicologico'? não — 'psicologica' + 'mente'.
    // O que importa: a tabela não casa no meio de uma palavra maior. (A regra
    // de padrão -ção, testada abaixo, é por terminação e cobre 'nacao'.)
    assert.equal(
      corrigirAcentuacao("Filme historicamente denso."),
      "Filme historicamente denso.",
    );
  });

  it("corrige o vocabulário da Fase 6b (título de coleção)", () => {
    assert.equal(
      corrigirAcentuacao("Espetaculos em Movimento e Gravidade Desafiada"),
      "Espetáculos em Movimento e Gravidade Desafiada",
    );
    assert.equal(
      corrigirAcentuacao("Engenharia do Fantastico Manual"),
      "Engenharia do Fantástico Manual",
    );
    assert.equal(
      corrigirAcentuacao("O numero final de ballet e uma obra de complexidade coreografica"),
      "O numero final de ballet e uma obra de complexidade coreográfica",
    );
  });

  it("preserva 'Memoria' — excluída de propósito por ser título de filme (2021)", () => {
    assert.equal(
      corrigirAcentuacao("Ruinas da Memoria e Solidao Urbana"),
      "Ruínas da Memoria e Solidão Urbana",
    );
  });
});

describe("corrigirAcentuacao — regra de padrão -ção/-são/-xão (Fase 6c)", () => {
  it("põe o til no que a tabela não cobre", () => {
    assert.equal(
      corrigirAcentuacao("Cinema de Arte e Reflexao Humana"),
      "Cinema de Arte e Reflexão Humana",
    );
    assert.equal(
      corrigirAcentuacao("Suspiros de Leveza e Descompressao"),
      "Suspiros de Leveza e Descompressão",
    );
    assert.equal(
      corrigirAcentuacao("uma invasao de emocao pura"),
      "uma invasão de emoção pura",
    );
  });

  it("cobre os plurais -ções/-sões/-xões", () => {
    assert.equal(
      corrigirAcentuacao("as conexoes e as emocoes"),
      "as conexões e as emoções",
    );
  });

  it("corrige 'cao' e 'sao' isolados para 'cão' e 'são'", () => {
    assert.equal(corrigirAcentuacao("um cao na rua"), "um cão na rua");
    assert.equal(corrigirAcentuacao("Sao Paulo"), "São Paulo");
  });

  it("preserva maiúscula inicial na terminação corrigida", () => {
    assert.equal(corrigirAcentuacao("Reflexao"), "Reflexão");
  });

  it("não toca no meio da palavra — só a terminação", () => {
    // "caotico" contém "cao" no início, não no fim.
    assert.equal(corrigirAcentuacao("um clima caotico"), "um clima caotico");
    // "pensao" termina em "sao" e É til faltando: "pensão".
    assert.equal(corrigirAcentuacao("a pensao completa"), "a pensão completa");
  });

  it("tabela e regra de padrão concordam onde se sobrepõem", () => {
    // 'definicao'/'construcao'/'observacao'/'imersao' estão na tabela E casam a
    // regra de padrão. As duas rotas têm de dar o mesmo resultado.
    for (const [chave, valor] of Object.entries(LEXICO_ACENTUACAO)) {
      if (/(?:cao|sao|xao|coes|soes|xoes)$/.test(chave)) {
        const semTabela = { ...LEXICO_ACENTUACAO };
        delete semTabela[chave];
        // Recalcula pela regra de padrão: troca só a terminação.
        const m = chave.match(/(coes|soes|xoes|cao|sao|xao)$/);
        const pelaRegra = chave.slice(0, -m[0].length) + SUFIXO_ATONO[m[0]];
        assert.equal(valor, pelaRegra, `tabela diz '${valor}', regra diz '${pelaRegra}'`);
      }
    }
  });
});

describe("LEXICO_ACENTUACAO — o léxico em si", () => {
  it("toda chave é a forma SEM acento, e o valor tem acento", () => {
    for (const [semAcento, comAcento] of Object.entries(LEXICO_ACENTUACAO)) {
      assert.equal(
        semAcento,
        semAcento.normalize("NFD").replace(/[̀-ͯ]/g, ""),
        `chave '${semAcento}' já tem diacrítico — deveria estar na forma sem acento`,
      );
      assert.notEqual(
        comAcento.normalize("NFD").replace(/[̀-ͯ]/g, ""),
        comAcento,
        `valor '${comAcento}' não tem nenhum diacrítico`,
      );
    }
  });
});
