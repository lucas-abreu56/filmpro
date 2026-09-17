import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test } from "@playwright/test";

/**
 * Varredura WCAG 2.1 AA com o axe, nas quatro telas que o projeto tem.
 *
 * ── Por que isto entra como teste, e não como auditoria avulsa ──────────────
 * Contraste de cor não quebra build, não falha lint e não aparece em captura
 * — dá para olhar a tela e achar bonito enquanto o texto está ilegível para
 * quem enxerga menos. A primeira rodada, em 16/09/2026, achou exatamente um
 * defeito assim: `text-acento` (#c52e2e) no "Por que este filme" do
 * `MovieDetail` dava 3,43:1 sobre o `profundo`, contra os 4,5:1 que AA pede.
 * O acento tinha sido calibrado contra o papel creme, onde dá 5,12:1, e
 * ninguém mediu de novo ao usá-lo sobre fundo escuro. Corrigido com o token
 * `--color-acento-claro`; este teste é o que impede a volta.
 *
 * ── Por que a home roda em dois viewports, e o resto só em um ───────────────
 * A rodada de desktop deste teste passava com 0 violações, e mesmo assim a
 * rotação cromática das fileiras (`--color-teal` e companhia, em
 * `globals.css`) estava entre 1,29:1 e 2,02:1 sobre o papel — bem abaixo dos
 * 4,5:1 exigidos. O motivo: `.fileira-revela` (também em `globals.css`) só
 * anima com `min-width: 64rem`, e até a pessoa rolar até a fileira o rótulo
 * fica em `opacity: 0`. O axe não relata contraste de elemento invisível —
 * comportamento correto dele — então a violação ficava fora do que o teste em
 * desktop, sem rolagem, conseguia ver.
 *
 * Um viewport de celular (abaixo de 1024px) desliga essa animação e entrega
 * as fileiras já visíveis, sem precisar rolar programaticamente — e cobre de
 * quebra o caso real de tela estreita, que era a lacuna. Só a home ganhou o
 * segundo viewport: foi onde o defeito vivia, e as outras telas não têm
 * `fileira-revela`.
 *
 * ── O limite honesto disto ──────────────────────────────────────────────────
 * O axe pega o que é mecânico: contraste, nome acessível, ordem de cabeçalho,
 * rótulo de formulário. Ele NÃO julga se o texto alternativo descreve bem a
 * imagem, se a ordem de foco faz sentido para a tarefa, nem se a página é
 * usável com leitor de tela. Zero violações aqui significa "nenhum defeito
 * mecânico", não "acessível" — e mesmo "nenhum defeito mecânico" só vale para
 * os viewports que o teste de fato exercita.
 */

const REGRAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Relata cada violação com alvo e contexto — uma lista de ids como
 *  `["color-contrast"]` não diz onde consertar. */
function relatar(violacoes: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violacoes
    .map((v) => {
      const alvos = v.nodes
        .map((n) => `      ${n.target.join(" ")}\n      ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`)
        .join("\n");
      return `  [${v.impact}] ${v.id} — ${v.help}\n${alvos}`;
    })
    .join("\n\n");
}

test.describe("acessibilidade", () => {
  for (const [nome, rota] of [
    ["home", "/"],
    ["ficha do filme", "/filme/1"],
    ["404", "/rota-que-nao-existe"],
  ] as const) {
    test(`${nome} não tem violações WCAG AA`, async ({ page }) => {
      await page.goto(rota);
      // O primeiro cabeçalho da tela serve de sinal de que o conteúdo chegou —
      // melhor que um timeout fixo, que seria um número chutado. `h1, h2`
      // porque a ficha começa em `<h2>`: o título do filme é cabeçalho de
      // seção, já que a mesma peça também é renderizada dentro do modal, sobre
      // a home. O axe não reclama disso, e mudar o nível para agradar um
      // seletor de teste seria mexer no app pelo motivo errado.
      await expect(page.locator("h1, h2").first()).toBeVisible();

      const r = await new AxeBuilder({ page }).withTags([...REGRAS]).analyze();
      expect(r.violations, `\n${relatar(r.violations)}`).toEqual([]);
    });
  }

  test("a ficha dentro do modal não tem violações WCAG AA", async ({ page }) => {
    // Caminho de render diferente do `/filme/[id]`: aqui o `MovieDetail` vive
    // dentro do `<dialog>` da rota interceptada, na top layer. Mesmo
    // componente, mas o contexto de empilhamento e o fundo são outros, e foi
    // aqui que o defeito de contraste apareceu primeiro.
    await page.goto("/");

    const links = page.locator('a[href^="/filme/"]');
    await page.waitForFunction(
      () => {
        const n = document.querySelectorAll('a[href^="/filme/"]').length;
        const anterior = (window as unknown as { __n?: number }).__n;
        (window as unknown as { __n?: number }).__n = n;
        return n > 0 && n === anterior;
      },
      null,
      { polling: 150 },
    );

    const link = links.first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const r = await new AxeBuilder({ page }).withTags([...REGRAS]).analyze();
    expect(r.violations, `\n${relatar(r.violations)}`).toEqual([]);
  });

  test("home em viewport de celular não tem violações WCAG AA", async ({
    browser,
  }) => {
    // Contexto próprio, com `devices["iPhone SE"]` — 375px é a largura mais
    // estreita que o projeto trata como alvo (ver `MovieDetail`), e é abaixo
    // do `min-width: 64rem` que liga `.fileira-revela`.
    const ctx = await browser.newContext({ ...devices["iPhone SE"] });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("h1, h2").first()).toBeVisible();

    const r = await new AxeBuilder({ page }).withTags([...REGRAS]).analyze();
    expect(r.violations, `\n${relatar(r.violations)}`).toEqual([]);

    await ctx.close();
  });
});
