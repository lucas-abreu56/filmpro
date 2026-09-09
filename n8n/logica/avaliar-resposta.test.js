/**
 * Testes do juiz automático da bateria de personas.
 *
 * O juiz só cobre o mecanizável. Cada caso aqui é uma regra dura do
 * `curador.prompt.md` que o harness precisa checar sem olho humano.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { avaliarResposta } from "./avaliar-resposta.js";

/** Resposta mínima válida, para partir dela e estragar um campo por vez. */
function respostaOk() {
  return {
    collectionTitle: "Paranoia em Celulóide",
    movies: [
      {
        originalTitle: "The Shining",
        title: "O Iluminado",
        year: 1980,
        reason: "Você pediu claustrofobia, e o hotel vazio fecha as paredes.",
        tmdbId: 694,
      },
      {
        originalTitle: "Rosemary's Baby",
        title: "O Bebê de Rosemary",
        year: 1968,
        reason: "A vizinhança inteira conspira, e a câmera nunca a deixa sair.",
        tmdbId: 805,
      },
    ],
    notFound: [],
  };
}

describe("avaliarResposta — passa numa resposta bem-formada", () => {
  it("nenhuma falha para a resposta canônica", () => {
    const { falhas } = avaliarResposta(respostaOk());
    assert.deepEqual(falhas, []);
  });
});

describe("avaliarResposta — collectionTitle", () => {
  it("reprova aspas", () => {
    const r = respostaOk();
    r.collectionTitle = 'A "Coleção" do Medo';
    const { falhas } = avaliarResposta(r);
    assert.ok(falhas.some((f) => f.includes("aspas")));
    assert.ok(falhas.some((f) => f.includes('"coleção"')));
  });

  it("reprova dois-pontos", () => {
    const r = respostaOk();
    r.collectionTitle = "Medo: um estudo";
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("dois-pontos")));
  });

  it("reprova acima de MAX_COLLECTION_TITLE", () => {
    const r = respostaOk();
    r.collectionTitle = "A".repeat(80);
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("60")));
  });
});

describe("avaliarResposta — reason", () => {
  it("reprova markdown", () => {
    const r = respostaOk();
    r.movies[0].reason = "Um **clássico** do isolamento.";
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("markdown")));
  });

  it("reprova URL", () => {
    const r = respostaOk();
    r.movies[0].reason = "Veja mais em https://exemplo.com sobre o filme.";
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("URL")));
  });

  it("reprova emoji", () => {
    const r = respostaOk();
    r.movies[0].reason = "Um terror de tirar o fôlego 😱 do começo ao fim.";
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("emoji")));
  });

  it("reprova acima de MAX_REASON", () => {
    const r = respostaOk();
    r.movies[0].reason = "a".repeat(230);
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("220")));
  });

  it("não confunde reason longo legítimo (≤220) com problema", () => {
    const r = respostaOk();
    r.movies[0].reason = "a ".repeat(100).trim(); // 199 chars, com espaços
    assert.deepEqual(avaliarResposta(r).falhas, []);
  });
});

describe("avaliarResposta — acentuação: conta, não reprova", () => {
  it("reason sem acento entra na contagem, não nas falhas", () => {
    const r = respostaOk();
    r.movies[0].reason = "Um drama psicologico sobre a familia na decada de 70.";
    const { falhas, acentuacao } = avaliarResposta(r);
    assert.deepEqual(falhas, []);
    assert.equal(acentuacao.total, 2);
    assert.equal(acentuacao.comErro, 1);
  });

  it("não conta 'nacao' (contém 'nao' como substring, não é a palavra)", () => {
    const r = respostaOk();
    r.movies[0].reason = "Um retrato da nação inteira sob vigilância.";
    assert.equal(avaliarResposta(r).acentuacao.comErro, 0);
  });
});

describe("avaliarResposta — tmdbId repetido", () => {
  it("reprova dois filmes com o mesmo tmdbId", () => {
    const r = respostaOk();
    r.movies[1].tmdbId = r.movies[0].tmdbId;
    assert.ok(avaliarResposta(r).falhas.some((f) => f.includes("repetido")));
  });
});

describe("avaliarResposta — filme citado abre a lista", () => {
  it("passa quando o citado está na posição 1", () => {
    const r = respostaOk();
    const { falhas } = avaliarResposta(r, ["The Shining"]);
    assert.deepEqual(falhas, []);
  });

  it("reprova quando o citado não abre a lista", () => {
    const r = respostaOk();
    const { falhas } = avaliarResposta(r, ["Psycho"]);
    assert.ok(falhas.some((f) => f.includes("citado")));
  });

  it("casa por título traduzido também (normalizar ignora acento e caixa)", () => {
    const r = respostaOk();
    const { falhas } = avaliarResposta(r, ["o iluminado"]);
    assert.deepEqual(falhas, []);
  });

  it("dois citados, na ordem", () => {
    const r = respostaOk();
    const { falhas } = avaliarResposta(r, ["The Shining", "Rosemary's Baby"]);
    assert.deepEqual(falhas, []);
  });
});

describe("avaliarResposta — respostas degeneradas", () => {
  it("objeto nulo", () => {
    assert.ok(avaliarResposta(null).falhas.length > 0);
  });

  it("movies ausente", () => {
    assert.ok(avaliarResposta({ collectionTitle: "X" }).falhas.some((f) => f.includes("movies")));
  });

  it("movies: [] vira aviso, não falha", () => {
    const { falhas, avisos } = avaliarResposta({ collectionTitle: "X", movies: [] });
    assert.deepEqual(falhas, []);
    assert.ok(avisos.some((a) => a.includes("nenhum título")));
  });
});
