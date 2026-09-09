"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { useSyncExternalStore } from "react";

const CONSULTA_REDUZIDO = "(prefers-reduced-motion: reduce)";

/**
 * `useMedia` (`src/lib/useMedia.ts`) começa `false` no primeiro quadro por
 * convenção — o valor real só chega depois do efeito. Para este componente
 * isso tem um custo real: sob movimento reduzido o Lenis chega a MONTAR no
 * primeiro quadro e desmontar no seguinte, um trabalho inteiro à toa (medido
 * em 08/09/2026). `useSyncExternalStore` lê `matchMedia` de forma síncrona no
 * cliente, então o primeiro quadro já vem certo — o Lenis nunca chega a
 * montar quando o SO pede menos movimento.
 *
 * Isto só é seguro aqui porque `<ReactLenis root>` não emite nó no DOM: não
 * há markup para divergir entre servidor e cliente. Em componentes que usam
 * o valor para decidir MARKUP (ex.: `FilmStrip.tsx`, `MovieDetail.tsx`) essa
 * troca quebraria a hidratação — por isso eles continuam no `useMedia`.
 */
function useSemMovimento() {
  return useSyncExternalStore(
    (aviso) => {
      const mq = window.matchMedia(CONSULTA_REDUZIDO);
      mq.addEventListener("change", aviso);
      return () => mq.removeEventListener("change", aviso);
    },
    () => window.matchMedia(CONSULTA_REDUZIDO).matches,
    () => false,
  );
}

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
 * Ver `useSemMovimento` acima para o porquê deste hook local em vez do
 * `useMedia` compartilhado.
 *
 * `lerp` fica no padrão `0.1` do Lenis (assenta em ~770ms depois que a roda
 * para). Testado em produção contra `0.08`, `0.2` e `0.8` por um harness de
 * `?lerp=` — o Lucas aprovou o padrão em 08/09/2026 e o harness foi removido.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const semMovimento = useSemMovimento();

  if (semMovimento) return <>{children}</>;

  return (
    <ReactLenis root options={{ autoRaf: true, anchors: true }}>
      {children}
    </ReactLenis>
  );
}
