// Nó "Enfileirar titulos" — n8n-nodes-base.code
const saida = $input.first().json.output || {};
const filmes = Array.isArray(saida.movies) ? saida.movies : [];
// O agente respondeu, mas sem filme nenhum: e indisponibilidade do modelo, nao
// erro de cliente e nao defeito nosso. O 'Responder erro' devolve 503 para
// este no. Ate 09/09/2026 este throw pendurava o webhook ate o teto de 45 s do
// BFF, que entao mentia dizendo que a busca demorou demais.
//
// A mensagem e o que o usuario le, e o codigo vem do NOME DO NO — nao do
// texto: medido na execucao 2359, o no Code reescreve a mensagem do throw.
if (!filmes.length) {
  throw new Error('O curador esta indisponivel no momento. Tente de novo em alguns segundos.');
}
return filmes.map(function (f, i) {
  return { json: {
    rank: i,
    title: String(f.title || ''),
    originalTitle: String(f.originalTitle || f.title || ''),
    year: Number(f.year) || null,
    reason: String(f.reason || ''),
  } };
});
