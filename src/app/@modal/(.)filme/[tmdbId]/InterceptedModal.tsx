"use client";

import { useEffect, useSyncExternalStore } from "react";

import MovieDetail from "@/components/features/MovieDetail";
import Modal from "@/components/ui/Modal";
import { useMovieStore } from "@/lib/store";
import type { Movie } from "@/lib/types";

/**
 * A ficha por cima da tira.
 *
 * O store é a via rápida: o filme já foi baixado inteiro pela busca ou pelas
 * fileiras da semana, e pedir de novo seria pagar duas vezes pelo mesmo JSON.
 *
 * ── A reserva, e por que ela existe ─────────────────────────────────────────
 * Quando o store não tem o filme, este componente respondia com
 * `location.replace('/filme/…')`. Trocado em 10/09/2026, por dois estragos:
 *
 * 1. **Abandonava o modal.** A pessoa tocava num filme e recebia a página
 *    inteira, creme, com "← Voltar para a busca" no lugar do "Fechar" — a
 *    mesma ficha em duas roupas, sem padrão visível de qual viria. E o
 *    `replace` ainda comia a entrada do histórico, então o gesto de voltar
 *    deixava de devolver a home.
 * 2. **Gastava o limitador.** Cada `replace` é navegação de documento, e passa
 *    pelo `proxy.ts`, que corta em 30 fichas por minuto. Testar a interface no
 *    celular batia no teto sozinho, e o 429 chegava como download de `.txt`.
 *
 * Agora a rota interceptadora busca o filme no servidor e entrega aqui. O store
 * continua vencendo quando tem o filme: zero latência, e preserva o `reason`
 * daquela busca — a reserva traz o do L1 mais recente, que pode ser outro.
 *
 * ── Quando ainda vale ir para a página real ─────────────────────────────────
 * Só quando não há filme nenhum: id que não existe, webhook fora do ar. Aí a
 * página real é quem sabe responder — ela chama `notFound()` e mostra o 404 do
 * projeto, que um modal não tem como desenhar por cima de uma home.
 */
export default function InterceptedModal({
  tmdbId,
  reserva,
}: {
  tmdbId: number;
  reserva: Movie | null;
}) {
  const doStore = useMovieStore((estado) =>
    estado.movies.find((m) => m.tmdbId === tmdbId),
  );
  const movie = doStore ?? reserva;

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
