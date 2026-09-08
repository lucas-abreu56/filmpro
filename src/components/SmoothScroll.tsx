"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

import { useMedia } from "@/lib/useMedia";

/**
 * Rolagem com inércia no site inteiro. Lenis embrulha a rolagem nativa — a
 * barra continua real, `position: sticky` e âncoras continuam funcionando —
 * então serve à direção editorial/cinema sem o custo de um scroll hijacking.
 *
 * `autoRaf` e `anchors` são `false` por padrão no Lenis: sem o primeiro nada
 * se move, sem o segundo um link `#secao` deixa de rolar suave. Não há âncora
 * hoje, mas ligar é barato.
 *
 * ── Movimento reduzido ──────────────────────────────────────────────────────
 * O Lenis tem `respectReducedMotion` (força `lerp: 1` e mantém a instância
 * viva para não dessincronizar animação presa ao scroll). Aqui não há nenhuma
 * — os toques scroll-driven são CSS puro, guardados por
 * `prefers-reduced-motion: no-preference` no próprio globals.css — então o mais
 * simples e coerente com o resto do projeto é não montar o Lenis de todo.
 *
 * `useMedia` começa `false` no servidor e no primeiro quadro do cliente, e
 * `<ReactLenis root>` não renderiza nó no DOM: a montagem condicional não
 * quebra hidratação.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const semMovimento = useMedia("(prefers-reduced-motion: reduce)");

  if (semMovimento) return <>{children}</>;

  return (
    <ReactLenis root options={{ autoRaf: true, anchors: true }}>
      {children}
    </ReactLenis>
  );
}
