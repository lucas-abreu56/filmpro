/**
 * O contrato do FilmPro. Fonte única de verdade para browser, route handler e
 * workflow do n8n.
 *
 * ── Idioma ──────────────────────────────────────────────────────────────────
 * Chaves em inglês, conteúdo em português. As chaves espelham o TMDB, de onde
 * vem quase tudo; traduzir a chave e manter o valor em pt-BR criaria um mapa
 * campo a campo, que é onde bugs moram.
 *
 * Isto diverge do convite-aniversario, que usa `{ mensagem, resposta }`. É
 * divergência deliberada: lá o payload tem três campos próprios, aqui ele
 * espelha uma API externa em inglês.
 *
 * O projeto do curso não tinha contrato — a UI fazia `movie.titulo ||
 * movie.title` em oito lugares porque ninguém sabia qual era o formato. Este
 * arquivo existe para que isso não se repita.
 *
 * ── Nulos ───────────────────────────────────────────────────────────────────
 * Campo ausente é `null`, nunca string vazia. O TMDB devolve `overview: ""`
 * para títulos obscuros; normalizar para `null` é trabalho do n8n.
 */

/** Tamanho pedido ao TMDB para cada tipo de imagem. Ver `tmdb.ts`. */
export const LIMITS = {
  /** Mesma faixa que o projeto do curso já usava, e que a UI espelha. */
  MIN_PREFERENCES: 10,
  MAX_PREFERENCES: 500,
  /** Cada filme custa 2 chamadas ao TMDB, e 20 cards viram parede que ninguém
   *  rola. 8 preenche a tira sem estourar a latência. */
  DEFAULT_LIMIT: 8,
  MAX_LIMIT: 12,
  /** Teto do texto autoral do agente. Também é o `maxLength` no JSON Schema
   *  entregue ao modelo — o schema é o guardrail, não o prompt. */
  MAX_REASON: 220,
  MAX_COLLECTION_TITLE: 60,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// O que o agente pode escrever
// ────────────────────────────────────────────────────────────────────────────

/**
 * Os únicos campos autorais do sistema. Ambos são curadoria; nenhum é fato.
 *
 * O defeito central do projeto do curso era pedir ao LLM que preenchesse
 * `imdb_rating`, `poster_url`, `duration_minutes` e `streaming_platforms` —
 * coisas que ele não pode saber. Campo que não existe no schema não pode ser
 * alucinado, então eles simplesmente não estão aqui.
 *
 * `originalTitle` e `year` existem para a busca no TMDB: "The Shining" acerta
 * muito mais que "O Iluminado", e o ano desambigua remake.
 */
export interface AgentPick {
  title: string;
  originalTitle: string;
  year: number;
  reason: string;
}

export interface AgentOutput {
  /** O agente nomeia a coleção que acabou de montar. Curadoria pura —
   *  "suspense psicológico dos anos 90" → "Paranoia em Celuloide". */
  collectionTitle: string;
  movies: AgentPick[];
}

// ────────────────────────────────────────────────────────────────────────────
// O que o TMDB fornece
// ────────────────────────────────────────────────────────────────────────────

export interface CastMember {
  name: string;
  character: string | null;
  profileUrl: string | null;
}

/** `flatrate` é assinatura — é o que interessa em 90% dos casos. */
export type ProviderType = "flatrate" | "free" | "ads" | "rent" | "buy";

export interface WatchProvider {
  name: string;
  logoUrl: string | null;
  type: ProviderType;
}

/**
 * Um filme já enriquecido. Exatamente um campo aqui é autoral (`reason`); todo
 * o resto vem do TMDB e é auditável pelo `tmdbUrl`.
 */
export interface CrewMember {
  name: string;
  /** Papéis agregados: "Direção, Roteiro". A MUBI mostra assim. */
  role: string;
  profileUrl: string | null;
}

/** Cartão mínimo para as fileiras de "títulos semelhantes". Vem do TMDB e
 *  **não custa chamada de LLM** — é navegação de graça. */
export interface RelatedMovie {
  tmdbId: number;
  title: string;
  year: number | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  director: string | null;
}

export interface Movie {
  tmdbId: number;
  /** Link canônico. Serve de "prove que existe" para quem duvidar da lista. */
  tmdbUrl: string;
  /** `tt0098936`, de `external_ids`. É o que permite consultar o OMDB por id
   *  exato — sem ambiguidade de título homônimo. */
  imdbId: string | null;

  title: string;
  originalTitle: string | null;
  year: number | null;
  tagline: string | null;
  overview: string | null;

  posterUrl: string | null;
  /** Fotograma 16:9. É a imagem base da coluna; o pôster é a reserva. */
  backdropUrl: string | null;
  /** PNG do letreiro do filme, de `images.logos`. É como MUBI e Netflix põem
   *  o título sobre o fotograma sem usar texto. Quase sempre ausente. */
  logoUrl: string | null;
  /** Chave do YouTube do trailer, de `/videos` via `append_to_response`. */
  trailerKey: string | null;

  /** Nota do próprio TMDB — NÃO é a do IMDB. */
  rating: number | null;
  /** Permite à UI esconder a nota quando a amostra é pequena demais. */
  voteCount: number | null;
  /** Nota do IMDB, do OMDB consultado por `imdbId`. O TMDB não fornece isto. */
  imdbRating: number | null;
  imdbVotes: number | null;
  /** String do OMDB: "Won 1 Oscar. 42 wins & 89 nominations". Não dá para
   *  reproduzir os logos de festival da MUBI — ela usa base própria. */
  awards: string | null;

  runtime: number | null;
  genres: string[];
  keywords: string[];
  originalLanguage: string | null;
  /** Idiomas de áudio, para o selo "🔊 Inglês" da MUBI. */
  spokenLanguages: string[];
  /** Certificação brasileira: L, 10, 12, 14, 16, 18. */
  ageRating: string | null;
  director: string | null;
  cast: CastMember[];
  /** Direção, roteiro, fotografia, trilha — o bloco "Elenco e equipe". */
  crew: CrewMember[];
  /** "Parte da coleção X", quando o filme pertence a uma franquia. */
  collection: string | null;
  /** Fileira "Títulos semelhantes". */
  similar: RelatedMovie[];

  providers: WatchProvider[];
  /**
   * Quando os dados deste filme foram buscados no TMDB (ISO 8601). O cache de
   * fatos vive 90 dias porque pôster, sinopse e elenco não mudam — mas nota e
   * provedor mudam, então a UI mostra "disponibilidade verificada em {data}"
   * em vez de fingir que o dado é de agora.
   */
  fetchedAt: string;

  /**
   * ── Único campo escrito pelo modelo. ──
   *
   * `null` é possível, e não é descuido. `reason` é curadoria escrita para
   * UMA busca e mora em `search_cache.picks`, nunca na tabela `movies`. Na
   * resposta de `/api/recommendations` ele sempre existe. Já a ficha aberta
   * por link direto (`/filme/[tmdbId]`) pega o texto mais recente que citou
   * aquele filme — e pode não haver nenhum, se o L1 daquela busca já expirou.
   *
   * Marcar como `string` e devolver `null` foi exatamente o que deixaria a
   * tela renderizar vazio sem ninguém saber por quê.
   */
  reason: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// A API
// ────────────────────────────────────────────────────────────────────────────

/** Browser → `POST /api/recommendations` */
export interface RecommendationsRequest {
  preferences: string;
  limit?: number;
}

/** Route handler → webhook do n8n. `requestId` correlaciona o log da Vercel
 *  com a execução no n8n. O IP não vai junto: é PII, e o rate limit já foi
 *  resolvido antes. */
export interface N8nRecommendationsPayload {
  preferences: string;
  limit: number;
  requestId: string;
}

export interface RecommendationsResponse {
  requestId: string;
  /** A consulta como o usuário digitou, para a UI ecoar. */
  query: string;
  collectionTitle: string;
  /** Exposto de propósito: permite mostrar "servido do cache em 240 ms". */
  cached: boolean;
  generatedAt: string;
  movies: Movie[];
  /**
   * Títulos que o agente sugeriu e o TMDB não confirmou. Não viram card —
   * mas aparecem, porque "1 sugestão descartada por não constar no TMDB" é a
   * interface contando a verdade em vez de escondê-la.
   */
  notFound: string[];
}

/** Erro em qualquer rota. Mensagem já em português, pronta para exibir. */
export interface ApiError {
  error: string;
}

/**
 * `movies: []` com `notFound` cheio é **200, não erro**: o sistema funcionou,
 * a curadoria é que não sobreviveu à verificação no TMDB.
 */
export type RecommendationsResult = RecommendationsResponse | ApiError;

export function isApiError(value: RecommendationsResult): value is ApiError {
  return "error" in value;
}
