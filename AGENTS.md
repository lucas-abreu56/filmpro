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
