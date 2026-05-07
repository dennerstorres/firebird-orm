# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-05-07

### Added
- **F1: Tipos e interfaces base** - Definição dos tipos principais para conexão e filtros.
- **F2: Decorators de entidade** - Implementação de `@Entity`, `@Column`, `@PrimaryGeneratedColumn` e `@PrimaryColumn`.
- **F3: QueryBuilder interno** - Gerador de SQL específico para Firebird (FIRST/SKIP, RETURNING).
- **F4: Repository** - Classe base para operações CRUD com suporte a transações.
- **F5: Connection e createConnection** - Gerenciamento de pool de conexões.
- **F6: Barrel export + index.ts** - Ponto de entrada único para a biblioteca.
- **A1: Arquivo llms.txt** - Contexto para agentes de IA.
- **A2: JSDoc completo** - Documentação rica em todos os métodos públicos.
- **A3: Exemplos inline** - Exemplos de uso prático na pasta `src/examples/`.
- **A4: Mensagens de erro acionáveis** - Erros que guiam o desenvolvedor para a solução.
- **Q1: Testes de integração com Docker** - Ambiente para testes reais contra Firebird.
- **Q2: GitHub Actions CI** - Pipeline de integração contínua.
- **Q3: CONTRIBUTING.md** - Guia para novos contribuidores humanos e de IA.
