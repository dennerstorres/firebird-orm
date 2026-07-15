# firebird-orm

> ORM elegante, tipado e com decorators para **Firebird 2.5 / 3.0 / 4.0 / 5.0**, escrito em TypeScript e construído sobre o driver [`node-firebird`](https://www.npmjs.com/package/node-firebird).

[![CI](https://github.com/dennerstorres/firebird-orm/actions/workflows/ci.yml/badge.svg)](https://github.com/dennerstorres/firebird-orm/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/firebird-orm.svg)](https://www.npmjs.com/package/firebird-orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)

Um ORM pequeno, explícito e sem mágica. Mapeia classes TypeScript para tabelas Firebird usando decorators, oferece um `Repository` genérico com CRUD completo, suporte a `BLOB`, stored procedures, query builder fluente e uma **CLI de migrations**. Foi pensado para desenvolvedores (e agentes de IA) que precisam lidar com os quirks reais do Firebird sem trocar a simplicidade do TypeScript.

---

## Sumário

- [Por que `firebird-orm`?](#por-que-firebird-orm)
- [Instalação](#instalação)
- [Início rápido](#início-rápido)
- [Recursos em destaque](#recursos-em-destaque)
  - [CRUD com Repository](#crud-com-repository)
  - [Transações](#transações)
  - [Stored Procedures](#stored-procedures)
  - [Query Builder fluente](#query-builder-fluente)
  - [BLOB (binário e texto)](#blob-binário-e-texto)
  - [CLI de Migrations](#cli-de-migrations)
- [Quirks do Firebird](#quirks-do-firebird)
- [Compatibilidade](#compatibilidade)
- [Configuração de testes / docker](#configuração-de-testes--docker)
- [Versionamento e changelog](#versionamento-e-changelog)
- [Contribuição e licença](#contribuição-e-licença)

---

## Por que `firebird-orm`?

- **Tipado de verdade.** Decorators geram metadados em tempo de compilação; tudo é `Repository<T>`, `FindOptions<T>` etc.
- **Nada de DSL própria vazando para o SQL.** Você lê o banco como uma classe TS. Tabela/coluna vão em **MAIÚSCULO** por convenção.
- **Honesto com o Firebird.** Respeita `FIRST/SKIP`, sequences, `RETURNING`, `SMALLINT` para booleanos, `BLOB SUB_TYPE`, `EXECUTE PROCEDURE` vs `SELECT * FROM procedure`.
- **CLI de migrations inclusa.** `migration:generate`, `migration:run`, `migration:revert` — sem precisar montar TypeORM/Prisma/MikroORM para um sistema legado.
- **Erros acionáveis.** Mensagens dizem o que está faltando e como corrigir (`NoPrimaryKeyError`, `EntityNotFoundError`, etc.).

---

## Instalação

```bash
npm install firebird-orm
```

O pacote depende de [`reflect-metadata`](https://www.npmjs.com/package/reflect-metadata) e [`node-firebird`](https://www.npmjs.com/package/node-firebird) (incluídos como dependências).

No `tsconfig.json` do seu projeto:

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
    // ...
  }
}
```

E importe o polyfill uma única vez, no entrypoint:

```typescript
import 'reflect-metadata';
```

> **Sem `fbclient.dll`?** O `node-firebird` 1.x é JavaScript puro; em servidores Linux a `fbclient` do próprio Firebird já atende. Em Windows, aponte `LD_LIBRARY_PATH`/`PATH` para a pasta do cliente se o seu Firebird exigir.

---

## Início rápido

```typescript
import 'reflect-metadata';
import {
  createConnection,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Repository,
} from 'firebird-orm';

// 1. Defina a entidade
@Entity('USUARIOS')
class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nome!: string;

  @Column({ name: 'EMAIL', type: 'string' })
  email!: string;

  @Column({ name: 'ATIVO', type: 'boolean' })
  ativo!: boolean;
}

// 2. Abra a conexão (pool interno)
const connection = await createConnection({
  host: 'localhost',
  port: 3050,
  database: '/var/lib/firebird/data/sistema.fdb', // ou 'C:\\dados\\sistema.fdb' no Windows
  user: 'SYSDBA',
  password: 'masterkey',
  poolSize: 5,
});

// 3. Use o repositório
const usuarios: Repository<Usuario> = await connection.getRepository(Usuario);

// Criar
const novo = await usuarios.save({ nome: 'João Silva', email: 'joao@email.com', ativo: true });
console.log(novo.id); // ID veio da sequence automaticamente

// Buscar
const todos = await usuarios.find({ orderBy: { nome: 'ASC' }, take: 10 });
const um = await usuarios.findOne(novo.id);
await usuarios.findOneOrFail(9999); // lança EntityNotFoundError

// Atualizar / deletar
await usuarios.update(novo.id, { ativo: false });
await usuarios.delete(novo.id);

// Contar
const totalAtivos = await usuarios.count({ ativo: true });

// Fechar (libera o pool)
await connection.close();
```

---

## Recursos em destaque

### CRUD com Repository

`Repository<T>` expõe `find`, `findOne`, `findOneOrFail`, `save` (upsert por PK), `update`, `delete` e `count`. Sem `WHERE` arbitrário em `find()` — para queries dinâmicas, use o [`FluentQueryBuilder`](#query-builder-fluente).

```typescript
const usuarios = await connection.getRepository(Usuario);

const ativos = await usuarios.find({
  where: { ativo: true },
  orderBy: { nome: 'ASC' },
  take: 10,
  skip: 0, // vira FIRST 10 SKIP 0 no SQL
  select: ['id', 'nome', 'email'],
});
```

`find()` ordena pela **chave primária** por padrão, então paginação é sempre determinística (sem `ORDER BY` em queries `FIRST/SKIP` no Firebird, a ordem é física).

### Transações

`connection.transaction(...)` encapsula `READ_COMMITTED` + commit automático ou rollback em caso de erro. Use-a com queries raw ou repositórios.

```typescript
const total = await connection.transaction(async (trx) => {
  await connection.query('UPDATE ESTOQUE SET QTD = QTD - ? WHERE PRODUTO_ID = ?', [3, produtoId], trx);
  await connection.query('INSERT INTO MOVIMENTACOES (...) VALUES (...)', [...], trx);
  return 'ok';
});
```

> Dentro de `trx` as queries devem usar o objeto de transação — não chamar `connection.query` direto (ele pegaria outra conexão do pool).

### Stored Procedures

```typescript
import { ProcedureBuilder } from 'firebird-orm';

// Executable (ação / retorno único)
const [{ TOTAL }] = await connection.callProcedure<{ TOTAL: number }>(
  'SP_CALCULA_FRETE',
  [peso, cep],
);

// Selectable (retorna várias linhas)
const relatorio = await connection.callProcedure<{ LINHA: string }>(
  'SP_RELATORIO_VENDAS',
  [dataIni, dataFim],
  'selectable',
);
```

`ProcedureBuilder.build(...)` também monta o SQL direto se quiser baixar para raw:

```typescript
const { sql, params } = ProcedureBuilder.build('SP_SOMA', [10, 20], 'executable');
// sql: "EXECUTE PROCEDURE SP_SOMA(?, ?)"
```

### Query Builder fluente

Para queries complexas, `connection.createQueryBuilder(Entidade)` retorna um builder encadeável:

```typescript
const ativos = await connection
  .createQueryBuilder(Usuario)
  .where('ATIVO = ?', [1])
  .andWhere('NOME LIKE ?', ['João%'])
  .orderBy('NOME', 'ASC')
  .take(10)
  .skip(0)
  .getMany();

const um = await fqb.where('ID = ?', [42]).getOne();
const total = await fqb.where('ATIVO = ?', [1]).getCount();
```

### BLOB (binário e texto)

Campos `BLOB` chegam via `node-firebird` como função de stream. O `Repository` resolve isso automaticamente no `find/findOne`. Para usos de baixo nível:

```typescript
import { resolveBlob } from 'firebird-orm';

const buffer = await resolveBlob(row.CAMPO_BLOB);
```

### CLI de Migrations

O pacote expõe o binário `firebird-orm`. Após `npm run build`:

```bash
# 1. Crie o arquivo firebird-orm.config.(js|json) na raiz do projeto
cat > firebird-orm.config.js <<'EOF'
module.exports = {
  host: 'localhost',
  port: 3050,
  database: './data/sistema.fdb',
  user: 'SYSDBA',
  password: 'masterkey',
  migrationsDir: './src/migrations',
  migrationsTable: 'MIGRATIONS',
};
EOF

# 2. Gere / rode / reverta
npx firebird-orm migration:generate -n CreateUsuarios
npx firebird-orm migration:run
npx firebird-orm migration:revert
```

Cada migration é uma classe TypeScript que implementa a interface `Migration`:

```typescript
import { Migration, FirebirdConnection } from 'firebird-orm';

export class CreateUsuarios1625097600000 implements Migration {
  name = 'CreateUsuarios1625097600000';

  async up(connection: FirebirdConnection): Promise<void> {
    await connection.query(`
      CREATE TABLE USUARIOS (
        ID INTEGER NOT NULL PRIMARY KEY,
        NOME VARCHAR(100) NOT NULL,
        EMAIL VARCHAR(150),
        ATIVO SMALLINT DEFAULT 1
      )
    `);
    await connection.query('CREATE SEQUENCE GEN_USUARIOS_ID');
  }

  async down(connection: FirebirdConnection): Promise<void> {
    await connection.query('DROP TABLE USUARIOS');
    await connection.query('DROP SEQUENCE GEN_USUARIOS_ID');
  }
}
```

> **Renomear tabelas?** O Firebird não suporta `RENAME TABLE`. A estratégia de migration para rename é: criar a nova, copiar dados, dropar a antiga.

---

## Quirks do Firebird

O ORM **aplica** essas convenções automaticamente — fique atento se for escrever SQL na mão:

| Tópico | MySQL / PostgreSQL | Firebird |
|---|---|---|
| Paginação | `LIMIT 10 OFFSET 20` | `SELECT FIRST 10 SKIP 20 * FROM T` |
| IDs automáticos | `AUTO_INCREMENT` / `SERIAL` | `SEQUENCE` + `NEXT VALUE FOR GEN_T_ID` |
| Insert com ID | `INSERT ... RETURNING id` | mesmo, ou `NEXT VALUE FOR` separado |
| Booleanos | `BOOLEAN` | `SMALLINT` (0/1) — use `@Column({ type: 'boolean' })` para coerção |
| Strings vazias | `''` != `NULL` | `''` **é** `NULL` no Firebird 2.5 |
| Case de nomes | conforme aspas | sem aspas → **MAIÚSCULO** (o ORM já normaliza) |
| Texto longo | `TEXT` | `BLOB SUB_TYPE TEXT` |
| Datas | `DATETIME`, `TIMESTAMP` | `DATE`, `TIME`, `TIMESTAMP` |
| Transação | opcional | **obrigatória** para escrita |

Se preferir ler em formato `llms.txt` (para agentes de IA), veja [`llms.txt`](./llms.txt).

---

## Compatibilidade

| Componente | Versão |
|---|---|
| Node.js | 18+ (testado em 20.x) |
| TypeScript | 4.5+ (`peerDependencies`) — testado em 5.x |
| Firebird | **2.5**, **3.0**, **4.0**, **5.0** |
| Driver | [`node-firebird`](https://www.npmjs.com/package/node-firebird) 1.1.x |

> Para Firebird 5.0 com usuários legados (`Legacy_Auth`), informe a opção na conexão:
> ```ts
> createConnection({ /* ... */, pluginName: 'Legacy_Auth' });
> ```

---

## Configuração de testes / docker

O repositório traz specs unitários (Jest) e specs de integração contra um Firebird real (via `docker-compose.yml`).

```bash
# Unitários (sem Firebird)
npm test -- --testPathIgnorePatterns=integration

# Integração (precisa do container)
docker compose up -d
npm test -- src/__tests__/integration
```

Os 5 arquivos em `src/__tests__/integration/` lêem `FB_HOST`/`FB_PORT`/`FB_DATABASE`/`FB_USER`/`FB_PASSWORD`/`FB_PLUGIN_NAME` do ambiente, com defaults compatíveis com o `docker-compose.yml`.

CI no GitHub Actions roda as duas suítes em todo PR (`.github/workflows/ci.yml`).

---

## Versionamento e changelog

- [Semver 2.0.0](https://semver.org/)
- Histórico detalhado em [`CHANGELOG.md`](./CHANGELOG.md)
- Commits seguem [Conventional Commits](https://www.conventionalcommits.org/) (enforçado por `husky` + `commitlint`)

A versão atual é **1.0.0** — API estável. Sem breaking changes planejadas até a próxima minor.

---

## Contribuição e licença

- Guia para humanos e agentes: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Contexto adicional para IAs: [`llms.txt`](./llms.txt)
- Exemplos curtos: [`src/examples/`](./src/examples)
- Licença: [MIT](./LICENSE)

PRs são bem-vindos — abra a issue primeiro descrevendo o que vai mudar.
