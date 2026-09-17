import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright entra aqui para cobrir o que o `node --test` não alcança e o
 * `scripts/shot.mjs` não afirma: componente com estado, exercitado no
 * navegador de verdade. Captura estática mostra como ficou; isto verifica que
 * funciona.
 *
 * ── Por que só o Chromium ───────────────────────────────────────────────────
 * Os três navegadores dão ~400 MB em disco por máquina. O alvo aqui é a
 * mecânica da rota interceptada — `<dialog>`, histórico, store — não
 * compatibilidade entre motores. Se algum dia um defeito de WebKit aparecer,
 * acrescenta-se o projeto e baixa-se aquele navegador, não antes.
 *
 * ── Por que o servidor sobe em modo mock ────────────────────────────────────
 * `NEXT_PUBLIC_FILMPRO_MOCK=1` faz a home e o `buscarFilme` lerem de
 * `src/lib/mock.ts`. Com isso o teste roda sem n8n no ar, sem chave de API e
 * sem gastar cota do TMDB — e de quebra exercita o caminho de fallback sem
 * imagem, que é o caso de filme obscuro em produção.
 *
 * `reuseExistingServer` fora do CI: se você já está com `npm run dev` aberto,
 * o Playwright usa aquele em vez de subir um segundo na mesma porta.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    // Rastro só do que falhou na primeira tentativa — em execução verde não
    // custa disco nenhum.
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_FILMPRO_MOCK: "1" },
    timeout: 120_000,
  },
});
