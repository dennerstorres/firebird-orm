import { FirebirdConnection } from './connection';
import { getTableName, getColumnMetadata } from './decorators';
import { QueryBuilder } from './query-builder';

/**
 * API fluente para construção e execução de queries complexas no Firebird.
 * Permite encadear métodos para definir filtros, ordenação e paginação.
 *
 * @template T - Tipo da entidade.
 *
 * @example
 * ```typescript
 * const users = await connection
 *   .createQueryBuilder(User)
 *   .where('ACTIVE = ?', [1])
 *   .andWhere('NAME LIKE ?', ['J%'])
 *   .orderBy('NAME', 'ASC')
 *   .take(10)
 *   .getMany();
 * ```
 */
export class FluentQueryBuilder<T> {
  private conditions: { condition: string; params: unknown[] }[] = [];
  private orders: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  private _take?: number;
  private _skip?: number;

  /**
   * @internal
   * @param connection - Instância da conexão Firebird.
   * @param EntityClass - Classe da entidade.
   */
  constructor(
    private readonly connection: FirebirdConnection,
    private readonly EntityClass: new () => T
  ) {}

  /**
   * Define a primeira condição da cláusula WHERE.
   * Se já existirem condições, elas serão substituídas.
   *
   * @param condition - String da condição SQL (ex: 'ID = ?').
   * @param params - Parâmetros para a condição.
   * @returns A própria instância para encadeamento.
   */
  where(condition: string, params: unknown[] = []): this {
    this.conditions = [{ condition, params }];
    return this;
  }

  /**
   * Adiciona uma nova condição à cláusula WHERE usando o operador AND.
   *
   * @param condition - String da condição SQL.
   * @param params - Parâmetros para a condição.
   * @returns A própria instância para encadeamento.
   */
  andWhere(condition: string, params: unknown[] = []): this {
    this.conditions.push({ condition, params });
    return this;
  }

  /**
   * Define a ordenação do resultado.
   *
   * @param column - Nome da coluna ou propriedade (será convertida para UPPERCASE).
   * @param direction - Direção da ordenação ('ASC' ou 'DESC').
   * @returns A própria instância para encadeamento.
   */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orders.push({ column: column.toUpperCase(), direction });
    return this;
  }

  /**
   * Define a quantidade máxima de registros a serem retornados.
   *
   * @param n - Número de registros.
   * @returns A própria instância para encadeamento.
   *
   * @remarks
   * **Firebird quirk:** Converte-se para a cláusula `FIRST n`.
   */
  take(n: number): this {
    this._take = n;
    return this;
  }

  /**
   * Define a quantidade de registros a serem pulados.
   *
   * @param n - Número de registros.
   * @returns A própria instância para encadeamento.
   *
   * @remarks
   * **Firebird quirk:** Converte-se para a cláusula `SKIP n`.
   */
  skip(n: number): this {
    this._skip = n;
    return this;
  }

  /**
   * Executa a query e retorna uma lista de entidades.
   *
   * @returns Promise com o array de entidades.
   */
  async getMany(): Promise<T[]> {
    const { sql, params } = this.buildSelect();
    const rows = await this.connection.query<any>(sql, params);
    return rows.map((row: any) => this.mapToEntity(row));
  }

  /**
   * Executa a query e retorna apenas o primeiro resultado, ou null se não encontrar.
   *
   * @returns Promise com a entidade ou null.
   */
  async getOne(): Promise<T | null> {
    this.take(1);
    const results = await this.getMany();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Executa uma query de contagem baseada nos filtros aplicados.
   *
   * @returns Promise com o número total de registros.
   */
  async getCount(): Promise<number> {
    const tableName = getTableName(this.EntityClass);
    let sql = `SELECT COUNT(*) FROM ${tableName.toUpperCase()}`;
    const params: unknown[] = [];

    if (this.conditions.length > 0) {
      const whereSql = this.conditions.map(c => c.condition).join(' AND ');
      sql += ` WHERE ${whereSql}`;
      this.conditions.forEach(c => params.push(...c.params));
    }

    const result = await this.connection.query<any>(sql, params);
    const countKey = Object.keys(result[0])[0];
    return Number(result[0][countKey]);
  }

  /**
   * Constrói a string SQL de SELECT e seus parâmetros.
   */
  private buildSelect(): { sql: string; params: unknown[] } {
    const tableName = getTableName(this.EntityClass);
    const columns = getColumnMetadata(this.EntityClass).map(c => c.columnName.toUpperCase());

    let firstSkip = '';
    if (this._take !== undefined || this._skip !== undefined) {
      firstSkip = `FIRST ${this._take ?? 999999999}`;
      if (this._skip !== undefined) {
        firstSkip += ` SKIP ${this._skip}`;
      }
    }

    let sql = `SELECT ${firstSkip ? firstSkip + ' ' : ''}${columns.join(', ')} FROM ${tableName.toUpperCase()}`;
    const params: unknown[] = [];

    if (this.conditions.length > 0) {
      const whereSql = this.conditions.map(c => c.condition).join(' AND ');
      sql += ` WHERE ${whereSql}`;
      this.conditions.forEach(c => params.push(...c.params));
    }

    if (this.orders.length > 0) {
      const orderSql = this.orders.map(o => `${o.column} ${o.direction}`).join(', ');
      sql += ` ORDER BY ${orderSql}`;
    }

    return { sql, params };
  }

  /**
   * Mapeia uma linha do banco para uma instância da entidade.
   * (Copiado/Adaptado do Repository para manter autonomia)
   */
  private mapToEntity(row: any): T {
    const entity = new this.EntityClass();
    const columns = getColumnMetadata(this.EntityClass);

    for (const col of columns) {
      const dbValue = row[col.columnName.toUpperCase()];
      if (dbValue !== undefined) {
        (entity as any)[col.propertyKey] = dbValue;
      }
    }

    return entity;
  }
}
