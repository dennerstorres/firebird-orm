# Guia de Contribuição

Obrigado por seu interesse em contribuir com o `firebird-orm`. Este guia vale tanto para contribuidores humanos quanto para **agentes de IA** que estejam propondo patches automatizados.

---

## Setup local

### Pré-requisitos

| Ferramenta | Versão recomendada |
|---|---|
| Node.js | 20.x |
| npm | 10.x |
| Docker / Docker Compose | para rodar a suíte de integração |

### Instalação

```bash
git clone https://github.com/dennerstorres/firebird-orm.git
cd firebird-orm
npm install
```

### Build

```bash
npm run build
```

Gera `dist/` + `.d.ts`. A CLI em `bin/firebird-orm.js` só funciona depois do build (`npm run prepare` chama `husky` + build automaticamente em `npm install`).

### Testes

Suítes Jest separadas por `--testPathIgnorePatterns`:

```bash
# Unitários (sem Firebird)
npm test -- --testPathIgnorePatterns=integration

# Integração (precisa de Firebird rodando)
docker compose up -d
npm test -- src/__tests__/integration
```

Os 5 specs de integração (`connection`, `repository`, `transaction`, `blob`, `procedure` + `index`) leem do ambiente:

```
FB_HOST      (default: localhost)
FB_PORT      (default: 3050)
FB_DATABASE  (default: test.fdb)
FB_USER      (default: SYSDBA)
FB_PASSWORD  (default: masterkey)
FB_PLUGIN_NAME (opcional — ex: 'Legacy_Auth' para Firebird 5 com usuários legados)
```

CI no GitHub Actions roda **as duas suítes em todo PR** (`.github/workflows/ci.yml`).

---

## Convenções de código

- **TypeScript strict** — `"strict": true`. Não use `any` em superfície pública (`src/index.ts`).
- **JSDoc** — todo método, decorator e tipo público deve trazer `@example`, `@param`, `@returns`, `@throws`. Em pontos onde o Firebird se comporta diferente de outros bancos, adicione `@remarks` com **"Firebird quirk:"**.
- **Nomes em camelCase** para propriedades da classe e **UPPERCASE** para nomes de tabelas e colunas no banco — o ORM normaliza automaticamente, mas mantenha o código coerente.
- **Sem espaços/placeholders extras** no package: o que vai pro npm está em `package.json > "files"`.

### SQL

- **Placeholders:** SEMPRE `?`. Nunca concatenar valores na string SQL.
- **Maiúsculas:** nomes de tabela/coluna enviados em MAIÚSCULO.
- **Paginação:** `FIRST`/`SKIP` (nunca `LIMIT`/`OFFSET`).
- **IDs:** `SELECT NEXT VALUE FOR <sequence> FROM RDB$DATABASE`.
- **Inserção:** o ORM não usa `INSERT ... RETURNING` para preencher a entidade (ver histórico em `CHANGELOG.md` 1.0.0 — isso quebra o driver com BLOB). Construímos a entidade de volta a partir dos valores inseridos.

---

## Fluxo de contribuição

### Abrindo uma issue

Antes de mandar PR, verifique se já existe issue aberta. Se não, abra descrevendo:

1. **O quê** — comportamento atual vs esperado
2. **Por quê** — caso de uso que motivou
3. **Como reproduzir** — passos / trecho de código

### Enviando um pull request

1. Crie um branch a partir de `master` com nome descritivo: `fix/update-bug-blob`, `feat/add-cli-flag`, etc.
2. **Um PR = uma mudança coerente.** Não misture bugfix + feature + refactor.
3. **Commits em Conventional Commits** (enforçado por `husky` + `commitlint` em `.commitlintrc.json`):
   ```
   feat(repository): add fluent association support
   fix(decorators): upper-case column name when option is provided
   docs(readme): clarify pagination behavior
   chore(deps): bump reflect-metadata to 0.2
   ```
4. Antes do PR:
   - `npm run build` sem erros
   - `npm test` (unit + integração) verde
5. No PR, preencha: o que foi feito, qual issue resolve (ex.: `Closes #12`), como validar.

---

## Quirks do Firebird (cheat-sheet)

Todo contribuidor — humano ou IA — precisa conhecer:

- **Booleanos:** o Firebird 2.5 não tem `BOOLEAN` nativo. Use `SMALLINT` (0 = false, 1 = true) e declare a coluna com `@Column({ type: 'boolean' })` para o ORM converter na leitura.
- **Strings vazias:** o Firebird trata `''` como `NULL`. Para campos obrigatórios com texto, guarde `' '` (espaço) ou `'-'`.
- **Datas:** prefira `DATE`, `TIME` ou `TIMESTAMP`. Evite `VARCHAR` para datas (tira ordenação e comparações).
- **Transações:** toda escrita abre uma transação (`READ_COMMITTED` por padrão). Não chame `connection.query(...)` à toa fora de `transaction(...)` em produção.
- **Case:** nomes sem aspas viram **MAIÚSCULO** no banco. O ORM normaliza; mantenha o padrão.
- **BLOB:** chega como função de stream pelo `node-firebird`. O `Repository` resolve automaticamente no `find/findOne`; raw SQL precisa de `resolveBlob(...)`.
- **Renomear:** não existe `RENAME TABLE` no Firebird. Migrations com rename criam nova tabela, copiam dados, dropam a antiga.

---

## Estrutura do projeto

```
src/
├── connection.ts          # createConnection, FirebirdConnection, pool
├── decorators.ts          # @Entity, @Column, @PrimaryGeneratedColumn, @PrimaryColumn
├── repository.ts          # Repository<T> — CRUD genérico
├── query-builder.ts       # QueryBuilder interno (gera SQL + params)
├── fluent-query-builder.ts# API encadeável para queries complexas
├── procedure.ts           # ProcedureBuilder + tipos
├── blob.ts                # resolveBlob() — converte stream BLOB em Buffer
├── cli/                   # migration:generate / run / revert
├── examples/              # exemplos curtos (não vão para o npm)
└── __tests__/             # jest — unitários e integration/
```

Para mais contexto (estilo "doc for AI agents"), veja [`llms.txt`](./llms.txt).

---

## Reporter bugs e pedir features

Use o [GitHub Issues](https://github.com/dennerstorres/firebird-orm/issues). Para bugs, inclua:

- Versão do Node, do `firebird-orm` e do Firebird
- Trecho mínimo reproduzindo
- Stack trace completa
- SQL gerado (se a query estiver envolvida) — habilite `DEBUG=firebird-orm` no ambiente

Obrigado por ajudar a tornar o Firebird menos doloroso no Node. 🚒
