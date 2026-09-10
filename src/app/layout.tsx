import type { Metadata } from "next";
import { Big_Shoulders, Inter } from "next/font/google";
import Cursor from "@/components/ui/Cursor";
import Footer from "@/components/ui/Footer";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

// Founders Grotesk X-Condensed (kirlian) e Schabo Condensed (Awwwocado) são
// pagas. A documentação da kirlian aponta Big Shoulders Display como substituta
// livre; o Google desde então fundiu a variante Display na família "Big
// Shoulders", que é a que o next/font conhece — `Big_Shoulders_Display` dá
// "Unknown font".
//
// Duas vozes, e a distinção carrega a tese do projeto: a display é a voz do
// produto; Inter carrega tudo que se lê em linha, com curadoria e metadado
// separados por tamanho e peso, não por família.
const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

// A URL canônica do site. `NEXT_PUBLIC_SITE_URL` permite sobrepor em preview
// da Vercel; o fallback é o domínio de produção. Sem `metadataBase` qualquer
// URL relativa de Open Graph (a imagem, o canonical) sai quebrada.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://filmpro.lucasschwingel.com";

const DESCRICAO =
  "Descreva o que você quer assistir. Um agente de IA cura a lista e explica cada escolha; pôster, nota e onde assistir vêm do TMDB.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `default` para a home, `template` para as fichas (`%s — FilmPro` já é o
  // formato que `/filme/[tmdbId]` monta à mão — o template não muda isso, só
  // cobre rotas futuras que esqueçam de sufixar).
  title: {
    default: "FilmPro — cinema por curadoria de IA",
    template: "%s — FilmPro",
  },
  description: DESCRICAO,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "FilmPro",
    locale: "pt_BR",
    title: "FilmPro — cinema por curadoria de IA",
    description: DESCRICAO,
    // A imagem é `src/app/opengraph-image.tsx` (convenção de arquivo do Next).
    // Não declarar `images` aqui: o Next injeta a rota de imagem sozinho, e
    // repetir causaria dois `og:image`.
  },
  twitter: {
    card: "summary_large_image",
    title: "FilmPro — cinema por curadoria de IA",
    description: DESCRICAO,
  },
};

// `LayoutProps<"/">` é gerado pelo Next a partir das rotas que existem de
// verdade: o slot `@modal` entra ali sozinho (ver `LayoutSlots` em
// `.next/types/routes.d.ts`). Escrever o tipo à mão compila igual hoje e
// mente amanhã — renomear a pasta do slot passaria batido pelo TypeScript.
export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${display.variable} h-full antialiased`}
    >
      <head>
        {/* Todo pôster, backdrop e letreiro vem do CDN do TMDB, e a conexão
            com essa origem só abre quando o parser chega no primeiro `<img>`.
            O `preconnect` adianta o handshake TLS — rende no LCP, que é uma
            imagem de terceiro. */}
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
      </head>
      <body className="bg-papel text-tinta flex min-h-full flex-col font-sans">
        {/* Grão de película sobre a página inteira. Não recebe clique e some
            para quem pediu menos movimento. */}
        <div className="grao" aria-hidden="true" />
        <Cursor />
        <SmoothScroll>
          {children}
          {/* Persistente em toda rota, e é de propósito: a atribuição do TMDB é
              exigência contratual da API, não um enfeite da home. */}
          <Footer />
          {modal}
        </SmoothScroll>
      </body>
    </html>
  );
}
