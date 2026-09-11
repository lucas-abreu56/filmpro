<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regra de Handoff (Contexto e Estado)

O arquivo `docs/NOTES.local.md` é o documento oficial de Handoff e estado de sessão (ignorado no git).

**OBRIGAÇÃO DO AGENTE:** Ao final de uma sessão de trabalho, após resolver defeitos, tomar decisões arquiteturais ou realizar commits, você DEVE atualizar o arquivo `docs/NOTES.local.md` antes de encerrar o trabalho.

Siga esta estrutura para manter o documento limpo:
1. **Atualize o Estado Real:** Atualize a branch, último commit (HEAD) e status do deploy.
2. **O que foi construído/corrigido:** Liste as alterações feitas, referenciando os commits.
3. **Decisões tomadas (com o porquê):** Registre por que uma solução foi escolhida (especialmente se contrariar convenções padrão ou envolver performance).
4. **Limpeza do Pendente:** Marque itens resolvidos do roadmap ou dos defeitos como CONCLUÍDO. Não apague os defeitos passados silenciosamente; documente a resolução.
5. **Próximo passo:** Deixe claro o que deve ser feito na próxima sessão para quem assumir o projeto.
6. **Buffer Rolante e Poda (Teto de 400 linhas):** O `NOTES.local.md` deve conter no máximo as últimas 2 a 3 sessões (~400 linhas). Ao ultrapassar esse limite, transfira o histórico antigo para `docs/NOTES-historico.local.md`. Nunca deixe o arquivo acumular logs fósseis.
7. **Leia o `NOTES.local.md` UMA vez por sessão.** Medido em 09/09/2026: ele foi lido **25 vezes numa única sessão**, e as releituras de arquivo custaram 205k tokens no total — o segundo maior desperdício do projeto, atrás só das imagens. Leia no início; no meio da sessão, se precisar conferir um ponto específico, use `Grep` em vez de `Read` do arquivo inteiro; no fim, atualize por `Edit` sem reler.

   O mesmo vale para arquivo de código em iteração (`FilmStrip.tsx` foi lido 22x): depois do primeiro `Read`, siga por `Edit`. **Não releia para "conferir se aplicou"** — um `Edit` que falha retorna erro, então silêncio já é confirmação.

## Diretrizes de Governança e Arquitetura (Vibecoding & SDD)

- **Spec-Driven Development (SDD):** Siga a arquitetura definida (como este `AGENTS.md` e o `NOTES.local.md`). Não "alucine" bibliotecas ou padrões arquiteturais novos sem aprovação explícita.
- **Karpathy Skills (Governança):**
  - **Não complique:** Use a solução mais simples possível. Evite *over-engineering*.
  - **Não assuma:** Pergunte em caso de ambiguidade antes de tomar decisões irreversíveis.
  - **Mudanças cirúrgicas:** Modifique apenas o estritamente necessário. Não altere arquivos ou escopos adjacentes sem motivo.
  - **Double Check:** Compilar, lintar e testar não prova comportamento — prova só que o código roda. Exercite o caminho real de uso (rodar a app, repetir o fluxo com dado real) antes de dar uma tarefa como pronta, e nunca confie em captura estática para validar um componente com estado.
- **Poda de Código:** Procure ativamente e apague código morto, lógica duplicada ou abstrações inúteis. Manter é tão importante quanto criar.
- **Design Responsável:** Foque na substância (resolução de problemas e dados reais) em vez de efeitos cosméticos pesados (ex: gradientes excessivos, bibliotecas 3D sem necessidade). O projeto deve ser maduro e performático.

## 21st.dev: referência, nunca dependência

CLI instalada em 10/09/2026 (`npm i -g @21st-dev/cli`, `21st login` — conta
`lucassoliveiraabreu`). Substitui o MCP que foi usado em 06/09/2026.

**A decisão que vale, tomada em 06/09/2026** (registrada na seção 7 de
`docs/planos/plano-home-visual.local.md`): o 21st.dev entra como **referência de
técnica e de geometria**. Nada de lá vira dependência — o projeto tem 4
dependências e não é uma busca de componente que vai introduzir a quinta.
Código de lá, se usado, entra **lido, renomeado para o vocabulário do projeto e
ajustado à identidade** (`docs/identidade-visual.md`). Colar e seguir é como o
visual genérico entra num projeto que tem identidade própria.

Duas coisas medidas na instalação, que mudam como usar:

- **`search` é ilimitado; `get` é 2 por dia** no plano free (confirmado rodando
  `usage` antes e depois de um `search`: a quota não se moveu). Portanto: busque
  à vontade, e gaste `get` só no componente que você já decidiu estudar.
- **`generate` e `iterate` não estão habilitados** nesta conta. Não chame.

**Pegadinha de script:** busca sem resultado sai com **exit 127** — a CLI ainda
sofre um `Assertion failed` do libuv ao encerrar no Windows. Em script, 127 é
lido como "comando não encontrado", o que faria um CI reportar a ferramenta como
ausente quando ela só não achou nada. **Cheque a saída, não o código de saída.**
Reproduzido 3× em 10/09/2026.

Em CI ou script, pule o login: `--api-key <chave>`, ou a variável
`API_KEY_21ST` / `TWENTYFIRST_TOKEN` (a CLI aceita as três formas).

## Restrição de licença: o projeto é NÃO COMERCIAL

Decidido pelo Lucas em 08/09/2026. O FilmPro é peça de portfólio, e isso não é
preferência estética — é a condição que mantém válidas as APIs do TMDB e do
OMDb, as duas gratuitas só para uso não comercial. O detalhe e as citações
literais dos termos estão no `README.md`, seção "Licenças e atribuição".

**Obrigação legal não quebra build, não falha teste e não aparece no lint.** Por
isso ela mora aqui: se ninguém perguntar, ela nunca aparece. Três mudanças
quebram a conformidade, e nenhuma delas dá erro:

1. **Qualquer receita** — anúncio, plano pago, afiliado de streaming, venda do
   app. Exige acordo comercial por escrito com o TMDB *antes*.
2. **Alimentar o modelo com conteúdo do TMDB.** Hoje o curador escolhe títulos
   com o repertório dele e o TMDB entra depois, só para resolver títulos em
   fatos. Inverter essa ordem cruza a linha.
3. **Deixar o modelo responder *sobre* os filmes** usando dado do TMDB, em vez
   de só escolher títulos. O parágrafo de abertura de
   `n8n/nos/curador.prompt.md` é o que segura isso, e tem um aviso no arquivo.

Se uma tarefa pedir qualquer uma das três, **pare e levante com o Lucas** em vez
de implementar. Ao acrescentar API, dataset, fonte ou mídia de terceiro, levante
os termos na hora — a atribuição exigida entra junto com o código que a usa,
nunca "depois".

## Auditoria pré-commit (obrigatória)

Antes de todo `git commit`, revise o que está em `git diff --cached` — não o que "deveria" ter mudado, o que de fato está staged. Responda, por escrito, às 4 perguntas:

1. **Segurança:** expõe dado de usuário, credencial ou rota sem proteção? Abre brecha (injeção, SSRF, path traversal, XSS)?
2. **Eficiência:** aguenta escala? Query em loop, N+1, payload inflado, trabalho repetido a cada request?
3. **Regressões:** o que isso pode quebrar no resto do projeto? Componente que consome o mesmo estado, contrato de API, rota que compartilha layout.
4. **Testes:** o que precisa ser escrito ou rodado antes de ir para produção? Rode o que já existe.

Liste os achados e corrija o que for crítico antes de commitar. Commit trivial (uma linha de doc, ajuste de texto) passa pela mesma porta — a revisão é rápida, não é dispensada.

Um hook `PreToolUse` bloqueia o `git commit` até o aval ser gravado. Como o hook roda **antes** do comando, faça em dois passos separados:

1. Num comando só para isso: `git diff --cached | git hash-object --stdin > .claude/.review-ok`
2. Noutro comando, o `git commit` sozinho.

Aval e commit na mesma linha com `&&` não funciona — quando o hook checa, o aval ainda não existe. O aval é de uso único e vale só para aquele diff exato; mudou o staged, revisa de novo. Script em `.claude/hooks/revisao-pre-commit.sh` (fora do git — a regra é esta seção).
