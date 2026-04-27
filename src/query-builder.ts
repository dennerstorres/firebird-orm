/**
 * Classe responsável por montar strings SQL válidas para o Firebird.
 * Não executa queries — só monta o SQL e os parâmetros.
 */
export class QueryBuilder {
  /**
   * Monta uma query SELECT para Firebird.
   *
   * @param tableName - Nome da tabela.
   * @param columns - Colunas a serem selecionadas.
   * @param where - Filtros da busca (opcional).
   * @param orderBy - Ordenação dos resultados (opcional).
   * @param take - Quantidade de registros a retornar (opcional).
   * @param skip - Quantidade de registros a pular (opcional).
   * @returns SQL gerado e parâmetros.
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
   * ```
   *
   * @remarks
   * **Firebird quirk:** Usa FIRST {n} e SKIP {m} para paginação.
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
   * Monta uma query INSERT para Firebird.
   *
   * @param tableName - Nome da tabela.
   * @param columns - Colunas para inserção.
   * @param values - Valores a serem inseridos.
   * @param pkColumn - Nome da coluna de chave primária para a cláusula RETURNING (opcional).
   * @returns SQL gerado e parâmetros.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildInsert(
   *   'USUARIOS',
   *   ['ID', 'NOME'],
   *   [1, 'João'],
   *   'ID'
   * );
   * ```
   *
   * @remarks
   * **Firebird quirk:** Adiciona RETURNING {pkColumn} ao final.
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
   * Monta uma query UPDATE para Firebird.
   *
   * @param tableName - Nome da tabela.
   * @param sets - Campos e valores a serem atualizados.
   * @param pkColumn - Nome da coluna de chave primária.
   * @param pkValue - Valor da chave primária.
   * @returns SQL gerado e parâmetros.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildUpdate(
   *   'USUARIOS',
   *   { NOME: 'João Silva' },
   *   'ID',
   *   1
   * );
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
   * Monta uma query DELETE para Firebird.
   *
   * @param tableName - Nome da tabela.
   * @param pkColumn - Nome da coluna de chave primária.
   * @param pkValue - Valor da chave primária.
   * @returns SQL gerado e parâmetros.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildDelete('USUARIOS', 'ID', 1);
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
   * Monta uma query de contagem para Firebird.
   *
   * @param tableName - Nome da tabela.
   * @param where - Filtros da busca (opcional).
   * @returns SQL gerado e parâmetros.
   *
   * @example
   * ```typescript
   * const { sql, params } = queryBuilder.buildCount('USUARIOS', { ATIVO: 1 });
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
