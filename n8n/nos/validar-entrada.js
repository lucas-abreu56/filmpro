// Nó "Validar entrada" — n8n-nodes-base.code
const body = $input.first().json.body || {};
const preferences = String(body.preferences || '').trim();
if (preferences.length < 10) {
  throw new Error('preferences precisa de ao menos 10 caracteres.');
}
const bruto = Number(body.limit);
const limit = Math.min(Math.max(Number.isInteger(bruto) ? bruto : 8, 1), 12);
const texto = preferences.slice(0, 500);

// ESPELHA src/lib/sanitize.ts::normalizeQuery CARACTERE POR CARACTERE.
// Se as duas divergirem, o cache erra em SILENCIO: nenhum erro, so um hash
// diferente e um acerto que nunca acontece. A ordem importa — o trim vem
// ANTES de tirar a pontuacao final, senao 'anos 90!' e 'anos 90! ' geram
// hashes distintos. Isso ja foi pego por teste uma vez.
//
// Os invisiveis sao declarados por NUMERO, nao escritos como caractere. Foi a
// invisibilidade que deixou o U+00AD existir so do lado do TypeScript sem
// ninguem notar: ninguem confere a olho o que nao se ve. Por numero, a lista
// se le, se compara com a do outro lado, e atravessa qualquer serializacao.
var INVISIVEIS = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad];
var INVISIVEL = new RegExp('[' + INVISIVEIS.map(function (c) {
  return String.fromCharCode(c);
}).join('') + ']', 'g');
const queryNorm = texto
  .normalize('NFC')
  .toLowerCase()
  .replace(INVISIVEL, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[.,;:!?]+$/, '')
  .trim();

// Entra no material hasheado: editar o prompt — ou trocar o modelo principal,
// que muda a curadoria tanto quanto — invalida o cache inteiro sozinho, sem
// DELETE e sem migracao.
//
// v4 (02/09/2026): as v2 e v3 gravaram listas genericas porque o agente
// recebia o pedido VAZIO — o no Postgres do cache substituia o item antes
// dele. Cache envenenado e pior que cache frio: serve o erro por 30 dias.
//
// v5 (02/09/2026): a v4 escrevia reason SEM ACENTO NENHUM — "psicologico",
// "decada", "nao" — em 4 de 4 filmes conferidos no cache. O prompt pedia
// portugues mas nunca exigia acentuacao, e o modelo usou a brecha. Num
// produto cujo diferencial e o texto, isso e defeito de primeira ordem.
const promptVersion = 5;

return [{ json: {
  preferences: texto,
  queryNorm: queryNorm,
  promptVersion: promptVersion,
  material: queryNorm + '|' + limit + '|' + promptVersion,
  limit: limit,
  pedir: limit + 2,
  requestId: String(body.requestId || ''),
  inicio: Date.now(),
} }];
