# Guia de Contribuição

Obrigado por seu interesse em contribuir para o `firebird-orm`! Este documento fornece diretrizes para humanos e agentes de IA sobre como configurar o ambiente local e contribuir com o projeto.

## Setup Local

### Pré-requisitos
- Node.js (v20 recomendado)
- npm
- Docker e Docker Compose (para testes de integração)

### Instalação
```bash
git clone https://github.com/dennerstorres/firebird-orm.git
cd firebird-orm
npm install
```

### Build
Para compilar o projeto TypeScript:
```bash
npm run build
```

### Testes
O projeto utiliza Jest para testes.

- **Testes unitários:**
  ```bash
  npm test -- --testPathIgnorePatterns=integration
  ```
- **Testes de integração:**
  Certifique-se de que o Docker está rodando e inicie o container do Firebird:
  ```bash
  docker compose up -d
  npm test -- src/__tests__/integration
  ```

## Convenções de Código

### Linguagem e Estilo
- **TypeScript Strict:** O projeto usa `"strict": true`. Não use `any` em tipos públicos.
- **JSDoc:** Todos os métodos, decorators e tipos públicos devem incluir JSDoc com `@example`, `@param`, `@returns` e `@throws`.
- **Nomes:** Use camelCase para propriedades de classe e UPPERCASE para nomes de tabelas e colunas no banco de dados.

### SQL e Firebird
- **Placeholders:** SEMPRE use `?` para parâmetros de query. Nunca concatene strings.
- **Maiúsculas:** Nomes de tabelas e colunas devem ser enviados em MAIÚSCULO.
- **Paginação:** Use `FIRST` e `SKIP`, nunca `LIMIT` e `OFFSET`.
- **IDs:** Use sequences via `SELECT NEXT VALUE FOR <sequence> FROM RDB$DATABASE`.
- **Inserção:** Use `RETURNING <pk_column>` em comandos `INSERT` para obter o ID gerado.

## Fluxo de Contribuição

### Criando uma Issue
Antes de começar a trabalhar, verifique se já existe uma issue ou task no `ROADMAP.md` correspondente ao que você deseja fazer. Se não, abra uma nova issue descrevendo a melhoria ou o bug.

### Criando um Pull Request
1. **Branch:** Crie um branch a partir do `master` seguindo o padrão `task/<ID>` (ex: `task/F1`).
2. **Task Única:** Cada PR deve implementar apenas UMA task do ROADMAP.md.
3. **Commit:** Siga o padrão de Conventional Commits (ex: `feat(repository): add count() method`).
4. **Descrição:** Use o template de PR especificado no `ROADMAP.md`.

## Quirks do Firebird

Todo contribuidor deve estar ciente das seguintes particularidades do Firebird:

- **Booleanos:** O Firebird 2.5 não possui tipo `BOOLEAN` nativo. Use `SMALLINT` (0 para false, 1 para true).
- **Strings Vazias:** O Firebird trata strings vazias (`''`) como `NULL`.
- **Datas:** Use os tipos `DATE`, `TIME` ou `TIMESTAMP`. Evite `VARCHAR`.
- **Transações:** Todas as operações devem ser executadas dentro de uma transação.
- **Case Sensitivity:** Nomes de objetos sem aspas são convertidos para MAIÚSCULO internamente.

---

Este projeto segue um roteiro definido no arquivo `ROADMAP.md`. Consulte-o para ver as próximas prioridades.
