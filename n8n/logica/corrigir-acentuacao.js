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
// A correção tem DUAS camadas, aplicadas nesta ordem a cada palavra:
//
// 1. TABELA (`LEXICO_ACENTUACAO`): mapa sobre um léxico INEQUÍVOCO — só entram
//    palavras cuja forma sem acento não existe em português como outra palavra
//    válida, INCLUINDO conjugação verbal e título de obra adotado sem acento no
//    Brasil. "atmosfera" não leva acento e por isso não está aqui;
//    "referencia"/"sequencia"/"experiencia" são 3ª pessoa de verbos correntes e
//    ficam de fora; "memoria"/"acao"/"genero"/"espaco"/"classico" foram
//    EXCLUÍDAS (decisão do Lucas, 10/09/2026) por colidirem com título de obra
//    BR sem acento — o caso real é o filme "Memoria" (2021). A tabela também
//    corrige CEDILHA ("espaco" → "espaço").
//
// 2. REGRA DE PADRÃO -ção/-são/-xão (Fase 6c, 10/09/2026): palavra terminada em
//    "cao", "sao" ou "xao" — e os plurais "coes"/"soes"/"xoes" — ganha o til.
//    "reflexao"→"reflexão", "descompressao"→"descompressão", "invasao"→"invasão".
//    Em português essas terminações são SEMPRE til faltando: não há palavra
//    correta terminada em "-cao"/"-sao"/"-xao" (nem "cao"/"sao" isolados, que
//    também viram "cão"/"são"). Um léxico palavra-por-palavra nunca cobriria o
//    conjunto — são centenas de "-ção". A tabela continua para o que NÃO segue
//    padrão (japones, decada, ruina, logica, cenario...).
//
// A regra 2 é escrita como um mapa `SUFIXO_ATONO` para o `paridade.test.js`
// poder comparar as três cópias por texto, igual à tabela.
//
// Aplicado ao `reason` E ao `collectionTitle` (Fase 6b, 10/09/2026 — a Fase 6
// original só cobria o `reason`). A home lê o `collection_title` gravado pelo
// robô sem retoque, então o título sem acento só sai da produção se a correção
// rodar aqui, na origem.
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
  espetaculo: "espetáculo",
  espetaculos: "espetáculos",
  ruina: "ruína",
  ruinas: "ruínas",
  fantastico: "fantástico",
  fantastica: "fantástica",
  fantasticos: "fantásticos",
  fantasticas: "fantásticas",
  coreografico: "coreográfico",
  coreografica: "coreográfica",
  cenario: "cenário",
  cenarios: "cenários",
  solitario: "solitário",
  solitaria: "solitária",
  espaco: "espaço",
  pastelao: "pastelão",
  vinganca: "vingança",
  imersao: "imersão",
  estetica: "estética",
  esteticas: "estéticas",
  definicao: "definição",
  definicoes: "definições",
  construcao: "construção",
  construcoes: "construções",
  observacao: "observação",
  observacoes: "observações",
  logica: "lógica",
};

/**
 * Terminação átona (sem o til) → terminação correta.
 *
 * "-cao" vira "-ção" (o "c" da terminação passa a "ç"); "-sao" e "-xao"
 * mantêm a consoante e só ganham o til. Os plurais seguem a mesma lógica.
 * As palavras "cao" e "sao" ISOLADAS são a exceção: viram "cão" e "são" (sem
 * "ç"), tratadas à parte em `corrigirAcentuacao()`.
 */
var SUFIXO_ATONO = {
  coes: "ções",
  soes: "sões",
  xoes: "xões",
  cao: "ção",
  sao: "são",
  xao: "xão",
};

/** As duas palavras "-ao" que ganham só o til, sem "ç". */
var PALAVRA_ATONA = { cao: "cão", sao: "são" };

/**
 * Corrige acentuação palavra a palavra, preservando maiúscula inicial:
 * primeiro a TABELA (match exato), depois a REGRA DE PADRÃO de terminação.
 */
function corrigirAcentuacao(texto) {
  var s = String(texto == null ? "" : texto);
  return s.replace(/[A-Za-zÀ-ÿ]+/g, function (palavra) {
    var minuscula = palavra.toLowerCase();

    var certa = LEXICO_ACENTUACAO[minuscula];
    if (!certa) {
      // "cao"/"sao" isoladas: só o til, sem "ç".
      if (PALAVRA_ATONA[minuscula]) {
        certa = PALAVRA_ATONA[minuscula];
      } else {
        // Regra de padrão: a palavra TERMINA numa terminação átona.
        var sufixos = Object.keys(SUFIXO_ATONO);
        for (var i = 0; i < sufixos.length; i++) {
          var atono = sufixos[i];
          if (
            minuscula.length > atono.length &&
            minuscula.slice(-atono.length) === atono
          ) {
            certa = palavra.slice(0, palavra.length - atono.length) + SUFIXO_ATONO[atono];
            break;
          }
        }
        if (!certa) return palavra;
      }
      // A caixa do miolo já vem de `palavra`; só a inicial precisa de cuidado.
      if (palavra[0] === palavra[0].toUpperCase()) {
        return certa[0].toUpperCase() + certa.slice(1);
      }
      return certa;
    }

    if (palavra[0] === palavra[0].toUpperCase()) {
      return certa[0].toUpperCase() + certa.slice(1);
    }
    return certa;
  });
}

export { LEXICO_ACENTUACAO, SUFIXO_ATONO, PALAVRA_ATONA, corrigirAcentuacao };
