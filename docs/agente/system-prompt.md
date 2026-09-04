# O prompt do curador — onde ele vive e como se mexe nele

## Este arquivo não é o prompt

**O texto publicado está em [`n8n/nos/curador.prompt.md`](../../n8n/nos/curador.prompt.md).**
Aquele arquivo é **gerado** a partir do workflow que roda em produção, por
`scripts/exportar-workflow.mjs`. A fonte de verdade é o workflow; o arquivo é o
espelho, e ele não tem como mentir, porque ninguém o escreve à mão.

Aqui ficou só o que não é gerado: o mapa e as regras de como mexer.

> **Por que a mudança, em 04/09/2026.** Até esta data este arquivo se declarava
> *"a fonte de verdade — edite aqui e cole no n8n, nunca o contrário"*. Ele não
> era. O prompt em produção já tinha as seções `<reason>` e `<collectionTitle>`
> enquanto este trazia `<como_escrever_o_motivo>` e `<nome_da_colecao>` — nomes
> de seção diferentes, ou seja, dois prompts, não duas redações do mesmo. A
> divergência passou despercebida porque nada quebra quando ela acontece:
> o produto segue funcionando com o texto publicado, e o arquivo segue sendo
> lido por quem for editar.
>
> É o mesmo defeito que aposentou o `n8n/filmpro-recomendacoes.ts`, e a
> sentença já estava escrita no [`n8n/README.md`](../../n8n/README.md): *"Um
> arquivo que se anuncia como fonte de verdade e não é vale menos que arquivo
> nenhum, porque alguém age em cima dele."* A correção é a mesma daquela vez:
> parar de manter um espelho à mão.

## Onde está cada coisa

| o quê | onde | escrito à mão? |
|---|---|---|
| O texto do prompt | `n8n/nos/curador.prompt.md` | não — gerado |
| O número da versão, com o histórico e o motivo de cada bump | `n8n/nos/validar-entrada.js` (`promptVersion`) | não — gerado |
| O envelope do pedido do usuário | `n8n/workflow.json`, nó `Curador`, campo `text` | não — gerado |
| O schema da resposta | `n8n/nos/formato-da-resposta.schema.json` | não — gerado |

Nenhum número é repetido aqui de propósito. Número copiado é número que
envelhece sozinho — foi assim que este arquivo passou a mentir.

## Como editar o prompt

1. Edite **no n8n**, no nó `Curador`, campo `options.systemMessage` — ou pelo
   MCP, com `update_workflow`.
2. **Publique.** Salvar cria uma versão nova sem ativá-la: o `activeVersionId`
   continua na anterior e a produção segue com o texto velho. Confirme com
   `versionId === activeVersionId`.
3. **Incremente `promptVersion`** em `Validar entrada`, e escreva ali por quê,
   no formato das entradas que já existem. O número entra no material do hash
   (`queryNorm|limit|promptVersion`): sem o incremento, o cache continua
   servindo por até 30 dias respostas geradas pelo prompt antigo, e passa a
   guardar curadoria de dois prompts diferentes sob a mesma chave.
   **Isso zera o cache L1** — cada consulta antiga custa uma chamada de modelo
   na primeira vez que rodar de novo. É o preço, e ele é aceito de propósito.
4. **Sincronize o repositório**, nesta ordem:

   ```bash
   # 1. baixe o workflow vivo (MCP: get_workflow_details) e grave o objeto
   #    `workflow` em n8n/workflow.json
   # 2. só então:
   node scripts/exportar-workflow.mjs n8n/workflow.json
   ```

   O exportador **lê o JSON local**, apesar do nome — ele não busca nada no
   n8n. Rodá-lo sem atualizar o `workflow.json` antes regenera `n8n/nos/*` a
   partir da cópia velha e desfaz a edição em silêncio, deixando a árvore
   limpa como se nada tivesse mudado.

5. Teste com busca real em produção. O teto da rota é **5 buscas por minuto**
   (`src/app/api/recommendations/route.ts`), porque cada uma custa uma chamada
   de LLM e até 16 ao TMDB.

## O que o prompt não decide

Nota, duração, pôster, elenco, classificação e onde assistir vêm do TMDB e do
OMDB **depois** que o curador responde. Qualquer coisa que ele dissesse sobre
isso seria descartada em `Montar fatos`.

A ordem em que os filmes aparecem na tela **também não é dele**: o curador
ordena por relevância, e `Montar resposta` reordena pondo na frente quem tem
onde ser assistido no Brasil. Quem for ajustar o prompt esperando controlar a
primeira posição precisa saber disso.
