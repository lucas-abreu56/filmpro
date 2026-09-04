"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // `back()` e não `push("/")`: o modal é uma camada sobre a página que estava
  // aberta, e voltar devolve exatamente ela, com a rolagem onde estava.
  function fechar() {
    router.back();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={rotulo ? `Ficha de ${rotulo}` : "Ficha do filme"}
      // `onClose` cobre o Esc, que fecha o diálogo sem passar por `fechar`.
      onClose={fechar}
      onClick={(e) => {
        // Só o clique no véu — o conteúdo é filho e tem alvo próprio.
        if (e.target === dialogRef.current) fechar();
      }}
      className="bg-tinta/80 veu-entra fixed inset-0 z-50 flex min-h-full min-w-full items-center justify-center p-4 backdrop-blur-sm"
    >
      {/* Sem sombra, e com fio de 1 px: a separação vem de contraste, que é a
          regra da referência e já era a do resto do projeto. A cor de fundo é
          a do palco — a ficha lá dentro é escura. */}
      <div className="bg-profundo text-papel border-papel/15 ficha-entra relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded border">
        {/* Pílula, e não texto solto. Dois motivos, os dois medidos em
            04/09/2026 numa tela de 390 px:

            1. Como texto puro ele media 40 × 16 px. É menos da metade do alvo
               de toque confortável; `min-h-11` (44 px) e o respiro lateral
               resolvem sem mudar o tamanho da letra.
            2. Ele repousa sobre o palco, e enquanto o trailer carrega o
               YouTube desenha a própria barra de título ali — em captura, os
               dois se sobrepunham e a palavra sumia. O fundo do palco com
               desfoque devolve o contraste sem inventar sombra.

            Pílula com fio é a forma que o sistema já reserva para ação (é a
            mesma do "Ficha no TMDB"); fechar é ação. */}
        <button
          onClick={fechar}
          data-cursor="fechar"
          className="text-papel/70 hover:text-papel focus-visible:text-papel border-papel/25 hover:border-papel/60 bg-profundo/70 font-display absolute top-3 right-3 z-20 flex min-h-11 items-center rounded-full border px-4 text-xs tracking-[0.16em] uppercase backdrop-blur-sm transition-colors sm:top-4 sm:right-4"
        >
          Fechar
        </button>
        {children}
      </div>
    </dialog>
  );
}
