# Roadmap — firebird-orm

> Este arquivo é o plano oficial de evolução do pacote.
> Cada task é auto-contida e pode ser implementada de forma independente por um agente de IA.
> Status: `[ ]` pendente · `[~]` em progresso (PR aberto, aguardando review/merge) · `[x]` concluído (PR mergeado)

---

## Como contribuir (humanos e agentes de IA)

1. Escolha uma task com status `[ ]`
2. Implemente apenas aquela task — não misture tasks em um único PR
3. Nomeie o branch como `task/<id>` — ex: `task/F1`
4. O PR deve conter apenas os arquivos relevantes para aquela task
5. Descreva no PR body: o que foi feito, qual task resolve, e como testar

---

## Convenções do projeto

- **Linguagem:** TypeScript strict (`"strict": true` no tsconfig)
- **Banco alvo:** Firebird 2.5+ e 3.0+
- **Driver base:** `node-firebird` (já no package.json)
- **Testes:** Jest — arquivos em `src/__tests__/`
- **Estilo:** sem `any` em tipos públicos, genéricos explícitos
- **Queries:** SEMPRE usar `FIRST`/`SKIP` (nunca `LIMIT`/`OFFSET`)
- **IDs:** SEMPRE usar sequences (`NEXT VALUE FOR`) — Firebird não tem AUTO_INCREMENT
- **Nomes de tabela/coluna:** enviar em MAIÚSCULO para o banco
- **Strings parametrizadas:** SEMPRE usar `?` como placeholder — nunca concatenar valores na query

---

## Quirks do Firebird que toda implementação deve respeitar

```
- Paginação:    SELECT FIRST 10 SKIP 20 * FROM TABELA   (não LIMIT/OFFSET)
- ID gerado:    SELECT NEXT VALUE FOR GEN_TABELA_ID FROM RDB$DATABASE
- Insert + ID:  INSERT INTO T (cols) VALUES (?) RETURNING ID
- String vazia: Firebird trata '' como NULL — use espaço ou evite
- Booleano:     não existe tipo BOOLEAN no FB 2.5 — use SMALLINT (0/1)
- Datas:        usar tipo DATE, TIME ou TIMESTAMP — nunca VARCHAR para datas
- Case names:   nomes sem aspas viram MAIÚSCULO internamente
- Transações:   toda operação precisa de uma transação ativa (auto-commit disponível)
```

---

## Fase 1 — Fundação técnica

### F1 · Tipos e interfaces base
**Arquivos:** `src/types.ts`
**Descrição:** Criar todas as interfaces e tipos públicos do ORM. Nenhuma lógica — só contratos TypeScript.

Deve conter:
- `FirebirdConnectionOptions` — opções de conexão (host, port, database, user, password, charset, poolSize)
- `FindOptions<T>` — where, orderBy, take, skip, select
- `ColumnMetadata` — propertyKey, columnName, nullable, primary, generated, sequenceName
- `FirebirdOrmError extends Error` — erro base com prefixo `[firebird-orm]`
- `EntityNotFoundError extends FirebirdOrmError`
- `NoPrimaryKeyError extends FirebirdOrmError`

Requisitos:
- Todos os campos com JSDoc explicando para que serve
- Comentários especiais nos campos que têm quirks do Firebird (ex: `take` → explica que vira `FIRST`)
- `FindOptions.take` e `FindOptions.skip` devem ter `@remarks` explicando a conversão para `FIRST/SKIP`

---

### F2 · Decorators de entidade
**Arquivos:** `src/decorators.ts`
**Descrição:** Implementar os decorators que mapeiam classes TypeScript para tabelas do Firebird.

Decorators a implementar:
- `@Entity(tableName: string)` — registra a tabela via `Reflect.metadata`
- `@Column(options?)` — registra coluna; `name` padrão = propertyKey em MAIÚSCULO
- `@PrimaryGeneratedColumn(options?)` — PK com sequence; `sequenceName` padrão = `GEN_{TABELA}_{COLUNA}`
- `@PrimaryColumn(options?)` — PK manual sem geração automática

Funções helpers a exportar:
- `getTableName(target: Function): string` — lança erro se sem @Entity
- `getColumnMetadata(target: Function): ColumnMetadata[]`
- `getPrimaryColumn(target: Function): ColumnMetadata` — lança `NoPrimaryKeyError` se não houver

Requisitos:
- Usar `reflect-metadata` (já no package.json)
- Nomes de tabela e coluna sempre em MAIÚSCULO ao armazenar
- JSDoc com `@example` em cada decorator

---

### F3 · QueryBuilder interno
**Arquivos:** `src/query-builder.ts`
**Descrição:** Classe responsável por montar strings SQL válidas para o Firebird. Não executa queries — só monta o SQL e os parâmetros.

Métodos a implementar:
- `buildSelect(tableName, columns, where, orderBy, take, skip): { sql: string, params: unknown[] }`
- `buildInsert(tableName, columns, values): { sql: string, params: unknown[] }`
- `buildUpdate(tableName, sets, pkColumn, pkValue): { sql: string, params: unknown[] }`
- `buildDelete(tableName, pkColumn, pkValue): { sql: string, params: unknown[] }`
- `buildCount(tableName, where): { sql: string, params: unknown[] }`

Regras críticas:
- `buildSelect` com `take` → `SELECT FIRST {n}` no início
- `buildSelect` com `skip` → `SELECT FIRST {take ?? 999999} SKIP {n}`
- `buildInsert` → terminar com `RETURNING {pkColumn}` para capturar o ID gerado
- Todos os valores via `?` — nunca concatenação

Testes obrigatórios em `src/__tests__/query-builder.spec.ts`:
- SELECT sem opções
- SELECT com FIRST/SKIP
- SELECT com WHERE múltiplo
- INSERT com RETURNING
- UPDATE por ID
- DELETE por ID

---

### F4 · Repository
**Arquivos:** `src/repository.ts`
**Descrição:** Classe `Repository<T>` que executa as operações CRUD usando o QueryBuilder e o node-firebird.

```typescript
class Repository<T> {
  find(options?: FindOptions<T>): Promise<T[]>
  findOne(id: number | string): Promise<T | null>
  findOneOrFail(id: number | string): Promise<T>  // lança EntityNotFoundError
  save(entity: Partial<T>): Promise<T>            // INSERT ou UPDATE (upsert por PK)
  update(id: number | string, data: Partial<T>): Promise<void>
  delete(id: number | string): Promise<void>
  count(where?: Partial<T>): Promise<number>
}
```

Regras:
- `save()` sem PK → INSERT com `NEXT VALUE FOR` antes, captura ID via `RETURNING`
- `save()` com PK preenchida → UPDATE
- `find()` mapeia linhas do banco (nomes MAIÚSCULO) para propriedades da entidade (camelCase)
- Usar `queryAsync` wrapper que promisifica o callback do node-firebird
- Toda operação de escrita deve rodar dentro de `db.transaction()`

---

### F5 · Connection e createConnection
**Arquivos:** `src/connection.ts`
**Descrição:** Gerenciar a conexão com o banco e expor `getRepository`.

```typescript
class FirebirdConnection {
  getRepository<T>(EntityClass: new () => T): Repository<T>
  close(): Promise<void>
  transaction<R>(fn: (repo: Repository<T>) => Promise<R>): Promise<R>
}

function createConnection(options: FirebirdConnectionOptions): Promise<FirebirdConnection>
```

Regras:
- Usar pool do node-firebird (`Firebird.pool(size, options)`)
- `getRepository` deve cachear instâncias por classe
- `close()` deve destruir o pool

---

### F6 · Barrel export + index.ts
**Arquivos:** `src/index.ts`
**Descrição:** Exportar tudo que é público. Deve ser o único arquivo que o consumidor importa.

```typescript
export { createConnection } from './connection';
export { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn } from './decorators';
export type { FirebirdConnectionOptions, FindOptions } from './types';
export { FirebirdOrmError, EntityNotFoundError, NoPrimaryKeyError } from './types';
export type { Repository } from './repository';
```

---

## Fase 2 — AI-friendliness

### A1 · Arquivo llms.txt
**Arquivos:** `llms.txt` (raiz do projeto)
**Descrição:** Arquivo de contexto para agentes de IA. Padrão emergente adotado por Vercel, Supabase, etc.
O arquivo deve conter em texto plano:
- O que o pacote faz em 2 linhas
- Todos os quirks do Firebird com exemplos SQL
- Exemplos de uso correto e incorreto dos métodos
- Lista de erros comuns e como resolver
- Tabela de equivalências: MySQL/PostgreSQL → Firebird

---

### A2 · JSDoc completo em todos os métodos públicos
**Arquivos:** todos os arquivos em `src/`
**Descrição:** Adicionar JSDoc com `@example`, `@param`, `@returns`, `@throws` e `@remarks` (para quirks do Firebird) em cada método e decorator público.

Requisito especial: nos métodos onde o Firebird se comporta diferente de outros bancos, adicionar:
```typescript
/**
 * @remarks
 * **Firebird quirk:** diferente do MySQL, aqui o Firebird faz X porque Y.
 */
```

---

### A3 · Exemplos inline no código-fonte
**Arquivos:** `src/examples/` (nova pasta)
**Descrição:** Criar arquivos de exemplo que agentes de IA encontram via RAG no node_modules.

Arquivos a criar:
- `src/examples/basic-crud.ts` — exemplo completo de CRUD
- `src/examples/transactions.ts` — uso de transações
- `src/examples/pagination.ts` — paginação com FIRST/SKIP
- `src/examples/sequences.ts` — como criar e usar sequences no Firebird

Cada arquivo deve ter comentários explicando cada linha, especialmente os pontos que diferem de outros ORMs.

---

### A4 · Mensagens de erro acionáveis
**Arquivos:** `src/types.ts`, `src/decorators.ts`, `src/repository.ts`
**Descrição:** Revisar todas as mensagens de erro para que ensinem o desenvolvedor (ou agente) o que fazer.

Padrão esperado:
```
[firebird-orm] A entidade "Usuario" não possui @PrimaryGeneratedColumn ou @PrimaryColumn.
Adicione um dos decorators na propriedade de chave primária antes de usar o Repository.

Exemplo:
  @PrimaryGeneratedColumn({ sequenceName: 'GEN_USUARIOS_ID' })
  id: number;
```

---

## Fase 3 — Qualidade e infraestrutura

### Q1 · Testes de integração com Docker
**Arquivos:** `docker-compose.yml`, `src/__tests__/integration/`
**Descrição:** Configurar ambiente Docker para rodar testes contra um Firebird real.

```yaml
# docker-compose.yml
services:
  firebird:
    image: jacobalberty/firebird:3.0
    environment:
      ISC_PASSWORD: masterkey
      FIREBIRD_DATABASE: test.fdb
    ports:
      - "3050:3050"
```

Testes de integração a criar:
- `connection.integration.spec.ts` — conectar, pingar, fechar
- `repository.integration.spec.ts` — CRUD completo
- `transaction.integration.spec.ts` — commit e rollback

---

### Q2 · GitHub Actions CI
**Arquivos:** `.github/workflows/ci.yml`
**Descrição:** Pipeline que roda em todo PR.

Passos:
1. `npm install`
2. `npm run build` (TypeScript)
3. `npm test` (unit tests)
4. Subir Firebird via docker-compose
5. Rodar integration tests

---

### Q3 · CONTRIBUTING.md
**Arquivos:** `CONTRIBUTING.md`
**Descrição:** Guia para contribuidores humanos e agentes de IA.

Seções:
- Setup local (pré-requisitos, `npm install`, como rodar os testes)
- Convenções de código (nomes, tipos, SQL)
- Como criar uma issue
- Como fazer um PR (branch naming, tamanho, descrição)
- Quirks do Firebird que todo contribuidor precisa conhecer

---

### Q4 · Changelog e versionamento semântico
**Arquivos:** `CHANGELOG.md`, `.commitlintrc.json`
**Descrição:** Adotar Conventional Commits e manter CHANGELOG.

Formato de commit:
```
feat(repository): add count() method
fix(decorators): column name not uppercased when name option provided
docs(readme): add pagination example
```

---

## Fase 4 — Features avançadas

### V1 · Query Builder fluente (API pública)
**Arquivos:** `src/fluent-query-builder.ts`
**Descrição:** API encadeável para queries complexas.

```typescript
const users = await connection
  .createQueryBuilder(Usuario)
  .where('ATIVO = ?', [1])
  .andWhere('NOME LIKE ?', ['João%'])
  .orderBy('NOME', 'ASC')
  .take(10)
  .skip(0)
  .getMany();
```

Regras:
- Internamente usar o QueryBuilder da F3
- `getMany()` retorna `Promise<T[]>`
- `getOne()` retorna `Promise<T | null>`
- `getCount()` retorna `Promise<number>`

---

### V2 · Suporte a Stored Procedures
**Arquivos:** `src/procedure.ts`
**Descrição:** Executar stored procedures do Firebird.

```typescript
const result = await connection.callProcedure('SP_CALCULA_TOTAL', [pedidoId]);
```

Nota: Firebird usa `EXECUTE PROCEDURE` e `SELECT * FROM PROCEDURE` (selectable procedures).

---

### V3 · Suporte a BLOB
**Arquivos:** `src/blob.ts`
**Descrição:** Ler e gravar campos BLOB (subtype 0 = binário, subtype 1 = texto).

O node-firebird retorna BLOBs como função callback — o ORM deve abstrair isso automaticamente ao mapear resultados.

---

### V4 · Migrations CLI
**Arquivos:** `src/cli/`, `bin/firebird-orm.js`
**Descrição:** Ferramenta de linha de comando para gerenciar migrations.

```bash
npx firebird-orm migration:generate -n CreateUsuarios
npx firebird-orm migration:run
npx firebird-orm migration:revert
```

Nota: O Firebird não permite renomear tabelas — migrations de rename precisam de estratégia alternativa (criar nova, copiar dados, dropar antiga).

---

## Ordem de implementação recomendada

```
F1 → F2 → F3 → F4 → F5 → F6   (fundação — implementar nessa ordem)
A1 → A2 → A3 → A4              (AI-friendliness — pode intercalar com fundação)
Q1 → Q2 → Q3 → Q4              (qualidade — após F6)
V1 → V2 → V3 → V4              (features — após Q1)
```

---

## Status geral

| Task | Título | Status |
|------|--------|--------|
| F1 | Tipos e interfaces base | [x] |
| F2 | Decorators de entidade | [x] |
| F3 | QueryBuilder interno | [x] |
| F4 | Repository | [x] |
| F5 | Connection e createConnection | [x] |
| F6 | Barrel export + index.ts | [x] |
| A1 | Arquivo llms.txt | [x] |
| A2 | JSDoc completo | [ ] |
| A3 | Exemplos inline | [ ] |
| A4 | Mensagens de erro acionáveis | [ ] |
| Q1 | Testes de integração com Docker | [ ] |
| Q2 | GitHub Actions CI | [ ] |
| Q3 | CONTRIBUTING.md | [ ] |
| Q4 | Changelog e versionamento | [ ] |
| V1 | Query Builder fluente | [ ] |
| V2 | Stored Procedures | [ ] |
| V3 | Suporte a BLOB | [ ] |
| V4 | Migrations CLI | [ ] |
