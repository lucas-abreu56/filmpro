/**
 * Relatório de produção — lê a telemetria do Postgres e imprime os números
 * que hoje moram no README como medição de uma única sessão.
 *
 *   node --env-file=.env scripts/relatorio.mjs
 *
 * Precisa de `DATABASE_URL` no `.env` (a connection string do MESMO banco que
 * o n8n usa — `postgresql://usuario:senha@host:5432/filmpro`). O n8n guarda
 * essa credencial do lado dele; aqui ela entra como env, sem default.
 *
 * ── ESTRITAMENTE SOMENTE-LEITURA ──────────────────────────────────────────
 * Só `SELECT`. A conexão é aberta com `default_transaction_read_only=on` e
 * toda query roda dentro de uma transação READ ONLY. Um script de relatório
 * que pode escrever é arma carregada apontada para produção.
 *
 * ── Duas limitações que o cabeçalho do relatório declara ───────────────────
 * (número sem ressalva é pior que número nenhum)
 *
 * 1. TAXA DE ERRO NÃO É MENSURÁVEL. O nó `Telemetria` roda DEPOIS do
 *    `Responder`; num throw, nada é gravado. Uma busca que falhou com 502 é
 *    indistinguível de uma que nunca existiu. Fechar isso exige o `Responder
 *    erro` gravar uma linha com `error_code` — coluna que não existe.
 *
 * 2. `fallback_uses` DA VIEW `stats_summary` É PERMANENTEMENTE ZERO.
 *    `preparar-registro.js` grava `model_used = doCache ? null : 'gemini'` —
 *    string fixa, nunca `'groq'`. A view filtra `= 'groq'`. Ela diz "o
 *    fallback nunca foi usado", indistinguível de "o Gemini nunca falhou".
 *    Métrica que parece funcionar e não funciona. O literal é deliberado para
 *    o SQL de cache (só null-ou-não importa lá); quem está errado é a view.
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL não está definida. Rode com --env-file=.env\n" +
      "É a connection string do banco do FilmPro: postgresql://user:senha@host:5432/filmpro",
  );
  process.exit(1);
}

const JANELA_DIAS = 30;

// ── As consultas. Todas com WHERE source='human', menos a #1b (volume robô). ─
//
// O robô é o job de fileiras semanais chamando o mesmo webhook. Ele é impresso
// à parte de propósito: se ele parar, a home congela na semana anterior e hoje
// nada avisa — o volume dele caindo a zero é o alarme.

const CONSULTAS = [
  {
    titulo: "1. Volume por dia (30 d, uso humano)",
    sql: `
      SELECT created_at::date AS dia,
             count(*)                          AS buscas,
             count(*) FILTER (WHERE cache_hit) AS de_cache
        FROM searches
       WHERE source = 'human'
         AND created_at > now() - interval '${JANELA_DIAS} days'
       GROUP BY dia
       ORDER BY dia DESC`,
    formatar: (linhas) =>
      linhas.length
        ? linhas
            .map(
              (r) =>
                `  ${r.dia.toISOString().slice(0, 10)}  ${String(r.buscas).padStart(4)} buscas` +
                `  (${r.de_cache} de cache)`,
            )
            .join("\n")
        : "  (nenhuma busca humana na janela)",
  },
  {
    titulo: "1b. Volume do robô de fileiras (mesma janela) — deve ser > 0",
    sql: `
      SELECT count(*)             AS buscas_robo,
             max(created_at)      AS ultima
        FROM searches
       WHERE source = 'robot'
         AND created_at > now() - interval '${JANELA_DIAS} days'`,
    formatar: ([r]) =>
      Number(r.buscas_robo) === 0
        ? "  ⚠ ZERO buscas do robô em 30 dias — o job semanal pode estar quebrado (a home congelou)."
        : `  ${r.buscas_robo} buscas · última em ${r.ultima?.toISOString().slice(0, 16).replace("T", " ") ?? "?"}`,
  },
  {
    titulo: "2. Taxa de acerto de cache (detector tardio do que a Fase 1 pega cedo)",
    sql: `
      SELECT count(*)                              AS total,
             count(*) FILTER (WHERE cache_hit)     AS acertos,
             round(
               100.0 * count(*) FILTER (WHERE cache_hit) / nullif(count(*), 0), 1
             )                                     AS pct
        FROM searches
       WHERE source = 'human'
         AND created_at > now() - interval '${JANELA_DIAS} days'`,
    formatar: ([r]) =>
      Number(r.total) === 0
        ? "  (sem dados)"
        : `  ${r.acertos}/${r.total} buscas do cache — ${r.pct}%` +
          "\n  Uma taxa baixa e persistente é cópia de sanitização divergindo ou hash instável.",
  },
  {
    titulo: "3. Latência p50/p95 por tipo (percentile_cont — média mente com cauda longa)",
    sql: `
      SELECT cache_hit,
             count(*)                                                   AS n,
             round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms)) AS p50,
             round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)) AS p95,
             max(latency_ms)                                            AS maximo
        FROM searches
       WHERE source = 'human'
         AND latency_ms IS NOT NULL
         AND created_at > now() - interval '${JANELA_DIAS} days'
       GROUP BY cache_hit
       ORDER BY cache_hit DESC`,
    formatar: (linhas) =>
      linhas.length
        ? linhas
            .map(
              (r) =>
                `  ${r.cache_hit ? "acerto de cache" : "busca inédita "}  n=${String(r.n).padStart(4)}` +
                `  p50 ${String(r.p50).padStart(6)} ms   p95 ${String(r.p95).padStart(6)} ms   máx ${r.maximo} ms`,
            )
            .join("\n")
        : "  (sem latências registradas)",
  },
  {
    titulo: "4. Buscas com movie_count < limit pedido — a verificação da resolução TMDB",
    // O `limit` de cada busca não está em `searches`; vem de `search_cache.limit_n`
    // pela chave `query_hash`. LEFT JOIN porque uma busca cujo cache já expirou
    // não tem mais linha lá — nesse caso cai no fallback DEFAULT_LIMIT (8).
    sql: `
      SELECT round(avg(s.not_found_count), 2)                       AS descartados_media,
             count(*) FILTER (
               WHERE s.movie_count < coalesce(sc.limit_n, 8)
             )                                                       AS incompletas,
             count(*)                                               AS total
        FROM searches s
        LEFT JOIN search_cache sc ON sc.query_hash = s.query_hash
       WHERE s.source = 'human'
         AND s.created_at > now() - interval '${JANELA_DIAS} days'`,
    formatar: ([r]) =>
      `  descartados por busca (média): ${r.descartados_media ?? "—"}` +
      `\n  buscas que voltaram com menos filmes que o pedido: ${r.incompletas}/${r.total}`,
  },
  {
    titulo: "5. movie_count = 0 (o caso da Fase 5 — estado vazio)",
    sql: `
      SELECT count(*)        AS zeradas,
             max(created_at) AS ultima
        FROM searches
       WHERE source = 'human'
         AND movie_count = 0
         AND created_at > now() - interval '${JANELA_DIAS} days'`,
    formatar: ([r]) =>
      Number(r.zeradas) === 0
        ? "  nenhuma busca humana voltou vazia na janela"
        : `  ${r.zeradas} buscas voltaram com zero filmes · última ${r.ultima?.toISOString().slice(0, 16).replace("T", " ")}`,
  },
  {
    titulo: "6. Buscas mais frequentes por query_hash (alimenta o aquecer-cache.mjs)",
    sql: `
      SELECT query_text,
             count(*)             AS vezes,
             bool_or(cache_hit)   AS ja_cacheou
        FROM searches
       WHERE source = 'human'
         AND created_at > now() - interval '${JANELA_DIAS} days'
       GROUP BY query_hash, query_text
      HAVING count(*) > 1
       ORDER BY vezes DESC
       LIMIT 15`,
    formatar: (linhas) =>
      linhas.length
        ? linhas
            .map((r) => `  ${String(r.vezes).padStart(3)}×  ${r.ja_cacheou ? "  " : "❄ "}${r.query_text}`)
            .join("\n")
        : "  (nenhuma consulta repetida na janela)",
  },
];

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  // Reforço além da transação READ ONLY: a sessão inteira recusa escrita.
  options: "-c default_transaction_read_only=on",
  max: 1,
  connectionTimeoutMillis: 10_000,
});

const cliente = await pool.connect();
try {
  await cliente.query("BEGIN TRANSACTION READ ONLY");

  console.log("═".repeat(74));
  console.log(`FilmPro — relatório de produção   ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
  console.log(`Janela: últimos ${JANELA_DIAS} dias   ·   fonte: searches WHERE source='human'`);
  console.log("═".repeat(74));
  console.log(
    "\nDUAS LIMITAÇÕES DECLARADAS:\n" +
      "  • Taxa de erro NÃO é mensurável — o nó Telemetria roda depois do Responder;\n" +
      "    num throw, nada grava. Busca que falhou = busca que nunca existiu.\n" +
      "  • stats_summary.fallback_uses é permanentemente zero — model_used nunca é\n" +
      "    'groq' (preparar-registro.js grava literal 'gemini'). A view está errada,\n" +
      "    não o pipeline. Por isso este relatório NÃO reporta uso de fallback.",
  );

  for (const { titulo, sql, formatar } of CONSULTAS) {
    const { rows } = await cliente.query(sql);
    console.log(`\n${"─".repeat(74)}\n${titulo}\n`);
    console.log(formatar(rows));
  }

  await cliente.query("COMMIT");
  console.log(`\n${"═".repeat(74)}`);
} finally {
  cliente.release();
  await pool.end();
}
