"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Carregamento em quatro fases.
 *
 * Não é enfeite: o agente leva de 7 a 16 segundos e o enriquecimento no TMDB
 * some mais alguns. Sem isto, o pior momento do produto é uma frase parada.
 *
 * As fases correspondem a etapas reais do workflow, então o texto informa em
 * vez de entreter. E a barra **nunca chega a 100% sozinha** — ela satura em
 * 95% e só fecha quando a resposta chega de verdade. Barra que enche antes de
 * terminar é mentira, e o usuário aprende a não confiar nela.
 */
const FASES = [
  "Lendo o seu pedido",
  "Escolhendo os filmes",
  "Conferindo cada título",
  "Montando a coleção",
] as const;

/** Repetições por metade da coluna. Precisa render cada metade mais alta que
 *  a viewport para não sobrar vazio: a 6vw com entrelinha 0.75, 18 linhas
 *  cobrem folgadamente uma tela de 1080px. */
const LINHAS_POR_METADE = 18;

/** Estimativa para a curva de progresso. É chute até a Fase 1 medir. */
const DURACAO_ESPERADA_MS = 14_000;

export default function Loader({ ativo }: { ativo: boolean }) {
  const [pct, setPct] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const [montado, setMontado] = useState(ativo);
  const [ativoAnterior, setAtivoAnterior] = useState(ativo);
  const inicioRef = useRef(0);

  // Ajuste de estado derivado de prop feito durante o render, e não num
  // efeito: é o padrão que o React sanciona para isto, e evita o render em
  // cascata que `setState` dentro de efeito provoca.
  if (ativo !== ativoAnterior) {
    setAtivoAnterior(ativo);
    if (ativo) {
      setMontado(true);
      setSaindo(false);
      setPct(0);
    } else if (montado) {
      setPct(100);
      setSaindo(true);
    }
  }

  useEffect(() => {
    if (!ativo) return;
    inicioRef.current = performance.now();
    const id = setInterval(() => {
      const decorrido = performance.now() - inicioRef.current;
      // Satura em 95: o que falta é a resposta real, não o relógio.
      setPct(Math.min(95, (decorrido / DURACAO_ESPERADA_MS) * 100));
    }, 80);
    return () => clearInterval(id);
  }, [ativo]);

  // Desmonta só depois de a cortina subir.
  useEffect(() => {
    if (!saindo) return;
    const id = setTimeout(() => {
      setMontado(false);
      setSaindo(false);
    }, 900);
    return () => clearTimeout(id);
  }, [saindo]);

  if (!montado) return null;

  const fase = FASES[Math.min(FASES.length - 1, Math.floor(pct / 25))];

  return (
    <div
      className="bg-profundo text-papel fixed inset-0 z-[9000] overflow-hidden transition-transform duration-900 ease-[cubic-bezier(.76,0,.24,1)]"
      style={saindo ? { transform: "translateY(-100%)" } : undefined}
      role="status"
      aria-live="polite"
    >
      {/* Colunas de tipo rolando em direções opostas. Puramente decorativas —
          ficam fora da árvore de acessibilidade, e a fase é anunciada abaixo. */}
      <div className="absolute inset-x-0 -inset-y-[10%] flex" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((c) => (
          <div
            key={c}
            className="coluna-loader flex flex-1 flex-col opacity-[0.13]"
            data-invertida={c % 2 === 1 || undefined}
          >
            {/* O conteúdo é renderizado DUAS vezes, e é isso que faz o laço
                de `translateY(-50%)` emendar sem salto: metade da altura é
                exatamente uma cópia. Cada metade precisa ser mais alta que a
                viewport, senão sobra vazio no fim da coluna. */}
            {[0, 1].map((metade) =>
              [...Array(LINHAS_POR_METADE)].map((_, i) => (
                <span
                  key={`${metade}-${i}`}
                  className="font-display block text-center text-[6vw] leading-[0.75] font-medium uppercase"
                >
                  FilmPro
                </span>
              )),
            )}
          </div>
        ))}
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <p className="font-display text-center text-[12vw] leading-[0.75] font-medium uppercase [filter:blur(1px)]">
          {fase}
        </p>
      </div>

      <p
        className="font-display absolute right-[5vw] bottom-[4vw] text-[14vw] leading-[0.75] font-medium tabular-nums"
        aria-hidden="true"
      >
        {Math.floor(pct)}
      </p>

      <div
        className="bg-acento absolute bottom-0 left-0 h-[2px] transition-[width] duration-200"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}
