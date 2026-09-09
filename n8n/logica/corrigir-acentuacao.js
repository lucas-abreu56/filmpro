// Corrige palavras do `reason` do curador que o modelo escreve sem acento.
//
// ── Leia antes de editar ────────────────────────────────────────────────────
//
// Medido em 09/09/2026: três baterias da mesma intenção deram 8/8, 5/8 e 1/8
// `reason` sem acento ("classico", "psicologico", "decada", "japones"). Duas
// correções mais óbvias foram DESCARTADAS por medição, não por preguiça:
//
// - Reforçar o prompt: a v5 (02/09/2026) já fez exatamente isso — o bloco
//   `<idioma>` com "ACENTUAÇÃO É OBRIGATÓRIA" e exemplos — e o defeito voltou.
//   Repetir mais alto é fazer o mesmo esperando resultado diferente.
// - Trocar de modelo: `gemini-3.1-flash-lite` foi escolhido em 03/09/2026
//   porque o `3.5-flash` levava 58-77s e 22% das buscas estouravam o teto de
//   45s do BFF. Trocaria defeito de texto por defeito de disponibilidade, pior.
//
// Esta função corrige por TABELA: um mapa de substituição sobre um léxico
// pequeno e INEQUÍVOCO — só entram palavras cuja forma sem acento não existe
// em português como outra palavra válida. "atmosfera" não leva acento e por
// isso não está aqui; entrar palavra ambígua criaria falso positivo.
//
// O nó do n8n NÃO importa este arquivo (nó Code não resolve import do
// repositório) — o corpo de `corrigirAcentuacao()` é COPIADO para o `jsCode`
// dos nós `Preparar registro` e `Montar resposta`. `paridade.test.js` compara
// os três lados e falha quando um muda sozinho.
//
// Mora em `n8n/logica/` e não em `n8n/nos/` porque
// `scripts/exportar-workflow.mjs` apaga `nos/` inteiro a cada exportação.

/** Palavra sem acento → forma correta. Chave em minúsculo, sem diacrítico. */
var LEXICO_ACENTUACAO = {
  nao: "não",
  psicologico: "psicológico",
  decada: "década",
  japones: "japonês",
  historia: "história",
  familia: "família",
  tragedia: "tragédia",
  solidao: "solidão",
};

/** Aplica LEXICO_ACENTUACAO palavra a palavra, preservando maiúscula inicial. */
function corrigirAcentuacao(texto) {
  var s = String(texto == null ? "" : texto);
  return s.replace(/[A-Za-zÀ-ÿ]+/g, function (palavra) {
    var certa = LEXICO_ACENTUACAO[palavra.toLowerCase()];
    if (!certa) return palavra;
    if (palavra[0] === palavra[0].toUpperCase()) {
      return certa[0].toUpperCase() + certa.slice(1);
    }
    return certa;
  });
}

export { LEXICO_ACENTUACAO, corrigirAcentuacao };
