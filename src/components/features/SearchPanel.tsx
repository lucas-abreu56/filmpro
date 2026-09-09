"use client";

import { useRef, useState, useEffect } from "react";

import AquecerTrailer from "@/components/features/AquecerTrailer";
import Loader from "@/components/features/Loader";
import { EXEMPLOS } from "@/lib/exemplos";
import { RESPOSTA_FALSA } from "@/lib/mock";
import { LIMITS } from "@/lib/types";
import { useMovieStore, useSearchStore } from "@/lib/store";

/** Sem workflow no n8n, `NEXT_PUBLIC_FILMPRO_MOCK=1` faz a interface rodar com
 *  dados falsos. Não afeta produção: a variável não existe lá. */
const MOCK = process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1";

/**
 * Só o formulário — a tira de resultados é `SearchResults`, desenhada fora
 * daqui. No herói (`Hero.tsx`) este componente mora dentro do cartão escuro;
 * a tira de resultados nunca pode morar ali (ver `useSearchStore`).
 */
export default function SearchPanel() {
  const [texto, setTexto] = useState("");
  const estado = useSearchStore((state) => state.estado);
  const setEstado = useSearchStore((state) => state.setEstado);
  /** Primeiro sinal de que esta pessoa vai buscar alguma coisa. Liga o quadro
   *  quente do trailer e nunca desliga — ver `AquecerTrailer`. */
  const [pretende, setPretende] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const setMovies = useMovieStore((state) => state.setMovies);

  // Guarda no store global sempre que os dados ficam prontos,
  // permitindo que o Modal de ficha do filme seja instantâneo.
  useEffect(() => {
    if (estado.fase === "pronto") {
      setMovies(estado.dados.movies);
    }
  }, [estado, setMovies]);

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

  // Aceita os dois: o submit do <form> e o clique do "Tentar de novo", que
  // vive fora dele.
  async function buscar(e: React.SyntheticEvent) {
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

    let resposta: Response;
    try {
      resposta = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: texto.trim() }),
      });
    } catch {
      // Só aqui é falha de rede de verdade: o pedido não chegou a ter resposta.
      setEstado({ fase: "erro", mensagem: "Falha de rede." });
      return;
    }

    // O parse fica FORA do try do fetch, e depois dele. Quando os dois estavam
    // juntos — e o `json()` vinha antes do `!ok` — um corpo não-JSON derrubava
    // tudo no mesmo catch, e o servidor que respondeu 500, ou o webhook que
    // morreu devolvendo 200 vazio, apareciam para o usuário como "Falha de
    // rede". A rede tinha funcionado; a mensagem culpava ela.
    const corpo = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      setEstado({
        fase: "erro",
        mensagem: corpo?.error ?? "Não foi possível buscar agora.",
      });
      return;
    }
    if (!corpo) {
      setEstado({
        fase: "erro",
        mensagem: "O servidor respondeu de um jeito inesperado. Tente de novo.",
      });
      return;
    }
    setEstado({
      fase: "pronto",
      dados: corpo,
      ms: Math.round(performance.now() - inicio),
    });
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

        {/* `role="alert"` porque o erro aparece longe do botão: sem ele, quem
            usa leitor de tela submete e não recebe retorno nenhum. E o botão
            existe porque a busca falhada não deixava saída — o texto continua
            no campo, mas era preciso descobrir sozinho que bastava reenviar. */}
        {estado.fase === "erro" && (
          <div role="alert" className="border-acento mt-8 border-l-2 py-2 pl-4">
            <p className="text-tinta text-sm">{estado.mensagem}</p>
            {/* `type="button"` chamando o handler: este bloco fica FORA do
                <form>, então submit nativo não o alcançaria. */}
            <button
              type="button"
              onClick={buscar}
              disabled={curto}
              className="text-apoio hover:text-tinta mt-2 text-xs underline underline-offset-4 disabled:no-underline disabled:opacity-50"
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </>
  );
}
