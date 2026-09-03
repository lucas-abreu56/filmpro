"use client";

import { useRef, useState } from "react";


import AquecerTrailer from "@/components/features/AquecerTrailer";
import FilmStrip from "@/components/features/FilmStrip";
import Loader from "@/components/features/Loader";
import { EXEMPLOS } from "@/lib/exemplos";
import { RESPOSTA_FALSA } from "@/lib/mock";
import { LIMITS, type RecommendationsResponse } from "@/lib/types";

/** Sem workflow no n8n, `NEXT_PUBLIC_FILMPRO_MOCK=1` faz a interface rodar com
 *  dados falsos. Não afeta produção: a variável não existe lá. */
const MOCK = process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1";

type Estado =
  | { fase: "parado" }
  | { fase: "buscando" }
  | { fase: "pronto"; dados: RecommendationsResponse; ms: number }
  | { fase: "erro"; mensagem: string };

export default function SearchPanel() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });
  /** Primeiro sinal de que esta pessoa vai buscar alguma coisa. Liga o quadro
   *  quente do trailer e nunca desliga — ver `AquecerTrailer`. */
  const [pretende, setPretende] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const curto = texto.trim().length < LIMITS.MIN_PREFERENCES;
  const buscando = estado.fase === "buscando";

  function ajustarAltura(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function usarExemplo(exemplo: string) {
    setPretende(true);
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

    setPretende(true);
    setEstado({ fase: "buscando" });
    const inicio = performance.now();

    if (MOCK) {
      // Espera artificial na ordem de grandeza da real, para o carregamento
      // poder ser avaliado como ele vai se comportar em produção.
      await new Promise((r) => setTimeout(r, 6000));
      setEstado({
        fase: "pronto",
        dados: { ...RESPOSTA_FALSA, query: texto.trim() },
        ms: Math.round(performance.now() - inicio),
      });
      return;
    }

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
      setEstado({
        fase: "pronto",
        dados: corpo,
        ms: Math.round(performance.now() - inicio),
      });
    } catch {
      setEstado({ fase: "erro", mensagem: "Falha de rede." });
    }
  }

  return (
    <>
      <Loader ativo={buscando} />
      <AquecerTrailer ligado={pretende} />

      <div className="w-full max-w-5xl">
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
            onFocus={() => setPretende(true)}
            rows={2}
            maxLength={LIMITS.MAX_PREFERENCES}
            placeholder="Um suspense claustrofóbico, poucos personagens, final que incomoda…"
            className="border-fio-forte text-tinta placeholder:text-apoio focus:border-acento w-full resize-none border-b bg-transparent py-3 text-2xl leading-snug outline-none"
          />

          <div className="text-apoio mt-3 flex items-center justify-between text-xs">
            <span className="tabular-nums">
              {texto.length} / {LIMITS.MAX_PREFERENCES}
            </span>
            <button
              type="submit"
              disabled={curto || buscando}
              data-cursor="buscar"
              className="bg-acento text-papel font-display hover:bg-tinta disabled:bg-fio disabled:text-apoio px-6 py-2 text-sm font-medium tracking-[0.12em] uppercase transition-colors disabled:cursor-not-allowed"
            >
              {buscando ? "Curando" : "Buscar"}
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXEMPLOS.map((exemplo) => (
            <button
              key={exemplo}
              type="button"
              onClick={() => usarExemplo(exemplo)}
              className="border-fio text-apoio hover:border-tinta hover:text-tinta border px-3 py-1.5 text-xs transition-colors"
            >
              {exemplo}
            </button>
          ))}
        </div>

        {estado.fase === "erro" && (
          <p className="border-acento text-tinta mt-8 border-l-2 py-2 pl-4 text-sm">
            {estado.mensagem}
          </p>
        )}
      </div>

      {estado.fase === "pronto" && (
        <section className="mt-16 w-full">
          <header className="mb-6 max-w-5xl">
            <p className="text-apoio font-display text-xs tracking-[0.16em] uppercase">
              Coleção
            </p>
            {/* Nome da coleção: texto autoral do agente. */}
            <h2 className="font-display mt-1 text-[clamp(2.5rem,7vw,5rem)] leading-[0.85] font-medium uppercase">
              {estado.dados.collectionTitle}
            </h2>
            <p className="text-apoio mt-3 text-xs tabular-nums">
              {estado.dados.movies.length} filmes · {estado.ms} ms
              {estado.dados.cached && " · do cache"}
              {/* Contar a verdade é o ponto deste texto — então ele precisa
                  concordar em número. "2 sugestão descartada" desmente a
                  própria frase que está tentando ser honesta. */}
              {estado.dados.notFound.length === 1 &&
                " · 1 sugestão descartada por não constar no TMDB"}
              {estado.dados.notFound.length > 1 &&
                ` · ${estado.dados.notFound.length} sugestões descartadas por não constarem no TMDB`}
            </p>
          </header>

          <FilmStrip movies={estado.dados.movies} />

          {MOCK && (
            <p className="text-apoio mt-4 text-xs">
              Dados falsos — quadros procedurais, como na réplica da kirlian.
              Trailer e pôster reais exigem as credenciais do TMDB.
            </p>
          )}
        </section>
      )}
    </>
  );
}
