/**
 * Aquece o cache L1 com as sugestões prontas da tela inicial.
 *
 * Os quatro botões da home são a primeira coisa que qualquer visitante clica.
 * Sem isto, quem clica espera o caminho vivo inteiro — de 6 a 60 segundos.
 * Com o cache quente, espera cerca de 250 ms.
 *
 * Rode depois de subir o workflow, e SEMPRE depois de incrementar
 * `prompt_version` — o número entra no hash, então bumpar esfria tudo:
 *
 *   node --env-file=.env scripts/aquecer-cache.mjs
 *
 * Fala direto com o webhook do n8n, não com o BFF: o rate limit de 5/min do
 * route handler existe contra visitante, e aqui atrapalharia.
 */
import { EXEMPLOS } from "../src/lib/exemplos.ts";

const CHAVE = process.env.N8N_API_KEY;
const URL_WEBHOOK = process.env.N8N_FILMPRO_WEBHOOK;

if (!CHAVE) {
  console.error("N8N_API_KEY não está definida. Rode com --env-file=.env");
  process.exit(1);
}

// Sem default, pelo mesmo motivo do route handler: o `??` publicava o host do
// n8n num repositório que vai a público, e não cobria variável presente e
// vazia. Aqui a falha é dura — script de manutenção não tem por que degradar.
if (!URL_WEBHOOK) {
  console.error(
    "N8N_FILMPRO_WEBHOOK não está definida. Rode com --env-file=.env",
  );
  process.exit(1);
}

/** Uma busca. Devolve o que interessa para o relatório, nunca lança. */
async function buscar(preferences) {
  const inicio = performance.now();
  try {
    const resposta = await fetch(URL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CHAVE },
      body: JSON.stringify({
        preferences,
        limit: 8,
        requestId: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const ms = Math.round(performance.now() - inicio);

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      return { ok: false, ms, motivo: corpo?.error ?? `HTTP ${resposta.status}` };
    }
    const corpo = await resposta.json();
    return {
      ok: true,
      ms,
      cached: corpo.cached,
      filmes: corpo.movies?.length ?? 0,
      colecao: corpo.collectionTitle,
    };
  } catch (erro) {
    return {
      ok: false,
      ms: Math.round(performance.now() - inicio),
      motivo: erro?.name === "TimeoutError" ? "estourou 120 s" : String(erro),
    };
  }
}

const linha = (r) =>
  r.ok
    ? `${String(r.ms).padStart(6)} ms  ${r.cached ? "cache " : "vivo  "}  ${r.filmes} filmes  ${JSON.stringify(r.colecao)}`
    : `${String(r.ms).padStart(6)} ms  FALHOU  ${r.motivo}`;

console.log(`Aquecendo ${EXEMPLOS.length} consultas em ${URL_WEBHOOK}\n`);

const primeira = [];
for (const exemplo of EXEMPLOS) {
  const r = await buscar(exemplo);
  primeira.push({ exemplo, r });
  console.log(`  ${exemplo}\n    ${linha(r)}`);
}

// A segunda passada é a que prova o aquecimento: se alguma voltar "vivo"
// aqui, a gravação do L1 não aconteceu e o cache não está funcionando.
console.log("\nConferindo (tudo aqui deve dizer 'cache'):\n");

let frias = 0;
for (const { exemplo } of primeira) {
  const r = await buscar(exemplo);
  if (!r.ok || !r.cached) frias++;
  console.log(`  ${exemplo}\n    ${linha(r)}`);
}

console.log(
  frias === 0
    ? "\nTodas as sugestões da home respondem do cache."
    : `\n${frias} consulta(s) NÃO ficaram em cache — verifique o nó Gravar L1.`,
);
process.exit(frias === 0 ? 0 : 1);
