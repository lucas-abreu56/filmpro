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

    // `mousemove` dispara mais de uma vez por quadro em mouse de 120 Hz (e o
    // navegador ainda coalesce eventos pendentes). Sem o rAF, cada amostra
    // fazia um `closest()` na árvore e dois `setState`. Agora o evento só
    // guarda a posição, e o trabalho — a busca do `data-cursor` e o render —
    // acontece uma vez por quadro.
    let quadro = 0;
    let ultimo: MouseEvent | null = null;
    const processa = () => {
      quadro = 0;
      const e = ultimo;
      if (!e) return;
      setPos({ x: e.clientX, y: e.clientY });
      const alvo = (e.target as HTMLElement | null)?.closest?.("[data-cursor]");
      setRotulo(alvo?.getAttribute("data-cursor") ?? "");
    };
    const mover = (e: MouseEvent) => {
      ultimo = e;
      if (!quadro) quadro = requestAnimationFrame(processa);
    };
    const sair = () => setPos(null);

    window.addEventListener("mousemove", mover);
    document.addEventListener("mouseleave", sair);
    return () => {
      window.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseleave", sair);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  // O cursor nativo só some depois que o substituto já tem posição; do
  // contrário o ponteiro desaparece por um instante ao carregar a página.
  //
  // A dependência é o BOOLEANO, não `pos`. Com `[pos]` o efeito refazia
  // limpeza e escrita a cada mousemove — uma escrita em `document.body` por
  // movimento do mouse, que invalida o estilo do documento inteiro. O valor
  // gravado era sempre o mesmo; só o trabalho era novo.
  const visivel = pos !== null;
  useEffect(() => {
    if (!visivel) return;
    document.body.style.cursor = "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, [visivel]);

  if (!pos) return null;

  return (
    // `translate3d` em vez de `left`/`top`: posição por `left` é propriedade de
    // layout, e mover o mouse repaginava o documento a cada quadro. Transform
    // fica no compositor.
    <div
      className="pointer-events-none fixed top-0 left-0 z-[9998]"
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
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
