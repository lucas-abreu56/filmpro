"use client";

import { useEffect, useState } from "react";

export interface PosicaoCursor {
  x: number;
  y: number;
}

/**
 * Rastreia posição do mouse e o rótulo `data-cursor` do alvo sob ele.
 *
 * Extraído de `Cursor.tsx` para ter dois consumidores: o anel do corpo da
 * página e o anel de dentro do `<dialog>` (ver `Modal.tsx`) — o `<dialog>`
 * aberto com `showModal()` entra na top layer do navegador, acima de
 * qualquer `z-index` do documento normal, então o anel do corpo fica
 * escondido atrás dele. Rastrear de novo ali dentro é mais simples que tirar
 * o anel do corpo do documento com um portal manual.
 *
 * `root`: o nó a partir do qual ouvir o mouse. `document`/`window` para o
 * anel global; o próprio `<dialog>` para o anel de dentro dele — assim o
 * segundo não reage a movimento fora do modal.
 */
export function useCursorTracking(root: Document | HTMLElement | null) {
  const [pos, setPos] = useState<PosicaoCursor | null>(null);
  const [rotulo, setRotulo] = useState("");
  // O anel é `border-tinta` (escuro) por padrão — certo sobre o papel claro,
  // invisível sobre o herói/ficha, que invertem a paleta com `.tema-escuro`
  // (ver `globals.css`). Sem o `Cursor` viver dentro dessa árvore, ele precisa
  // perguntar por conta própria se o alvo está dentro de um contêiner assim.
  const [sobreTemaEscuro, setSobreTemaEscuro] = useState(false);

  useEffect(() => {
    if (!root) return;
    const fino = window.matchMedia("(pointer: fine)");
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fino.matches || parado.matches) return;

    let quadro = 0;
    let ultimo: MouseEvent | null = null;
    const processa = () => {
      quadro = 0;
      const e = ultimo;
      if (!e) return;
      setPos({ x: e.clientX, y: e.clientY });
      const alvo = e.target as HTMLElement | null;
      setRotulo(alvo?.closest?.("[data-cursor]")?.getAttribute("data-cursor") ?? "");
      setSobreTemaEscuro(alvo?.closest?.(".tema-escuro") != null);
    };
    const mover = (e: MouseEvent) => {
      ultimo = e;
      if (!quadro) quadro = requestAnimationFrame(processa);
    };
    const sair = () => setPos(null);

    root.addEventListener("mousemove", mover as EventListener);
    root.addEventListener("mouseleave", sair);
    return () => {
      root.removeEventListener("mousemove", mover as EventListener);
      root.removeEventListener("mouseleave", sair);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [root]);

  return { pos, rotulo, sobreTemaEscuro };
}
