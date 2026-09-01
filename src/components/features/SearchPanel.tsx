"use client";

import { useRef, useState } from "react";

import { LIMITS, type RecommendationsResponse } from "@/lib/types";

const EXEMPLOS = [
  "Suspense psicológico dos anos 90",
  "Ficção científica que discute o que é ser humano",
  "Comédia romântica sem clichê",
  "Animação que funciona para adulto",
];

type Estado =
  | { fase: "parado" }
  | { fase: "buscando" }
  | { fase: "pronto"; dados: RecommendationsResponse }
  | { fase: "erro"; mensagem: string };

/**
 * Tela da Fase 1: formulário e JSON cru.
 *
 * O objetivo desta fase é provar que o pôster chega preenchido de verdade —
 * o defeito central do projeto do curso. A pele (coluna que acorda, selos,
 * modal) vem depois, quando a latência já tiver sido medida.
 */
export default function SearchPanel() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const curto = texto.trim().length < LIMITS.MIN_PREFERENCES;
  const buscando = estado.fase === "buscando";

  function ajustarAltura(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function usarExemplo(exemplo: string) {
    setTexto(exemplo);
    const el = areaRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => ajustarAltura(el));
    }
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (curto || buscando) return;

    setEstado({ fase: "buscando" });
    const inicio = performance.now();

    try {
      const resposta = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: texto.trim() }),
      });

      const corpo = await resposta.json();

      if (!resposta.ok) {
        setEstado({
          fase: "erro",
          mensagem: corpo?.error ?? "Não foi possível buscar agora.",
        });
        return;
      }

      // A medição desta fase é o que decide se o fluxo precisa virar
      // assíncrono. Registre o número antes de decidir qualquer coisa.
      console.info(
        `[filmpro] ${Math.round(performance.now() - inicio)} ms · cache: ${corpo.cached}`,
      );
      setEstado({ fase: "pronto", dados: corpo });
    } catch {
      setEstado({ fase: "erro", mensagem: "Falha de rede." });
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <form onSubmit={buscar}>
        <label htmlFor="preferences" className="sr-only">
          O que você quer assistir?
        </label>
        <textarea
          id="preferences"
          ref={areaRef}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value.slice(0, LIMITS.MAX_PREFERENCES));
            ajustarAltura(e.target);
          }}
          rows={2}
          maxLength={LIMITS.MAX_PREFERENCES}
          placeholder="Um suspense claustrofóbico, poucos personagens, final que incomoda…"
          className="bg-carvao border-fumaca text-gelo placeholder:text-cinza focus:border-chama w-full resize-none border p-4 text-lg leading-snug outline-none"
        />

        <div className="text-cinza mt-2 flex items-center justify-between text-xs">
          <span>
            {texto.length} / {LIMITS.MAX_PREFERENCES}
          </span>
          <button
            type="submit"
            disabled={curto || buscando}
            className="bg-chama text-projecao hover:bg-brasa disabled:bg-grafite disabled:text-cinza px-6 py-3 font-display text-xs font-bold tracking-[2px] uppercase transition-colors disabled:cursor-not-allowed"
          >
            {buscando ? "Curando…" : "Buscar"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {EXEMPLOS.map((exemplo) => (
          <button
            key={exemplo}
            type="button"
            onClick={() => usarExemplo(exemplo)}
            className="border-fumaca text-pedra hover:border-cinza hover:text-gelo border px-3 py-1.5 text-xs transition-colors"
          >
            {exemplo}
          </button>
        ))}
      </div>

      {estado.fase === "erro" && (
        <p className="border-chama text-gelo mt-8 border-l-2 py-2 pl-4 text-sm">
          {estado.mensagem}
        </p>
      )}

      {estado.fase === "buscando" && (
        <p className="text-cinza mt-8 text-sm">
          O agente está montando a lista e conferindo cada título no TMDB.
        </p>
      )}

      {estado.fase === "pronto" && (
        <section className="mt-10">
          <p className="text-cinza font-display text-xs tracking-[2px] uppercase">
            Coleção
          </p>
          <h2 className="text-gelo font-display mt-1 text-2xl font-bold uppercase">
            {estado.dados.collectionTitle}
          </h2>
          <p className="text-cinza mt-2 text-xs">
            {estado.dados.movies.length} filmes
            {estado.dados.cached && " · servido do cache"}
            {estado.dados.notFound.length > 0 &&
              ` · ${estado.dados.notFound.length} sugestão(ões) descartada(s) por não constar no TMDB`}
          </p>

          <pre className="border-fumaca text-pedra mt-6 overflow-x-auto border p-4 text-[11px] leading-relaxed">
            {JSON.stringify(estado.dados, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
