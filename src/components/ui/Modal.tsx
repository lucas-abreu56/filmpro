"use client";

import { useLenis } from "lenis/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCursorTracking } from "@/lib/useCursorTracking";

/**
 * O `<dialog>` nativo, e não uma `<div>` com `z-index`: ele entra na top
 * layer, prende o foco e responde ao Esc sem uma linha de JavaScript — três
 * coisas que uma reimplementação erra.
 *
 * O próprio elemento é o véu: `fixed inset-0` com fundo translúcido. O
 * `::backdrop` faria o mesmo, mas então o clique fora não teria alvo para
 * comparar, e fechar clicando ao lado é o gesto que a pessoa espera.
 */
export default function Modal({
  children,
  rotulo,
}: {
  children: React.ReactNode;
  rotulo?: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Espelha `dialogRef` em estado só para `CursorNoDialog` saber, via render,
  // quando o nó existe — um `ref` sozinho não dispara re-render.
  const [dialogEl, setDialogEl] = useState<HTMLDialogElement | null>(null);
  const setRefs = useCallback((el: HTMLDialogElement | null) => {
    dialogRef.current = el;
    setDialogEl(el);
  }, []);
  // `undefined` quando o Lenis não está montado (movimento reduzido) — o `?.`
  // abaixo vira no-op.
  const lenis = useLenis();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // O `<dialog>` nativo não trava a rolagem do fundo; com o Lenis dirigindo
    // o `<body>`, rolar sobre o véu rolaria a página atrás. Pausa enquanto a
    // ficha está aberta, retoma ao fechar — a posição fica onde estava.
    lenis?.stop();
    return () => lenis?.start();
  }, [lenis]);

  // `back()` e não `push("/")`: o modal é uma camada sobre a página que estava
  // aberta, e voltar devolve exatamente ela, com a rolagem onde estava.
  //
  // ── Por que fechar é em dois tempos ────────────────────────────────────────
  // A ficha entrava em 220ms e sumia em 0: `router.back()` desmonta este
  // componente, e o nó sai do DOM antes de qualquer transição rodar. No celular,
  // onde a ficha ocupa a tela inteira, o corte seco lê como falha.
  //
  // Então: `close()` primeiro (o `<dialog>` continua no DOM e o CSS anima a
  // saída na top layer, via `@starting-style` + `transition-behavior:
  // allow-discrete` em `globals.css`), e só depois `router.back()`.
  //
  // O gatilho é o `transitionend` do próprio elemento, não um `setTimeout` com
  // a duração copiada: duração em dois lugares desincroniza na primeira vez que
  // alguém mexe no CSS. O `setTimeout` aqui é só rede de segurança para o caso
  // de a transição não disparar (sem suporte, ou `prefers-reduced-motion`, onde
  // o bloco global zera a duração e o evento pode não vir).
  const saindoRef = useRef(false);
  const fechar = useCallback(() => {
    if (saindoRef.current) return; // Esc + clique fora podem chegar juntos.
    saindoRef.current = true;

    const dialog = dialogRef.current;
    if (!dialog) {
      router.back();
      return;
    }

    let feito = false;
    const navegar = () => {
      if (feito) return;
      feito = true;
      router.back();
    };

    dialog.addEventListener("transitionend", navegar, { once: true });
    // 400ms cobre a transição mais longa declarada (220ms) com folga.
    setTimeout(navegar, 400);

    if (dialog.open) dialog.close();
  }, [router]);

  return (
    <dialog
      ref={setRefs}
      aria-label={rotulo ? `Ficha de ${rotulo}` : "Ficha do filme"}
      // O Esc é tratado em `onCancel`, que dispara ANTES de o navegador
      // fechar: `preventDefault` devolve o fechamento para o `fechar` daqui,
      // e assim o Esc ganha a mesma saída animada do botão e do clique fora.
      //
      // `onClose` continua como rede: se algo fechar o diálogo por fora deste
      // componente, a navegação ainda acontece. O guarda `saindoRef` impede
      // que ele dispare de novo no fluxo normal, onde `fechar` já chamou
      // `close()`.
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
      onClose={fechar}
      onClick={(e) => {
        // Só o clique no véu — o conteúdo é filho e tem alvo próprio.
        if (e.target === dialogRef.current) fechar();
      }}
      className="bg-tinta/80 veu-ficha fixed inset-0 z-50 flex min-h-full min-w-full items-center justify-center p-4 backdrop-blur-sm"
    >
      {/* Sem sombra, e com fio de 1 px: a separação vem de contraste, que é a
          regra da referência e já era a do resto do projeto. A cor de fundo é
          a do palco — a ficha lá dentro é escura. */}
      {/* `data-lenis-prevent` mora AQUI, e não no `<article>` do `MovieDetail`.
          O Lenis procura o atributo subindo a partir do alvo do evento, então
          pôr no painel cobre a ficha lá dentro — e cobre só o modal, que é o
          único lugar onde ela é um contêiner de rolagem de verdade.

          Estava no `<article>` e isso travou a página `/filme/[tmdbId]`: lá a
          ficha NÃO rola por dentro (é a página que rola), e o
          `overscroll-behavior: contain` que o `lenis.css` aplica em
          `[data-lenis-prevent]` bloqueava o encadeamento para o documento. Com
          o cursor sobre a ficha — quase a tela inteira — a roda não fazia
          nada. Medido em 08/09/2026: `scrollY` preso em 0 sobre a ficha,
          rolando normal só na margem lateral. */}
      <div
        data-lenis-prevent
        className="bg-profundo text-papel border-papel/15 ficha-entra relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded border"
      >
        {/* Pílula, e não texto solto. Dois motivos, medidos numa tela de
            390 px em 04/09/2026:

            1. Como texto puro ele media 40 × 16 px — menos da metade do alvo
               de toque confortável. `min-h-11` (44 px) e o respiro lateral
               resolvem sem mudar o tamanho da letra.
            2. Ele repousa sobre o palco, e enquanto o trailer carrega o
               YouTube desenha a própria barra de título ali. O fundo do palco
               com desfoque devolve o contraste sem inventar sombra.

            Pílula com fio é a forma que o sistema já reserva para ação (a
            mesma do "Ficha no TMDB"); fechar é ação.

            ── Por que a faixa no celular ─────────────────────────────────────
            Flutuando sobre um conteúdo que rola, ele cobre **alguma** coisa,
            sempre — numa captura do telefone do Lucas era o "POR QUE ESTE
            FILME", e nenhum ajuste de padding conserta isso, porque qualquer
            posição de rolagem é possível. No computador o quadro é largo e ele
            só encosta no palco; no celular a ficha ocupa a tela inteira e não
            existe canto livre.

            Então no celular ele sai da frente e vira uma faixa própria no topo
            do cartão, fora da área que rola. Custa ~68 px de altura, e é o que
            se paga para nunca esconder texto. O elemento é UM só: muda o
            arranjo, não o botão. */}
        <div className="z-20 flex shrink-0 justify-end p-3 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:top-0 sm:p-4">
          <button
            onClick={fechar}
            data-cursor="fechar"
            className="text-papel/70 hover:text-papel focus-visible:text-papel border-papel/25 hover:border-papel/60 bg-profundo/70 font-display pointer-events-auto flex min-h-11 items-center rounded-full border px-4 text-xs tracking-[0.16em] uppercase backdrop-blur-sm transition-colors"
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
      <CursorNoDialog dialog={dialogEl} />
    </dialog>
  );
}

/**
 * O anel de `Cursor.tsx`, redesenhado aqui dentro por causa da top layer.
 *
 * `showModal()` põe o `<dialog>` numa camada acima de QUALQUER z-index do
 * documento normal — inclusive o do `Cursor` global, que vive fora dele em
 * `layout.tsx`. Ser filho do próprio `<dialog>` é o que basta para herdar a
 * top layer sem portal manual.
 *
 * Cor invertida (`border-papel`/`text-papel`) porque o painel aqui dentro é
 * escuro (`bg-profundo`); o anel escuro do cursor global sumiria de novo,
 * agora por contraste, e não por camada.
 */
function CursorNoDialog({ dialog }: { dialog: HTMLDialogElement | null }) {
  const { pos, rotulo } = useCursorTracking(dialog);

  if (!pos) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[60]"
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      aria-hidden="true"
    >
      <span className="border-papel absolute -top-[26px] -left-[26px] block h-[52px] w-[52px] rounded-full border" />
      {rotulo && (
        <span className="text-papel font-display absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase">
          {rotulo}
        </span>
      )}
    </div>
  );
}
