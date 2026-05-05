/**
 * Classe responsável por montar strings SQL válidas para o Firebird.
 * Esta classe é puramente funcional para geração de SQL e não executa queries diretamente.
 */
export class QueryBuilder {
  /**
   * Monta uma query SELECT formatada para o Firebird, incluindo suporte a paginação.
   *
   * @param tableName - Nome da tabela (será convertido para MAIÚSCULO).
   * @param columns - Array com os nomes das colunas a serem selecionadas.
   * @param where - Objeto com pares chave/valor para a cláusula WHERE (opcional).
   * @param orderBy - Objeto definindo a ordenação (ex: `{ NOME: 'ASC' }`) (opcional).
   * @param take - Quantidade máxima de registros (cláusula FIRST) (opcional).
   * @param skip - Quantidade de registros a pular (cláusula SKIP) (opcional).
   * @returns Objeto contendo a string `sql` e o array de `params`.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildSelect(
   *   'USUARIOS',
   *   ['ID', 'NOME'],
   *   { ATIVO: 1 },
   *   { NOME: 'ASC' },
   *   10,
   *   0
   * );
   * // SQL: SELECT FIRST 10 ID, NOME FROM USUARIOS WHERE ATIVO = ? ORDER BY NOME ASC
   * ```
   *
   * @remarks
   * **Firebird quirk:** O Firebird utiliza `FIRST n` e `SKIP m` logo após o `SELECT`,
   * diferente do `LIMIT` e `OFFSET` utilizados em outros bancos como MySQL e PostgreSQL.
   */
  buildSelect(
    tableName: string,
    columns: string[],
    where?: Record<string, unknown>,
    orderBy?: Record<string, 'ASC' | 'DESC'>,
    take?: number,
    skip?: number
  ): { sql: string; params: unknown[] } {
    const table = tableName.toUpperCase();
    const cols = columns.map(c => c.toUpperCase()).join(', ');
    const params: unknown[] = [];

    let firstSkipClause = '';
    if (take !== undefined || skip !== undefined) {
      const first = take ?? 999999999;
      firstSkipClause = `FIRST ${first}`;
      if (skip !== undefined) {
        firstSkipClause += ` SKIP ${skip}`;
      }
    }

    let whereClause = '';
    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value]) => {
        params.push(value);
        return `${key.toUpperCase()} = ?`;
      });
      whereClause = ` WHERE ${conditions.join(' AND ')}`;
    }

    let orderClause = '';
    if (orderBy && Object.keys(orderBy).length > 0) {
      const orders = Object.entries(orderBy).map(([key, dir]) => {
        return `${key.toUpperCase()} ${dir.toUpperCase()}`;
      });
      orderClause = ` ORDER BY ${orders.join(', ')}`;
    }

    const sql = `SELECT ${firstSkipClause ? firstSkipClause + ' ' : ''}${cols} FROM ${table}${whereClause}${orderClause}`.trim();

    return { sql, params };
  }

  /**
   * Monta uma query INSERT, opcionalmente incluindo a cláusula RETURNING.
   *
   * @param tableName - Nome da tabela.
   * @param columns - Array com os nomes das colunas.
   * @param values - Array com os valores correspondentes às colunas.
   * @param pkColumn - Nome da coluna de chave primária para retorno do ID gerado (opcional).
   * @returns Objeto contendo a string `sql` e o array de `params`.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildInsert(
   *   'USUARIOS',
   *   ['NOME', 'EMAIL'],
   *   ['João', 'joao@exemplo.com'],
   *   'ID'
   * );
   * // SQL: INSERT INTO USUARIOS (NOME, EMAIL) VALUES (?, ?) RETURNING ID
   * ```
   *
   * @remarks
   * **Firebird quirk:** A cláusula `RETURNING` é essencial para obter IDs gerados por
   * sequences/triggers sem a necessidade de uma segunda query.
   */
  buildInsert(
    tableName: string,
    columns: string[],
    values: unknown[],
    pkColumn?: string
  ): { sql: string; params: unknown[] } {
    const table = tableName.toUpperCase();
    const cols = columns.map(c => c.toUpperCase()).join(', ');
    const placeholders = values.map(() => '?').join(', ');

    let returningClause = '';
    if (pkColumn) {
      returningClause = ` RETURNING ${pkColumn.toUpperCase()}`;
    }

    const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})${returningClause}`;

    return { sql, params: values };
  }

  /**
   * Monta uma query UPDATE filtrada pela chave primária.
   *
   * @param tableName - Nome da tabela.
   * @param sets - Objeto contendo as colunas e novos valores a serem atualizados.
   * @param pkColumn - Nome da coluna de chave primária usada no filtro.
   * @param pkValue - Valor da chave primária para o registro a ser atualizado.
   * @returns Objeto contendo a string `sql` e o array de `params`.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildUpdate(
   *   'USUARIOS',
   *   { ATIVO: 0 },
   *   'ID',
   *   1
   * );
   * // SQL: UPDATE USUARIOS SET ATIVO = ? WHERE ID = ?
   * ```
   */
  buildUpdate(
    tableName: string,
    sets: Record<string, unknown>,
    pkColumn: string,
    pkValue: unknown
  ): { sql: string; params: unknown[] } {
    const table = tableName.toUpperCase();
    const params: unknown[] = [];

    const setClauses = Object.entries(sets).map(([key, value]) => {
      params.push(value);
      return `${key.toUpperCase()} = ?`;
    });

    params.push(pkValue);
    const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${pkColumn.toUpperCase()} = ?`;

    return { sql, params };
  }

  /**
   * Monta uma query DELETE filtrada pela chave primária.
   *
   * @param tableName - Nome da tabela.
   * @param pkColumn - Nome da coluna de chave primária usada no filtro.
   * @param pkValue - Valor da chave primária para o registro a ser removido.
   * @returns Objeto contendo a string `sql` e o array de `params`.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildDelete('USUARIOS', 'ID', 1);
   * // SQL: DELETE FROM USUARIOS WHERE ID = ?
   * ```
   */
  buildDelete(
    tableName: string,
    pkColumn: string,
    pkValue: unknown
  ): { sql: string; params: unknown[] } {
    const table = tableName.toUpperCase();
    const sql = `DELETE FROM ${table} WHERE ${pkColumn.toUpperCase()} = ?`;

    return { sql, params: [pkValue] };
  }

  /**
   * Monta uma query para contagem de registros (SELECT COUNT(*)).
   *
   * @param tableName - Nome da tabela.
   * @param where - Filtros opcionais para a contagem.
   * @returns Objeto contendo a string `sql` e o array de `params`.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildCount('USUARIOS', { ATIVO: 1 });
   * // SQL: SELECT COUNT(*) FROM USUARIOS WHERE ATIVO = ?
   * ```
   */
  buildCount(
    tableName: string,
    where?: Record<string, unknown>
  ): { sql: string; params: unknown[] } {
    const table = tableName.toUpperCase();
    const params: unknown[] = [];

    let whereClause = '';
    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value]) => {
        params.push(value);
        return `${key.toUpperCase()} = ?`;
      });
      whereClause = ` WHERE ${conditions.join(' AND ')}`;
    }

    const sql = `SELECT COUNT(*) FROM ${table}${whereClause}`;

    return { sql, params };
  }
}
