/**
 * As sugestões prontas da tela inicial.
 *
 * Vivem aqui, e não dentro do componente, porque `scripts/aquecer-cache.mjs`
 * também precisa delas: são as consultas que o cache guarda antes de o
 * primeiro visitante chegar. Se as duas listas fossem cópias, editar um botão
 * silenciosamente esfriaria o cache — e ninguém perceberia, porque o sintoma é
 * só "demorou 16 segundos" em vez de um erro.
 *
 * Depois de mudar qualquer uma destas frases, rode:
 *
 *   node --env-file=.env scripts/aquecer-cache.mjs
 */
export const EXEMPLOS = [
  "Suspense psicológico dos anos 90",
  "Ficção científica que discute o que é ser humano",
  "Comédia romântica sem clichê",
  "Animação que funciona para adulto",
] as const;
