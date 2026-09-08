import FilmStrip from "@/components/features/FilmStrip";
import Hero from "@/components/features/Hero";
import SearchPanel from "@/components/features/SearchPanel";
import SearchResults from "@/components/features/SearchResults";
import { sanitizeAuthoredText, sanitizeReasonOrNull } from "@/lib/sanitize";
import { LIMITS, type HomeSection, type HomeSectionsResponse } from "@/lib/types";

/**
 * O webhook de leitura das fileiras semanais (`FilmPro — Fileiras da Home`).
 * Sem LLM e sem TMDB do lado do n8n: ele lê `home_sections` já junto com
 * `movies`. Mesma convenção de fallback dos outros dois webhooks.
 */
const HOME_WEBHOOK_URL =
  process.env.N8N_FILMPRO_HOME_WEBHOOK ??
  "https://<seu-n8n>/webhook/filmpro/home";

/**
 * As fileiras mudam uma vez por semana, segunda às 6h. Não há motivo para
 * revalidar a cada visita como um dado ao vivo — mas também não convém o TTL
 * de dias que os *fatos* de um filme usam (`REVALIDA_S` em `/filme`), porque
 * aqui o que muda é a curadoria inteira, não só nota e provedor. Uma hora dá
 * folga para conferir a estreia de uma semana nova sem esperar o dia inteiro.
 */
const REVALIDA_HOME_S = 3600;

/**
 * Rotação cromática das fileiras semanais. Os cinco tokens já existiam em
 * `globals.css` sem nenhum uso — a doc de identidade prometia "um matiz por
 * coleção" e nunca foi feito. Determinístico por `position`, não por índice
 * do array: se o webhook algum dia pular uma posição, a cor não desliza.
 * Aplicado só aqui, no filete do rótulo — nunca no título (h2), que é texto
 * corrido.
 */
const CORES_FILEIRA = [
  "text-teal",
  "text-azul",
  "text-verde",
  "text-roxo",
  "text-rosa",
] as const;

/** Cinco fileiras, cinco rótulos — "Recorte da semana" repetido cinco vezes
 * lia como formulário, não como revista. */
const ROTULOS_FILEIRA = [
  "Recorte da semana",
  "Também da semana",
  "Ainda esta semana",
  "Mais um recorte",
  "Fechando a semana",
] as const;

interface Fileiras {
  week: string | null;
  sections: HomeSection[];
}

/** Formata `"2026-08-31"` como `"31.08"` — sem passar por `Date`, que
 *  interpretaria a data como UTC e arriscaria voltar um dia em fusos
 *  negativos. É só recorte de string. */
function formatarSemana(week: string | null): string | null {
  if (!week) return null;
  const [, mes, dia] = week.split("-");
  return mes && dia ? `${dia}.${mes}` : null;
}

async function buscarFileiras(): Promise<Fileiras> {
  if (process.env.NEXT_PUBLIC_FILMPRO_MOCK === "1") {
    const { FILEIRAS_FALSAS } = await import("@/lib/mock");
    return { week: null, sections: FILEIRAS_FALSAS };
  }

  // Mesma postura dos outros dois webhooks: sem chave, reclame no log em vez
  // de mandar header vazio e receber um 403 que parece problema do n8n.
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    console.error("N8N_API_KEY não está definida nas variáveis de ambiente");
    return { week: null, sections: [] };
  }

  try {
    const res = await fetch(HOME_WEBHOOK_URL, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: REVALIDA_HOME_S },
    });

    if (!res.ok) {
      console.error(`Webhook de fileiras da home respondeu ${res.status}`);
      return { week: null, sections: [] };
    }

    const corpo = (await res.json()) as HomeSectionsResponse;

    // Terceira passagem sobre o texto autoral (as outras duas: `Montar
    // fileiras` no n8n, e o `/api/recommendations` que gerou a curadoria
    // originalmente). A regra do projeto é que nada escrito por modelo chega
    // à tela só por já ter passado por outra camada antes.
    const sections = (corpo.sections ?? []).map((secao) => ({
      ...secao,
      collectionTitle: sanitizeAuthoredText(secao.collectionTitle, {
        maxLength: LIMITS.MAX_COLLECTION_TITLE,
        fallback: "Seleção da semana",
      }),
      movies: secao.movies.map((m) => ({
        ...m,
        reason: sanitizeReasonOrNull(m.reason),
      })),
    }));

    return { week: corpo.week ?? null, sections };
  } catch (err) {
    console.error("Falha ao buscar fileiras da home:", err);
    return { week: null, sections: [] };
  }
}

export default async function Home() {
  const { week, sections: fileiras } = await buscarFileiras();
  const destaque = fileiras[0];
  const filmeDoHeroi = destaque?.movies[0];

  return (
    // A mesa de montagem precisa de largura: em `max-w-5xl` cabiam três
    // fotogramas de oito. O cabeçalho e a busca continuam estreitos logo
    // abaixo — texto corrido em 1344 px vira linha longa demais para ler.
    <main className="mx-auto flex w-full max-w-[84rem] flex-1 flex-col px-6 py-16 sm:py-24">
      {/* O herói: um filme só, tela cheia, atrás da busca — três protótipos
          testados no scratchpad (still, faixa clara, trailer de verdade),
          aprovado por captura em 07/09/2026. Sem `backdropUrl` (mock, ou
          falha do webhook), cai no cabeçalho claro de sempre, sem herói. */}
      {filmeDoHeroi?.backdropUrl ? (
        <div className="-mt-16 sm:-mt-24">
          <Hero movie={filmeDoHeroi} semanaLabel={formatarSemana(week)} />
        </div>
      ) : (
        <header className="mb-16 w-full max-w-5xl">
          <p className="text-apoio font-display text-xs tracking-[0.16em] uppercase">
            FilmPro
          </p>

          {/* Display condensada em vw, para o título tocar as margens em
              qualquer largura.
              A entrelinha é 0.88, não os 0.75 do sistema da kirlian: aquele
              valor foi medido sobre caixa alta em inglês, e em português os
              diacríticos sobem acima da altura de maiúscula — a 0.78 o
              circunflexo de "VOCÊ" colidia com a linha de cima. */}
          <h1 className="font-display mt-3 text-[clamp(2.75rem,9vw,7rem)] leading-[0.88] font-medium uppercase">
            O que você
            <br />
            quer sentir
            <br />
            hoje?
          </h1>

          <p className="text-apoio mt-8 max-w-md text-sm leading-relaxed">
            Descreva o filme que você procura. Um agente cura a lista e
            escreve o motivo de cada escolha — pôster, nota, duração e onde
            assistir vêm do TMDB, não do modelo.
          </p>

          <div className="mt-8">
            <SearchPanel />
          </div>
        </header>
      )}

      {/* Sempre no papel claro, nunca dentro do herói — ver o docblock de
          `SearchResults`. */}
      <SearchResults />

      {/* As fileiras semanais: abaixo da busca, de propósito — quem já sabe o
          que quer digita e nunca precisa rolar até aqui. Isto é para quem
          ainda não sabe, e prefere descobrir a descrever.

          O cabeçalho de bloco existe para separar isto do resultado de uma
          busca, que aparece logo acima e é a OUTRA coisa que a página faz.
          Sem ele, as duas coleções se encostam e leem como uma lista só. */}
      {fileiras.length > 0 && (
        <div className="mt-24 flex w-full flex-col gap-20">
          <header className="border-fio-forte -mb-8 border-t pt-6">
            <p className="text-apoio font-display text-xs tracking-[0.16em] uppercase">
              Escolhas da semana
            </p>
          </header>

          {fileiras.map((secao) => {
            const cor = CORES_FILEIRA[(secao.position - 1) % CORES_FILEIRA.length];
            const rotulo =
              ROTULOS_FILEIRA[(secao.position - 1) % ROTULOS_FILEIRA.length];

            return (
              <section key={secao.position} className="fileira-revela">
                <header className="mb-6 max-w-5xl">
                  <p
                    className={`font-display flex items-baseline gap-2 text-xs tracking-[0.16em] uppercase ${cor}`}
                  >
                    <span className="tabular-nums">
                      {String(secao.position).padStart(2, "0")}
                    </span>
                    {rotulo}
                  </p>
                  <h2 className="font-display mt-1 text-[clamp(2.5rem,7vw,5rem)] leading-[0.85] font-medium uppercase">
                    {secao.collectionTitle}
                  </h2>
                </header>

                <FilmStrip movies={secao.movies} />
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
