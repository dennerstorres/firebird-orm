# Prompt para Jules — firebird-orm daily task

> Cole este prompt inteiro no Jules. Ele é auto-suficiente: instrui o agente a ler o ROADMAP.md, escolher a próxima task pendente, implementar e abrir um PR.

---

## Prompt

```
Você é um agente de desenvolvimento trabalhando no repositório GitHub: https://github.com/dennerstorres/firebird-orm

Sua tarefa de hoje é implementar **uma única task** do arquivo ROADMAP.md deste repositório.

## Passo 1 — Ler o plano

Leia o arquivo `ROADMAP.md` na raiz do repositório.
Encontre a primeira task com status `[ ]` na seção "Status geral", seguindo a ordem recomendada:
F1 → F2 → F3 → F4 → F5 → F6 → A1 → A2 → A3 → A4 → Q1 → Q2 → Q3 → Q4 → V1 → V2 → V3 → V4

## Passo 2 — Entender a task

Leia com atenção a descrição completa da task escolhida no ROADMAP.md.
Preste atenção especial em:
- A seção "Convenções do projeto" no ROADMAP.md
- A seção "Quirks do Firebird" no ROADMAP.md
- Os requisitos específicos listados na task

Se a task depende de código de tasks anteriores (ex: F4 usa F2 e F3), leia os arquivos já criados no repositório para entender as interfaces existentes antes de implementar.

## Passo 3 — Implementar

Crie um branch com o nome: `task/<ID>` (ex: `task/F1`, `task/A2`)

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

## Passo 4 — Atualizar o ROADMAP.md

No arquivo `ROADMAP.md`, mude o status da task implementada de `[ ]` para `[x]` na tabela "Status geral".

## Passo 5 — Criar o Pull Request

Abra um Pull Request com:

**Título:** `feat: implement <ID> - <Título da task>`
Exemplo: `feat: implement F3 - QueryBuilder interno`

**Body do PR:**
```
## Task implementada

**ID:** <ID>
**Título:** <Título>

## O que foi feito

<Descreva em 3-5 pontos o que foi implementado>

## Arquivos criados/modificados

- `<arquivo1>` — <para que serve>
- `<arquivo2>` — <para que serve>

## Como testar

<Instruções para rodar os testes ou verificar o comportamento>

## Quirks do Firebird respeitados

<Liste quais regras específicas do Firebird foram aplicadas nesta implementação>

Closes task <ID> do ROADMAP.md
```

## Restrições importantes

- Implemente apenas UMA task por execução
- Não modifique arquivos fora do escopo da task escolhida
- Não refatore código de outras tasks já concluídas
- Se encontrar ambiguidade na especificação da task, implemente a interpretação mais simples e documente a decisão no PR body
```
