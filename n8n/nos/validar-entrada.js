// Nó "Validar entrada" — n8n-nodes-base.code
const body = $input.first().json.body || {};
const preferences = String(body.preferences || '').trim();
// Ate 09/09/2026 este throw matava o workflow sem resposta: o webhook
// pendurava e o BFF desistia em 45 s com "A busca demorou demais" — mentira
// sobre um erro de cliente que o sistema soube na hora. Agora o no tem
// onError: continueErrorOutput ligado ao 'Responder erro', que responde 400.
//
// A MENSAGEM E O QUE O USUARIO LE: o 'Responder erro' a repassa como veio.
// Nao tente embutir o codigo HTTP aqui — MEDIDO na execucao 2359: o no Code
// do n8n REESCREVE a mensagem do throw, tirando qualquer prefixo e anexando
// ' [line N]'. Um contrato por texto nao sobrevive ao runtime. O codigo vem
// do NOME DO NO de origem, que o n8n preserva.
if (preferences.length < 10) {
  throw new Error('Descreva o que voce quer assistir em pelo menos 10 caracteres.');
}
const bruto = Number(body.limit);
const limit = Math.min(Math.max(Number.isInteger(bruto) ? bruto : 8, 1), 12);
const texto = preferences.slice(0, 500);

// 'human' | 'robot'. Decidido em 05/09/2026: o workflow de fileiras semanais
// manda 'robot' em cada uma das 5 chamadas por semana ('Curar tema'), para a
// telemetria em 'searches' distinguir uso de gente de verdade da home
// gerando a si mesma. Qualquer valor que nao seja exatamente 'robot' vira
// 'human' — inclusive ausente, que e o caso de todo trafego de producao ja
// existente, que nunca vai mandar este campo.
const source = String(body.source || '').trim() === 'robot' ? 'robot' : 'human';

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
//
// v6 (03/09/2026): o modelo principal passou de gemini-3.5-flash para
// gemini-3.1-flash-lite. O curador levava de 58 a 77 s e 24% das buscas vivas
// estouravam o teto de 45 s do BFF; agora leva de 4 a 15 s. Bumpar aqui e a
// regra escrita tres paragrafos acima, e nao um extra: o cache guardava
// curadoria de dois modelos diferentes sob a mesma chave.
//
// v7 (04/09/2026): a regra 4 do prompt mandava NUNCA incluir o filme citado
// pela pessoa. Medido em producao numa bateria de 11 buscas: 'Vingadores' nao
// trazia nenhum filme dos Vingadores, e 'O Poderoso Chefao' nenhum Poderoso
// Chefao — a curadoria era boa, mas quem digita o titulo costuma querer o
// titulo. Agora o citado abre a lista. Sem este bump, toda busca ja gravada
// continuaria sem o titulo pedido por ate 30 dias.
//
// v8 (09/09/2026): o prompt NAO mudou — mudou 'Escolher correspondencia', que
// e o no que resolve o titulo do curador em filme do TMDB. A pontuacao dele
// escolhia o filme errado quando havia homonimo: 'The Assassin' (2015) virava
// 'The Sand' (terror B, IMDb 3.8) e 'Burning' (2018) virava um registro hindi
// vazio de 6 votos, em vez do Lee Chang-dong de 1883. Bumpar aqui porque o
// cache guarda o RESULTADO da resolucao: sem isto, toda busca ja gravada
// continuaria servindo o filme errado por ate 30 dias. O material hasheado nao
// distingue prompt de pipeline — o que importa e que a saida mudou.
//
// v9 (09/09/2026): 'Preparar registro' e 'Montar resposta' passam a corrigir
// por TABELA um lexico pequeno e inequivoco de palavras que o modelo escreve
// sem acento no reason ("nao", "psicologico", "decada", "japones" e outras —
// ver n8n/logica/corrigir-acentuacao.js). Bumpar aqui porque o cache guarda o
// RESULTADO da correcao: sem isto, toda busca ja gravada continuaria servindo
// o reason sem acento por ate 30 dias.
const promptVersion = 9;

return [{ json: {
  preferences: texto,
  queryNorm: queryNorm,
  promptVersion: promptVersion,
  material: queryNorm + '|' + limit + '|' + promptVersion,
  limit: limit,
  source: source,
  // Folga sobre o que o usuario pediu, por dois motivos que se somam.
  //
  // Verificacao: nem todo titulo do curador sobrevive ao TMDB. Era +2, e a
  // telemetria de 25 buscas vivas mostrou onde isso falha: 22 nao
  // descartaram nada, 2 descartaram 1, e UMA descartou 4 — entregando 6
  // filmes onde foram pedidos 8. Com +4 essa mesma busca fecharia a lista.
  //
  // Disponibilidade (04/09/2026): 'Montar resposta' agora poe na frente quem
  // tem onde ser assistido no Brasil, e a doc registra 3 de 8 filmes da
  // colecao de teste sem provedor no BR (~37%). Com 12 candidatos sobrariam
  // ~7,6 disponiveis para 8 vagas — perto demais da conta. Com 15, ~9,5.
  //
  // Cada titulo a mais custa ~110 ms de TMDB e OMDB e uma linha em movies,
  // que fica no cache de fatos para a proxima. E o teto do schema do curador
  // (formato-da-resposta.schema.json, maxItems) TEM de acompanhar: 12+7=19.
  // Sem isso o parser recusa a resposta no limit maximo — verificado na
  // execucao 2092, em que o curador devolveu 19 titulos.
  pedir: limit + 7,
  requestId: String(body.requestId || ''),
  inicio: Date.now(),
} }];
