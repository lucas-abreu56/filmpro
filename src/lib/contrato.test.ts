/**
 * O guard que impede a tela branca.
 *
 * O route handler confiava numa asserção (`as RecommendationsResponse`) sobre
 * o que o n8n devolvesse. Um corpo `{}` passava com `notFound: undefined`, e
 * `SearchResults` fazia `.length` nisso — TypeError no cliente, tela em branco,
 * e o usuário sem ver sequer uma mensagem de erro.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { RESPOSTA_FALSA } from "./mock.ts";
import { ehRespostaValida } from "./types.ts";

describe("ehRespostaValida — o que o n8n manda é mesmo uma resposta?", () => {
  it("aceita a resposta que o mock do projeto descreve", () => {
    // Duplo propósito: se o mock deixar de passar aqui, ele divergiu do
    // contrato — e é ele que alimenta a interface em NEXT_PUBLIC_FILMPRO_MOCK.
    assert.equal(ehRespostaValida(RESPOSTA_FALSA), true);
  });

  it("aceita coleção legitimamente vazia", () => {
    // `movies: []` com `notFound` cheio é 200, não erro: a curadoria
    // funcionou e a verificação no TMDB é que não confirmou ninguém.
    assert.equal(
      ehRespostaValida({
        collectionTitle: "Nada confirmado",
        movies: [],
        notFound: ["Um Filme Que Nao Existe"],
      }),
      true,
    );
  });

  it("recusa o corpo vazio de um workflow que morreu no meio", () => {
    assert.equal(ehRespostaValida({}), false);
  });

  it("recusa resposta sem notFound, que era o campo que quebrava a tela", () => {
    assert.equal(
      ehRespostaValida({ collectionTitle: "X", movies: [] }),
      false,
    );
  });

  it("recusa o que nem objeto é", () => {
    for (const v of [null, undefined, "texto", 42, [], true]) {
      assert.equal(ehRespostaValida(v), false, `aceitou ${JSON.stringify(v)}`);
    }
  });

  it("recusa collectionTitle que não é string", () => {
    assert.equal(
      ehRespostaValida({ collectionTitle: null, movies: [], notFound: [] }),
      false,
    );
  });
});
