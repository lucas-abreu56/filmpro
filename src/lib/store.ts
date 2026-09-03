import { create } from "zustand";
import { type Movie } from "./types";

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
