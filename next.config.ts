import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem `images.remotePatterns`: os pôsteres vêm do CDN do TMDB, que já serve
  // tamanhos pré-renderizados (/t/p/w342, /t/p/w780). Passar por `next/image`
  // faria cada pôster virar uma invocação de Image Optimization — cota gasta
  // para otimizar o que já está otimizado. Os cards (`FilmStrip`, `Footer`)
  // usam <img> com width e height explícitos para não causar layout shift; o
  // backdrop do herói também os tem, e o letreiro reserva altura por CSS
  // (`h-24`) porque o TMDB não manda a dimensão do PNG.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // clickjacking clássico
          {
            key: "Content-Security-Policy",
            // Só `frame-ancestors`: impede que ESTA página seja embutida por
            // terceiros. Não afeta o iframe do trailer, que é `frame-src` —
            // diretiva diferente, e que segue liberada porque uma CSP parcial
            // mal escrita quebra mais do que protege. CSP completa é tarefa
            // separada, depois de a UI estar fechada.
            value: "frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
