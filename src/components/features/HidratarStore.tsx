"use client";

import { useEffect } from "react";

import { useMovieStore } from "@/lib/store";
import type { Movie } from "@/lib/types";

/**
 * Ponte entre a home (Server Component) e o `useMovieStore`.
 *
 * A home não pode chamar `setMovies` — ela roda no servidor. Sem isto, o
 * store fica vazio para quem clica num filme das fileiras semanais, e o
 * `InterceptedModal` cai no fallback de página inteira por não achar o filme.
 * Não renderiza nada; só grava.
 */
export default function HidratarStore({ movies }: { movies: Movie[] }) {
  const adicionarMovies = useMovieStore((state) => state.adicionarMovies);

  useEffect(() => {
    adicionarMovies(movies);
  }, [movies, adicionarMovies]);

  return null;
}
