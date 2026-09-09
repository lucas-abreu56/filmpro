import { create } from "zustand";
import { type Movie, type RecommendationsResponse } from "./types";

interface MovieStore {
  movies: Movie[];
  setMovies: (movies: Movie[]) => void;
  adicionarMovies: (movies: Movie[]) => void;
  getMovieById: (id: number) => Movie | undefined;
}

export const useMovieStore = create<MovieStore>((set, get) => ({
  movies: [],
  setMovies: (movies) => set({ movies }),
  /**
   * Junta sem substituir — é o que as fileiras da home usam.
   *
   * `setMovies` continua sendo o certo para a busca: resultado novo troca o
   * anterior inteiro. Mas a home e a busca coexistem na mesma tela, e quem
   * busca, fecha a ficha e depois abre um filme da semana precisa dos dois
   * conjuntos no store ao mesmo tempo. Substituir ali derrubaria um dos lados
   * e a ficha voltaria a cair na página inteira.
   *
   * A entrada que já está no store vence a repetida: o `reason` da busca é
   * escrito para aquela busca, e a fileira da semana traz outro para o mesmo
   * filme. Preservar o que estava evita a frase trocar sob quem já a leu.
   */
  adicionarMovies: (movies) =>
    set((estado) => {
      const conhecidos = new Set(estado.movies.map((m) => m.tmdbId));
      const novos = movies.filter((m) => !conhecidos.has(m.tmdbId));
      return novos.length ? { movies: [...estado.movies, ...novos] } : estado;
    }),
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
