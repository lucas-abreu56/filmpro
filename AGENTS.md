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

## Diretrizes de Governança e Arquitetura (Vibecoding & SDD)

- **Spec-Driven Development (SDD):** Siga a arquitetura definida (como este `AGENTS.md` e o `NOTES.local.md`). Não "alucine" bibliotecas ou padrões arquiteturais novos sem aprovação explícita.
- **Karpathy Skills (Governança):**
  - **Não complique:** Use a solução mais simples possível. Evite *over-engineering*.
  - **Não assuma:** Pergunte em caso de ambiguidade antes de tomar decisões irreversíveis.
  - **Mudanças cirúrgicas:** Modifique apenas o estritamente necessário. Não altere arquivos ou escopos adjacentes sem motivo.
  - **Double Check:** Compilar, lintar e testar não prova comportamento — prova só que o código roda. Exercite o caminho real de uso (rodar a app, repetir o fluxo com dado real) antes de dar uma tarefa como pronta, e nunca confie em captura estática para validar um componente com estado.
- **Poda de Código:** Procure ativamente e apague código morto, lógica duplicada ou abstrações inúteis. Manter é tão importante quanto criar.
- **Design Responsável:** Foque na substância (resolução de problemas e dados reais) em vez de efeitos cosméticos pesados (ex: gradientes excessivos, bibliotecas 3D sem necessidade). O projeto deve ser maduro e performático.

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
