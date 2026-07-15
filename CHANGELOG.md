# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-15

Primeira release estável da API. Todas as tasks do roadmap interno (F1–F6, A1–A4, Q1–Q4, V1–V4) estão entregues e validadas: 79 testes Jest (15 suites) + 25 checks ponta-a-ponta em um projeto Node externo consumindo o tarball publicado. Sem breaking changes em relação à superfície pública de `0.1.2`.

### Added
- Suporte a `pluginName` e `wireCrypt` em `FirebirdConnectionOptions` para lidar com servidores Firebird cujo plugin de autenticação não é o padrão (ex.: `Legacy_Auth` para usuários sem entrada SRP).
- Helper `src/__tests__/integration/test-connection.ts` parametrizado por env vars (`FB_HOST`, `FB_PORT`, `FB_DATABASE`, `FB_USER`, `FB_PASSWORD`, `FB_PLUGIN_NAME`) para rodar a suíte de integração contra qualquer banco Firebird.
- Campo `files` no `package.json` para limitar o que vai para o npm (somente `dist/`, `bin/`, docs e `LICENSE`).
- Arquivo `LICENSE` (MIT) — necessário para npm.
- Script `npx firebird-orm migration:generate|run|revert` consolidado em `bin/firebird-orm.js`.

### Changed
- `tsconfig.json` agora exclui `__tests__/` e `examples/` da compilação — o `dist/` deixa de conter código de teste ou de exemplo.
- Cobertura de testes unitários ampliada (de ~54 para 69 testes; `index.ts` foi de 0% para 100%).
- Especificações de integração refatoradas para usar o helper de env, mantendo compatibilidade com o setup Docker/CI anterior.
- README e CONTRIBUTING reescritos como material público (sem depender de roadmap interno).

### Fixed
- Quebra de compilação ao tentar publicar (o `dist/` incluía `__tests__/`, `examples/` e `cli/` sem filtro).
- `repository.find()` agora usa `ORDER BY <PK> ASC` por padrão — paginação `FIRST`/`SKIP` ficou determinística (antes dependia da ordem física do Firebird).
- `repository.save()` não usa mais `INSERT ... RETURNING` seguido de `SELECT *` quando há colunas BLOB — o driver `node-firebird` quebra em `describe` quando o BLR do SELECT traz metadados de BLOB. A entidade retornada agora é montada diretamente dos valores inseridos (incluindo o ID gerado pela sequence).
- `connection.callProcedure()` normaliza o retorno de `EXECUTE PROCEDURE` (o driver devolve um objeto-row, não array).
- `repository.mapToEntity()` agora respeita `ColumnOptions.type` (ex.: `type: 'boolean'` converte `SMALLINT` 0/1 vindo do banco para `true`/`false`).
- Decorator `@Column` aceita a nova opção `type` para declarar o tipo TS da coluna.

## [0.1.3] - 2026-07-14

> Não publicado. Conteúdo fundido em [1.0.0]; mantido aqui só para rastreabilidade do que foi implementado.

## [0.1.2] - 2024-03-20

### Added
- Conventional Commits enforcement using `commitlint` and `husky`.
- Initial `CHANGELOG.md` file.

## [0.1.1] - 2024-03-20

### Added
- GitHub Actions CI pipeline for unit and integration tests.
- Integration tests with Docker.
- Actionable error messages for common ORM issues.
- Inline usage examples for CRUD, Transactions, Pagination, and Sequences.
- Comprehensive JSDoc documentation for all public methods and decorators.
- `llms.txt` file for AI agent context.
- Repository class with CRUD methods (`find`, `findOne`, `save`, `update`, `delete`, `count`).
- Internal QueryBuilder for Firebird-specific SQL generation.
- Entity decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@PrimaryColumn`).
- Base types and interfaces for connection and find options.

### Changed
- Standardized Firebird SQL conventions (UPPERCASE names, FIRST/SKIP pagination).

## [0.1.0] - 2024-03-15

### Added
- Initial project structure with TypeScript support.
- Basic connection handling using `node-firebird`.
- Core ORM concepts and initial roadmap.
