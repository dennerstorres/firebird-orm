# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
