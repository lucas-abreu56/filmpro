"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import MovieDetail from "@/components/features/MovieDetail";
import { useMovieStore } from "@/lib/store";

export default function InterceptedModal({ tmdbId }: { tmdbId: number }) {
  const router = useRouter();
  const getMovieById = useMovieStore((state) => state.getMovieById);
  const [movie, setMovie] = useState(() => getMovieById(tmdbId));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    // Se, por algum motivo exótico, o store estiver vazio e hidratarmos sem o filme
    // (ex: recarregou a página, embora rotas interceptadas devam cair no page real 
    // nesses casos, mas para garantir), redirecionamos ou fechamos.
    if (!movie) {
      // router.replace(`/filme/${tmdbId}`); // force hard navigation
      // Mas o Next já deveria cuidar disso sozinho num hard reload.
    }
  }, [movie, tmdbId]);

  if (!hydrated) return null; // evita mismatch
  if (!movie) {
     // Fallback UI ou encerramento (o next dev fará hard navigate se for direct link)
     return null;
  }

  return (
    <Modal>
      <MovieDetail movie={movie} />
    </Modal>
  );
}
