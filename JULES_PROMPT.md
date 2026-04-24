# Prompt para Jules — firebird-orm daily task

> Cole este prompt inteiro no Jules. Ele é auto-suficiente: instrui o agente a verificar o estado atual do repositório, escolher a próxima task segura, implementar e abrir um PR.

---

## Prompt

```
Você é um agente de desenvolvimento trabalhando no repositório GitHub: https://github.com/dennerstorres/firebird-orm

Sua tarefa de hoje é implementar **uma única task** do arquivo ROADMAP.md deste repositório.
Antes de qualquer coisa, você deve fazer verificações de segurança para evitar duplicação e conflitos.

---

## Passo 1 — Verificar o estado atual do repositório

Execute as seguintes verificações ANTES de escolher qualquer task:

**1a. Listar PRs abertos:**
Liste todos os Pull Requests abertos no repositório. Para cada PR aberto, identifique:
- O ID da task que ele implementa (ex: "task/F1" no nome do branch, ou "feat: implement F1" no título)
- Se o PR está em revisão, com conflito, ou aguardando merge

**1b. Listar branches ativos:**
Liste todos os branches remotos que seguem o padrão `task/*`.
Esses branches indicam tasks que já estão sendo ou foram trabalhadas.

**1c. Ler o ROADMAP.md:**
Leia o arquivo `ROADMAP.md` na raiz do repositório.
Mapeie quais tasks estão com status `[x]` (concluídas), `[~]` (em progresso) e `[ ]` (pendentes).

---

## Passo 2 — Decidir o que fazer

Com base nas informações coletadas, siga esta árvore de decisão:

**Caso A — Existe PR aberto para qualquer task (status `[~]` no ROADMAP ou branch `task/*` com PR):**
→ NÃO implemente nada.
→ Encerre com a mensagem:
  "Execução pausada: existe um PR aberto para a task [ID] (PR #[número]: [título]).
   Aguarde o merge ou fechamento desse PR antes de continuar.
   Nenhuma alteração foi feita no repositório."

**Caso B — Existe branch `task/<ID>` remoto sem PR aberto associado:**
→ Isso indica uma execução anterior que criou o branch mas não abriu o PR, ou o PR foi fechado sem merge.
→ Delete o branch remoto órfão.
→ No ROADMAP.md, reverta o status dessa task de `[~]` para `[ ]`.
→ Trate a task como pendente e prossiga para o Passo 3.

**Caso C — Nenhum PR aberto e nenhum branch `task/*` conflitante:**
→ Prossiga para o Passo 3 normalmente.

**Caso D — Todas as tasks estão com status `[x]` no ROADMAP.md:**
→ Encerre com a mensagem:
  "Todas as tasks do ROADMAP.md estão concluídas. Nenhuma ação necessária."

---

## Passo 3 — Escolher a task

Encontre a primeira task com status `[ ]` na tabela "Status geral" do ROADMAP.md,
seguindo estritamente a ordem de implementação recomendada no arquivo:
F1 → F2 → F3 → F4 → F5 → F6 → A1 → A2 → A3 → A4 → Q1 → Q2 → Q3 → Q4 → V1 → V2 → V3 → V4

Confirme que não existe PR aberto nem branch remoto para essa task (verificado no Passo 1).
Se existir qualquer conflito, aplique a lógica do Passo 2.

---

## Passo 4 — Entender a task

Leia com atenção a descrição completa da task escolhida no ROADMAP.md.
Preste atenção especial em:
- A seção "Convenções do projeto" no ROADMAP.md
- A seção "Quirks do Firebird" no ROADMAP.md
- Os requisitos específicos listados na task

Se a task depende de código de tasks anteriores (ex: F4 usa F2 e F3),
leia os arquivos já existentes no repositório para entender as interfaces antes de implementar.
Nunca assuma — leia o código real.

---

## Passo 5 — Implementar

Crie um branch a partir do `master` mais recente com o nome: `task/<ID>`
Exemplo: `task/F1`, `task/A2`

Implemente **somente** o que está descrito naquela task. Não implemente outras tasks em paralelo.

Regras obrigatórias de implementação:
- TypeScript strict — sem `any` em tipos públicos
- Queries Firebird SEMPRE com `FIRST`/`SKIP`, nunca `LIMIT`/`OFFSET`
- IDs gerados SEMPRE via `SELECT NEXT VALUE FOR <sequence> FROM RDB$DATABASE`
- INSERT deve terminar com `RETURNING <pk_column>` para capturar o ID
- Valores em queries SEMPRE via `?` placeholder — nunca concatenação de strings
- Nomes de tabela e coluna SEMPRE em MAIÚSCULO ao enviar para o banco
- JSDoc com `@example` em todo método ou tipo público que você criar
- Se a task pede testes, crie os testes em `src/__tests__/` usando Jest

---

## Passo 6 — Atualizar o ROADMAP.md

No arquivo `ROADMAP.md`, mude o status da task implementada de `[ ]` para `[~]` na tabela "Status geral".

Use `[~]` (em progresso), não `[x]` — o status só vai para `[x]` quando o PR for mergeado.
Isso sinaliza para execuções futuras que existe trabalho em andamento e evita duplicação.

---

## Passo 7 — Criar o Pull Request

Abra um Pull Request de `task/<ID>` para `master` com:

**Título:** `feat: implement <ID> - <Título da task>`
Exemplo: `feat: implement F3 - QueryBuilder interno`

**Body do PR:**
```
## Task implementada

**ID:** <ID>
**Título:** <Título da task conforme o ROADMAP.md>

## O que foi feito

<Descreva em 3-5 pontos o que foi implementado>

## Arquivos criados/modificados

- `<arquivo1>` — <para que serve>
- `<arquivo2>` — <para que serve>

## Como testar

<Instruções para rodar os testes ou verificar o comportamento>

## Quirks do Firebird respeitados

<Liste quais regras específicas do Firebird foram aplicadas nesta implementação>

## Checklist

- [ ] TypeScript compila sem erros (`npm run build`)
- [ ] Testes passam (`npm test`)
- [ ] JSDoc com @example nos métodos públicos
- [ ] Sem `any` em tipos públicos
- [ ] ROADMAP.md atualizado para `[~]`

Closes task <ID> do ROADMAP.md
```

---

## Restrições finais

- Implemente apenas UMA task por execução
- Nunca crie branch a partir de outro branch `task/*` — sempre a partir de `master`
- Não modifique arquivos fora do escopo da task escolhida
- Não refatore código de outras tasks já concluídas
- Se encontrar ambiguidade na especificação, implemente a interpretação mais simples e documente no PR body
- Em caso de dúvida sobre qualquer regra, consulte o ROADMAP.md — ele é a fonte da verdade
```
