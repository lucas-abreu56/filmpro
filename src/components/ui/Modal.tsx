"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function onDismiss() {
    router.back();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 flex min-h-full min-w-full items-center justify-center bg-tinta/80 p-4 backdrop-blur-sm open:animate-in open:fade-in-0 closed:animate-out closed:fade-out-0"
      onClose={onDismiss}
      onClick={(e) => {
        // Close if click is on the dialog backdrop (outside the container)
        if (e.target === dialogRef.current) {
          onDismiss();
        }
      }}
    >
      <div
        // Previne que o clique dentro do conteúdo feche o modal
        onClick={(e) => e.stopPropagation()}
        className="bg-papel text-tinta relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded shadow-2xl"
      >
        <button
          onClick={onDismiss}
          data-cursor="fechar"
          className="text-apoio hover:text-acento font-display absolute top-4 right-4 z-10 text-xs tracking-[0.16em] uppercase transition-colors"
          aria-label="Fechar"
        >
          Fechar
        </button>
        {children}
      </div>
    </dialog>
  );
}
