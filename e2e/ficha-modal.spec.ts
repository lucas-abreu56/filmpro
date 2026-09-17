import { expect, test } from "@playwright/test";

/**
 * A rota interceptada `@modal/(.)filme/[tmdbId]`.
 *
 * É o fluxo mais frágil do app e o que nenhuma captura estática verifica: o
 * mesmo `/filme/123` tem que abrir como modal por cima da home quando se chega
 * por clique, e como página inteira quando se chega por URL direta. Os dois
 * estragos que o docblock do `InterceptedModal` registra — a ficha vindo ora
 * escura ora clara, e o `location.replace` comendo a entrada do histórico —
 * aparecem exatamente aqui, e nenhum deles quebra o build.
 *
 * Os seletores são por papel e nome acessível, nunca por classe: `aria-label`
 * é contrato com quem usa leitor de tela, então mexer nele já é mudança de
 * comportamento. Classe do Tailwind muda no próximo ajuste de estilo e levaria
 * o teste junto, sem defeito nenhum.
 */

/**
 * Chega até o primeiro filme clicável da home e devolve o link e o título.
 *
 * ── Por que `href`, e não `aria-label` ──────────────────────────────────────
 * Medido em 16/09/2026 com uma sonda no navegador: o `FilmStrip` renderiza
 * DOIS arranjos — coluna (desktop) e cartão (celular) — e o servidor manda os
 * dois. São 16 links no HTML inicial e 10 depois da hidratação, quando o
 * arranjo do outro breakpoint é descartado. O `aria-label="Ver a ficha de X"`
 * só existe no arranjo de CARTÃO; no viewport desktop deste projeto quem
 * sobrevive é a coluna, cujo nome acessível vem do texto ("01 O ILUMINADO
 * 1980"). Um seletor por `aria-label` casa no HTML do servidor e depois perde
 * o elemento — o "element was detached from the DOM" que custou a primeira
 * rodada aqui.
 *
 * `href="/filme/<id>"` é o mesmo nos dois arranjos e é o contrato de verdade:
 * a ficha é uma rota. O título sai do `<span>` do título, não do texto todo,
 * que traz junto o número decorativo da coluna.
 *
 * O `scrollIntoViewIfNeeded` não é contorno: `fileira-revela` em
 * `globals.css` anima as fileiras com `animation-timeline: view()`, então elas
 * ficam em `opacity: 0` até entrarem na viewport. Rolar até ver o filme antes
 * de clicar é o que uma pessoa faz.
 */
async function primeiroFilmeDaHome(page: import("@playwright/test").Page) {
  const links = page.locator('a[href^="/filme/"]');

  // Esperar a contagem PARAR de mudar antes de fixar um locator. Durante a
  // hidratação ela cai (medido: de 16 para 10 no mock) porque os dois arranjos
  // do `FilmStrip` viram um, e um `.first()` resolvido nesse meio aponta para
  // um nó que o React está prestes a descartar — o "Element is not attached to
  // the DOM" que travou as duas primeiras rodadas deste arquivo.
  //
  // A espera é por estabilidade, não por um número: acoplar ao 10 do mock faria
  // este teste quebrar ao acrescentar um filme lá, que não é defeito nenhum.
  // `waitForFunction` porque a condição é "duas medições seguidas iguais", e
  // isso o `expect` com auto-retry não expressa.
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
  await expect(link).toBeVisible();

  const href = (await link.getAttribute("href"))!;
  return { link, tmdbId: href.split("/").pop()! };
}

test.describe("ficha do filme", () => {
  test("abre como modal sobre a home e o Fechar devolve a home", async ({
    page,
  }) => {
    await page.goto("/");

    const { link, tmdbId } = await primeiroFilmeDaHome(page);
    await link.click();

    // 1. O modal abriu — `<dialog>` tem role "dialog" e o `Modal` monta o nome
    //    como "Ficha de <título>".
    const ficha = page.getByRole("dialog", { name: /^Ficha de / });
    await expect(ficha).toBeVisible();

    // 2. A URL é a do filme em que se clicou. Se isto passar mas o passo 1
    //    falhar, o que aconteceu foi a navegação de documento que a
    //    interceptação existe para evitar.
    await expect(page).toHaveURL(`/filme/${tmdbId}`);

    // 3. A home continua atrás — é o que separa modal de página inteira. O
    //    cabeçalho de bloco das fileiras só existe na home.
    await expect(
      page.getByText("Escolhas da semana", { exact: true }),
    ).toBeAttached();

    // 4. Fechar volta para a home, pelo histórico. O `Modal` fecha em dois
    //    tempos (anima a saída, depois navega), então o `toHaveURL` espera.
    await ficha.getByRole("button", { name: "Fechar" }).click();
    await expect(page).toHaveURL("/");
    await expect(ficha).not.toBeVisible();
  });

  test("o Esc fecha a ficha", async ({ page }) => {
    await page.goto("/");
    const { link } = await primeiroFilmeDaHome(page);
    await link.click();

    const ficha = page.getByRole("dialog", { name: /^Ficha de / });
    await expect(ficha).toBeVisible();

    // O `<dialog>` nativo responde ao Esc sozinho, mas o `Modal` intercepta em
    // `onCancel` para dar a mesma saída animada do botão. Se essa interceptação
    // quebrar, o diálogo some e a URL fica presa em `/filme/[id]` — que é o
    // defeito, não o Esc não funcionar.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL("/");
    await expect(ficha).not.toBeVisible();
  });

  test("a URL direta entrega a página inteira, não o modal", async ({
    page,
  }) => {
    // Chegar por link compartilhado ou recarregar em cima da ficha não passa
    // pela interceptação: o slot `@modal` cai no `default.tsx` e quem responde
    // é `/filme/[tmdbId]`. É a outra metade do contrato, e é o caminho por
    // onde a hidratação do store não existe.
    // `1` é "O Iluminado" no mock (`src/lib/mock.ts`); em produção o id é o
    // do TMDB.
    await page.goto("/filme/1");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Nada de "Escolhas da semana": não estamos sobre a home.
    await expect(page.getByText("Escolhas da semana")).toHaveCount(0);
  });
});
