import type { Movie, RecommendationsResponse } from "@/lib/types";

/**
 * Dados falsos para desenvolver a interface antes de o workflow do n8n existir.
 *
 * Os títulos, anos e diretores são reais; nota, duração e elenco são
 * plausíveis mas **inventados**, e não saem daqui — nada neste arquivo é
 * servido em produção. `posterUrl` e `backdropUrl` são `null` de propósito,
 * para exercitar o mesmo caminho de fallback que filmes obscuros vão percorrer
 * de verdade.
 *
 * Só é usado quando `NEXT_PUBLIC_FILMPRO_MOCK=1`. Ver `SearchPanel`.
 */

/**
 * Fotograma procedural: um gradiente derivado do id, para quando não há
 * imagem. **Não é só recurso de mock** — é o fallback de produção para filme
 * sem backdrop no TMDB, que é comum em título obscuro. A mesma função serve
 * aos dois casos.
 */
export function fotogramaProcedural(seed: number): string {
  const h = (seed * 47) % 360;
  const h2 = (h + 38) % 360;
  // Meio-tom: fotograma de filme raramente é quase preto, e sob
  // `grayscale` um gradiente escuro vira um retângulo chapado.
  return `linear-gradient(155deg, hsl(${h} 30% 46%), hsl(${h2} 26% 22%))`;
}

function filme(
  tmdbId: number,
  title: string,
  originalTitle: string,
  year: number,
  director: string,
  genres: string[],
  runtime: number,
  reason: string,
): Movie {
  return {
    tmdbId,
    tmdbUrl: `https://www.themoviedb.org/movie/${tmdbId}`,
    imdbId: null,
    title,
    originalTitle,
    year,
    tagline: null,
    overview:
      "Sinopse de exemplo. Em produção este texto vem do TMDB em pt-BR, e pode faltar em títulos obscuros — a interface precisa aguentar a ausência.",
    posterUrl: null,
    backdropUrl: null,
    logoUrl: null,
    trailerKey: null,
    rating: null,
    voteCount: null,
    imdbRating: null,
    imdbVotes: null,
    awards: null,
    runtime,
    genres,
    keywords: [],
    originalLanguage: null,
    spokenLanguages: [],
    ageRating: null,
    director,
    cast: [],
    crew: [],
    collection: null,
    similar: [],
    providers: [],
    fetchedAt: new Date().toISOString(),
    reason,
  };
}

const FILMES: Movie[] = [
  filme(
    1, "O Iluminado", "The Shining", 1980, "Stanley Kubrick",
    ["Terror", "Suspense"], 146,
    "Você pediu claustrofobia: aqui ela vem de um hotel grande demais, o que é bem mais desconfortável que um espaço apertado.",
  ),
  filme(
    2, "Repulsa ao Sexo", "Repulsion", 1965, "Roman Polanski",
    ["Terror", "Drama"], 105,
    "O apartamento vai se deformando junto com quem mora nele. É a definição de terror psicológico contido em quatro paredes.",
  ),
  filme(
    3, "A Conversação", "The Conversation", 1974, "Francis Ford Coppola",
    ["Suspense", "Drama"], 113,
    "Paranoia construída por som, não por imagem. Se o que te incomoda é não saber no que confiar, é este.",
  ),
  filme(
    4, "Cães de Aluguel", "Reservoir Dogs", 1992, "Quentin Tarantino",
    ["Crime", "Suspense"], 99,
    "Poucos personagens, um galpão só, e a tensão vem inteira do diálogo. Anos 90 como você pediu.",
  ),
  filme(
    5, "Seven — Os Sete Crimes Capitais", "Se7en", 1995, "David Fincher",
    ["Crime", "Suspense"], 127,
    "O final que incomoda depois de acabar. Difícil pedir isso e não chegar aqui.",
  ),
  filme(
    6, "Ensaio sobre a Cegueira", "Blindness", 2008, "Fernando Meirelles",
    ["Drama", "Ficção científica"], 121,
    "Coloquei um brasileiro na lista de propósito: mesma sensação de encurralamento, outra gramática visual.",
  ),
  filme(
    7, "O Bebê de Rosemary", "Rosemary's Baby", 1968, "Roman Polanski",
    ["Terror", "Drama"], 137,
    "Ninguém acredita nela, e o filme te faz duvidar junto. A ameaça é sempre social antes de ser sobrenatural.",
  ),
  filme(
    8, "Corra!", "Get Out", 2017, "Jordan Peele",
    ["Terror", "Suspense"], 104,
    "Fecha a lista com o mais recente: a mesma paranoia de ambiente, agora com a cortesia como arma.",
  ),
];

export const RESPOSTA_FALSA: RecommendationsResponse = {
  requestId: "mock-0000",
  query: "suspense psicológico claustrofóbico, poucos personagens",
  collectionTitle: "Paredes Que Se Aproximam",
  cached: false,
  generatedAt: new Date().toISOString(),
  movies: FILMES,
  notFound: ["Um Título Que O TMDB Não Confirmou"],
};
