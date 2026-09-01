"use client";

import { useEffect, useState } from "react";

/**
 * Cursor customizado: um anel com rótulo que muda conforme o alvo.
 *
 * Qualquer elemento pode ditar o texto com `data-cursor="ver trailer"`.
 *
 * Duas guardas, e ambas importam: só liga em ponteiro fino (no toque não
 * existe cursor, e esconder o do sistema quebraria a página) e some para quem
 * pediu menos movimento. Como o listener só é registrado quando o dispositivo
 * é elegível, `pos !== null` já implica elegibilidade — não é preciso um
 * segundo estado para isso, e evitá-lo mantém o efeito livre de setState
 * síncrono.
 */
export default function Cursor() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [rotulo, setRotulo] = useState("");

  useEffect(() => {
    const fino = window.matchMedia("(pointer: fine)");
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fino.matches || parado.matches) return;

    const mover = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const alvo = (e.target as HTMLElement | null)?.closest?.("[data-cursor]");
      setRotulo(alvo?.getAttribute("data-cursor") ?? "");
    };
    const sair = () => setPos(null);

    window.addEventListener("mousemove", mover);
    document.addEventListener("mouseleave", sair);
    return () => {
      window.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseleave", sair);
    };
  }, []);

  // O cursor nativo só some depois que o substituto já tem posição; do
  // contrário o ponteiro desaparece por um instante ao carregar a página.
  useEffect(() => {
    if (!pos) return;
    document.body.style.cursor = "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, [pos]);

  if (!pos) return null;

  return (
    <div
      className="pointer-events-none fixed z-[9998]"
      style={{ left: pos.x, top: pos.y }}
      aria-hidden="true"
    >
      <span className="border-tinta absolute -top-[26px] -left-[26px] block h-[52px] w-[52px] rounded-full border" />
      {rotulo && (
        <span className="text-tinta font-display absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase">
          {rotulo}
        </span>
      )}
    </div>
  );
}
