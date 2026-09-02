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
const INVISIVEL = /[​-‍﻿⁠]/g;
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
const promptVersion = 4;

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
