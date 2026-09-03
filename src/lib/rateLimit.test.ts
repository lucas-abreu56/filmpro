import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clientIp } from "./rateLimit.ts";

/** `Headers` de verdade, para o teste exercitar a mesma busca sem-caso que o
 *  runtime faz — `Cf-Connecting-IP` e `cf-connecting-ip` são o mesmo header. */
const h = (entradas: Record<string, string>) => new Headers(entradas);

describe("clientIp — de quem é a requisição", () => {
  // Este é o teste que faltava. Com o proxy do Cloudflare ligado, o
  // `x-forwarded-for` que chega à Vercel é o IP da BORDA, e o limitador passou
  // a contar por servidor do Cloudflare em vez de por visitante. Não deu erro
  // nenhum: só parou de limitar, e ninguém teria visto sem medir em produção.
  it("prefere cf-connecting-ip ao x-forwarded-for da borda", () => {
    assert.equal(
      clientIp(
        h({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "172.71.234.154",
        }),
      ),
      "203.0.113.7",
    );
  });

  it("aceita o header sem depender da caixa", () => {
    assert.equal(clientIp(h({ "CF-Connecting-IP": "203.0.113.7" })), "203.0.113.7");
  });

  it("cai no x-forwarded-for quando não há Cloudflare na frente", () => {
    assert.equal(clientIp(h({ "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
  });

  // A cadeia chega como "cliente, proxy1, proxy2". Usar a string inteira faria
  // cada caminho de proxy virar um balde novo — e baldes novos nunca enchem.
  it("usa só a primeira entrada da cadeia de proxies", () => {
    assert.equal(
      clientIp(h({ "x-forwarded-for": "203.0.113.7, 198.51.100.1, 192.0.2.9" })),
      "203.0.113.7",
    );
  });

  it("ignora cf-connecting-ip vazio em vez de virar chave em branco", () => {
    assert.equal(
      clientIp(h({ "cf-connecting-ip": "   ", "x-forwarded-for": "203.0.113.7" })),
      "203.0.113.7",
    );
  });

  // Sem cabeçalho nenhum todo mundo divide o mesmo balde. É restritivo demais,
  // e é de propósito: o contrário seria não limitar ninguém.
  it("dá uma chave estável quando não há cabeçalho algum", () => {
    assert.equal(clientIp(h({})), "desconhecido");
  });
});
