import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Duas vozes, de propósito. Inter carrega o que é fato (vindo do TMDB e do
// OMDB); Fraunces carrega o que é autoral — os títulos do produto, o `reason`
// escrito pelo agente e o nome da coleção.
//
// Fraunces é uma serifa variável com eixos de softness e wonk, desenhada para
// ter calor e caráter. É recomendação, não detecção: as fontes dos sites de
// referência não foram identificadas — ver a nota em globals.css.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "FilmPro",
  description:
    "Descreva o que você quer assistir. Um agente de IA cura a lista e explica cada escolha; pôster, nota e onde assistir vêm do TMDB.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      {/* Interface acromática de propósito: a única cor forte da tela deve vir
          dos fotogramas dos filmes. É o princípio da MUBI, invertido para o
          claro. */}
      <body className="bg-papel text-tinta flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
