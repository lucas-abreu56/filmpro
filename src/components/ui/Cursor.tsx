"use client";

import { useEffect } from "react";

import { useCursorTracking } from "@/lib/useCursorTracking";

/**
 * Cursor customizado: um anel com rótulo que muda conforme o alvo.
 *
 * Qualquer elemento pode ditar o texto com `data-cursor="ver trailer"`.
 *
 * Este é o anel do documento normal. Dentro de um `<dialog>` aberto (a
 * ficha do filme) ele fica atrás da top layer do navegador — por isso
 * `Modal.tsx` desenha o seu próprio, com `CursorNoDialog`, usando o mesmo
 * `useCursorTracking`.
 */
export default function Cursor() {
  const { pos, rotulo, sobreTemaEscuro } = useCursorTracking(
    typeof document === "undefined" ? null : document,
  );

  // O cursor nativo só some depois que o substituto já tem posição; do
  // contrário o ponteiro desaparece por um instante ao carregar a página.
  //
  // A dependência é o BOOLEANO, não `pos`. Com `[pos]` o efeito refazia
  // limpeza e escrita a cada mousemove — uma escrita na classList por
  // movimento do mouse, que invalida o estilo do documento inteiro. O valor
  // gravado era sempre o mesmo; só o trabalho era novo.
  //
  // A classe vai no `<html>`, não `body.style.cursor` direto: um link ou
  // botão carrega `cursor: pointer` do user-agent stylesheet, mais específico
  // que o valor herdado do body, e a seta do sistema reaparecia sobre
  // qualquer elemento clicável. `.cursor-custom-ativo` em `globals.css` cobre
  // isso com um seletor universal.
  const visivel = pos !== null;
  useEffect(() => {
    if (!visivel) return;
    document.documentElement.classList.add("cursor-custom-ativo");
    return () => {
      document.documentElement.classList.remove("cursor-custom-ativo");
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
      {/* `border-tinta`/`text-tinta` seguiriam `.tema-escuro` sozinhos se o
          `Cursor` vivesse dentro dessa árvore — mas ele mora em `layout.tsx`,
          fora do herói e da ficha que a aplicam. Sem a troca manual, o anel
          escuro some sobre o fundo escuro deles; medido em 09/09/2026 sobre o
          cartão de busca do herói. */}
      <span
        className={`absolute -top-[26px] -left-[26px] block h-[52px] w-[52px] rounded-full border ${sobreTemaEscuro ? "border-papel" : "border-tinta"}`}
      />
      {rotulo && (
        <span
          className={`font-display absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium tracking-wide whitespace-nowrap uppercase ${sobreTemaEscuro ? "text-papel" : "text-tinta"}`}
        >
          {rotulo}
        </span>
      )}
    </div>
  );
}
