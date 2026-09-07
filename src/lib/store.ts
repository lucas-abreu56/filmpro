import { create } from "zustand";
import { type Movie, type RecommendationsResponse } from "./types";

interface MovieStore {
  movies: Movie[];
  setMovies: (movies: Movie[]) => void;
  getMovieById: (id: number) => Movie | undefined;
}

export const useMovieStore = create<MovieStore>((set, get) => ({
  movies: [],
  setMovies: (movies) => set({ movies }),
  getMovieById: (id) => get().movies.find((m) => m.tmdbId === id),
}));

/**
 * Estado da busca, compartilhado entre `SearchPanel` (o formulário, que no
 * herói mora dentro do cartão escuro) e `SearchResults` (a tira de
 * resultados, que precisa desenhar no papel claro de sempre — nunca dentro
 * do herói). Antes de 07/09/2026 era `useState` local de um componente só;
 * separou porque um cartão que cresce com os resultados dentro do herói
 * escuro herdava `.tema-escuro` para sempre, e a tira de resultados ficava
 * ilegível assim que passava da imagem de fundo.
 */
export type EstadoBusca =
  | { fase: "parado" }
  | { fase: "buscando" }
  | { fase: "pronto"; dados: RecommendationsResponse; ms: number }
  | { fase: "erro"; mensagem: string };

interface SearchStore {
  estado: EstadoBusca;
  setEstado: (estado: EstadoBusca) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  estado: { fase: "parado" },
  setEstado: (estado) => set({ estado }),
}));
