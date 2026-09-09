/**
 * Testes de mesa da correção de acentuação do `reason`.
 *
 * O léxico é pequeno de propósito: só palavras cuja forma sem acento não
 * existe em português como outra palavra válida. Um léxico ambíguo criaria
 * falso positivo — a razão de "atmosfera" (que não leva acento) não entrar.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { corrigirAcentuacao, LEXICO_ACENTUACAO } from "./corrigir-acentuacao.js";

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

  it("não corrige palavra parcial (evita casar dentro de outra palavra)", () => {
    // 'nacao' contém 'nao' como substring, mas não é a palavra 'nao'.
    assert.equal(corrigirAcentuacao("A nacao inteira."), "A nacao inteira.");
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
