import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LIMITS } from "./types.ts";
import { normalizeQuery, sanitizeAuthoredText } from "./sanitize.ts";

const opcoes = { maxLength: LIMITS.MAX_REASON, fallback: "PADRAO" };

describe("sanitizeAuthoredText", () => {
  it("deixa passar texto de curadoria normal", () => {
    const texto = "Escolhido porque a claustrofobia aqui vem do espaço grande.";
    assert.equal(sanitizeAuthoredText(texto, opcoes), texto);
  });

  it("normaliza espaços e quebras de linha", () => {
    assert.equal(
      sanitizeAuthoredText("  dois \n\n espaços  ", opcoes),
      "dois espaços",
    );
  });

  // O modelo não tem motivo legítimo para escrever link, e é por aí que uma
  // instrução injetada no texto do usuário viraria conteúdo clicável na tela.
  it("rejeita link, tag e esquema perigoso", () => {
    for (const veneno of [
      "Ótimo filme https://exemplo.com",
      "Veja em www.exemplo.com",
      "Ótimo <script>alert(1)</script>",
      "Veja [aqui](http://mau.com)",
      "javascript:alert(1)",
      "data:text/html,<h1>x</h1>",
      "Fecha a </div> aqui",
    ]) {
      assert.equal(sanitizeAuthoredText(veneno, opcoes), "PADRAO", veneno);
    }
  });

  it("não confunde menor-que legítimo com abertura de tag", () => {
    const texto = "Curtos, todos < 90 minutos, e nenhum se arrasta.";
    assert.equal(sanitizeAuthoredText(texto, opcoes), texto);
  });

  it("remove caracteres invisíveis, que escondem instrução", () => {
    assert.equal(sanitizeAuthoredText("a\u200Bb\u2060c", opcoes), "abc");
  });

  it("corta no limite mesmo se o schema tiver deixado passar", () => {
    const longo = "a".repeat(400);
    const saida = sanitizeAuthoredText(longo, opcoes);
    assert.equal(saida.length, LIMITS.MAX_REASON);
    assert.ok(saida.endsWith("…"));
  });

  it("cai no padrão para vazio e para o que não é string", () => {
    for (const entrada of ["", "   ", null, undefined, 42, {}]) {
      assert.equal(sanitizeAuthoredText(entrada, opcoes), "PADRAO");
    }
  });
});

/**
 * Estes testes existem por um motivo específico: `normalizeQuery` precisa
 * produzir exatamente o mesmo resultado que a normalização escrita no
 * workflow do n8n, porque as duas alimentam o mesmo hash de cache. Se
 * divergirem, o cache para de acertar **em silêncio, sem erro nenhum** — e
 * ninguém percebe até a conta do LLM chegar.
 *
 * Ao mexer aqui, mexa no nó Set do n8n na mesma hora.
 */
describe("normalizeQuery — trava o formato do hash de cache", () => {
  it("colapsa as variações que o usuário digita sem querer", () => {
    const esperado = "terror psicológico anos 90";
    for (const entrada of [
      "Terror Psicológico Anos 90",
      "  terror   psicológico anos 90  ",
      "terror psicológico anos 90.",
      "TERROR PSICOLÓGICO ANOS 90!",
      "terror psicológico anos 90\n",
    ]) {
      assert.equal(normalizeQuery(entrada), esperado, entrada);
    }
  });

  it("é idempotente", () => {
    const uma = normalizeQuery("  Suspense,  Anos 90!! ");
    assert.equal(normalizeQuery(uma), uma);
  });

  it("não junta palavras distintas", () => {
    assert.notEqual(normalizeQuery("terror anos 90"), normalizeQuery("terror anos 80"));
  });
});
