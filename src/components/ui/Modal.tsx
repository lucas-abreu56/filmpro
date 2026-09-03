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
      <div className="bg-papel text-tinta ficha-entra relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded shadow-2xl">
        <button
          onClick={fechar}
          data-cursor="fechar"
          className="text-apoio hover:text-acento focus-visible:text-acento font-display absolute top-4 right-4 z-10 text-xs tracking-[0.16em] uppercase transition-colors"
        >
          Fechar
        </button>
        {children}
      </div>
    </dialog>
  );
}
