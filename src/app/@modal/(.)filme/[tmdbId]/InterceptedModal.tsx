"use client";

import { useEffect, useSyncExternalStore } from "react";

import MovieDetail from "@/components/features/MovieDetail";
import Modal from "@/components/ui/Modal";
import { useMovieStore } from "@/lib/store";

/**
 * A ficha por cima da tira, sem ida ao servidor.
 *
 * O filme já foi baixado inteiro pela busca — pedir de novo só para abrir o
 * modal seria pagar duas vezes pelo mesmo JSON. O store é a fonte aqui; o
 * `/filme/[tmdbId]` de verdade é para link direto e refresh.
 *
 * **Quando o store não tem o filme.** Acontece de fato: recarregar em cima do
 * modal esvazia o store, e voltar/avançar no histórico traz a URL de volta por
 * navegação de cliente — que a rota interceptadora captura outra vez. Antes
 * isto renderizava `null`: a URL mudava e a tela não. `location.replace` sai
 * disso indo para a página real; é navegação de documento, então o
 * interceptador não roda de novo e não há laço.
 */
export default function InterceptedModal({ tmdbId }: { tmdbId: number }) {
  const movie = useMovieStore((estado) =>
    estado.movies.find((m) => m.tmdbId === tmdbId),
  );

  // O store nasce vazio no servidor, então o primeiro render do cliente tem
  // que ser igual ao dele ou a hidratação quebra. Isto é a forma canônica de
  // perguntar "já estou no cliente?" sem `setState` dentro de efeito.
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (montado && !movie) location.replace(`/filme/${tmdbId}`);
  }, [montado, movie, tmdbId]);

  if (!montado || !movie) return null;

  return (
    <Modal rotulo={movie.title}>
      <MovieDetail movie={movie} />
    </Modal>
  );
}
