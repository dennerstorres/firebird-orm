import * as Firebird from 'node-firebird';
import { QueryBuilder } from './query-builder';
import { getTableName, getColumnMetadata, getPrimaryColumn } from './decorators';
import { FindOptions, EntityNotFoundError, ColumnMetadata } from './types';

/**
 * Repositório genérico para operações CRUD em entidades do Firebird.
 *
 * @template T - Tipo da entidade.
 *
 * @example
 * ```typescript
 * const repo = connection.getRepository(User);
 * const user = await repo.findOne(1);
 * ```
 */
export class Repository<T> {
  private readonly qb = new QueryBuilder();

  /**
   * @internal
   */
  constructor(
    private readonly pool: any,
    private readonly EntityClass: new () => T
  ) {}

  /**
   * Executa uma função dentro de uma transação.
   *
   * @param fn - Função a ser executada.
   * @returns Resultado da função.
   *
   * @example
   * ```typescript
   * await repository.executeInTransaction(async (db) => {
   *   await db.query(sql1);
   *   await db.query(sql2);
   * });
   * ```
   */
  private async executeInTransaction<R>(fn: (db: any) => Promise<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      this.pool.get((err: Error, db: any) => {
        if (err) return reject(err);

        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err: Error, transaction: any) => {
          if (err) {
            db.detach();
            return reject(err);
          }

          try {
            const result = await fn(transaction);
            transaction.commit((err: Error) => {
              db.detach();
              if (err) return reject(err);
              resolve(result);
            });
          } catch (error) {
            transaction.rollback(() => {
              db.detach();
              reject(error);
            });
          }
        });
      });
    });
  }

  /**
   * Promisifica a execução de uma query no node-firebird.
   *
   * @param connection - Conexão ou Transação do node-firebird.
   * @param sql - Query SQL.
   * @param params - Parâmetros da query.
   * @returns Resultados da query.
   */
  private async queryAsync<R = any>(connection: any, sql: string, params: unknown[] = []): Promise<R[]> {
    return new Promise((resolve, reject) => {
      connection.query(sql, params, (err: Error, result: R[]) => {
        if (err) return reject(err);
        resolve(result || []);
      });
    });
  }

  /**
   * Mapeia uma linha do banco de dados para uma instância da entidade.
   *
   * @param row - Linha retornada pelo driver.
   * @returns Instância da entidade.
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

  /**
   * Mapeia um objeto parcial da entidade para pares de coluna/valor do banco.
   *
   * @param entity - Objeto parcial da entidade.
   * @returns Objeto com chaves em UPPERCASE.
   */
  private mapToColumns(entity: Partial<T>): Record<string, unknown> {
    const columns = getColumnMetadata(this.EntityClass);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(entity)) {
      const col = columns.find(c => c.propertyKey === key);
      if (col) {
        result[col.columnName.toUpperCase()] = value;
      }
    }

    return result;
  }

  /**
   * Encontra todas as entidades que satisfazem as condições de busca.
   *
   * @param options - Opções de busca (where, orderBy, take, skip, select).
   * @returns Array de instâncias da entidade.
   *
   * @example
   * ```typescript
   * const users = await repo.find({ where: { active: true }, take: 10 });
   * ```
   *
   * @remarks
   * **Firebird quirk:** Utiliza `FIRST` e `SKIP` para paginação baseada em `take` e `skip`.
   * Nomes de colunas retornados pelo banco em MAIÚSCULO são mapeados para camelCase.
   */
  async find(options: FindOptions<T> = {}): Promise<T[]> {
    const tableName = getTableName(this.EntityClass);
    const columns = getColumnMetadata(this.EntityClass);

    const selectColumns = options.select
      ? options.select.map(s => columns.find(c => c.propertyKey === s)?.columnName || s.toString())
      : columns.map(c => c.columnName);

    const where = options.where ? this.mapToColumns(options.where) : undefined;

    let orderBy: Record<string, 'ASC' | 'DESC'> | undefined;
    if (options.orderBy) {
      orderBy = {};
      for (const [key, dir] of Object.entries(options.orderBy)) {
        const col = columns.find(c => c.propertyKey === key);
        if (col) {
          orderBy[col.columnName.toUpperCase()] = dir as 'ASC' | 'DESC';
        }
      }
    }

    const { sql, params } = this.qb.buildSelect(
      tableName,
      selectColumns,
      where,
      orderBy,
      options.take,
      options.skip
    );

    return new Promise((resolve, reject) => {
      this.pool.get((err: Error, db: any) => {
        if (err) return reject(err);
        this.queryAsync(db, sql, params)
          .then(rows => {
            db.detach();
            resolve(rows.map(row => this.mapToEntity(row)));
          })
          .catch(err => {
            db.detach();
            reject(err);
          });
      });
    });
  }

  /**
   * Encontra uma única entidade pelo seu ID.
   *
   * @param id - Valor da chave primária.
   * @returns A entidade encontrada ou null.
   *
   * @example
   * ```typescript
   * const user = await repo.findOne(1);
   * ```
   */
  async findOne(id: number | string): Promise<T | null> {
    const pk = getPrimaryColumn(this.EntityClass);
    const results = await this.find({
      where: { [pk.propertyKey]: id } as any,
      take: 1
    });

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Encontra uma única entidade pelo seu ID ou lança erro se não encontrar.
   *
   * @param id - Valor da chave primária.
   * @returns A entidade encontrada.
   * @throws EntityNotFoundError
   *
   * @example
   * ```typescript
   * const user = await repo.findOneOrFail(1);
   * ```
   */
  async findOneOrFail(id: number | string): Promise<T> {
    const entity = await this.findOne(id);
    if (!entity) {
      throw new EntityNotFoundError(this.EntityClass.name, id);
    }
    return entity;
  }

  /**
   * Salva uma entidade. Realiza um UPDATE se a chave primária estiver presente,
   * caso contrário, realiza um INSERT gerando um novo ID via Sequence.
   *
   * @param entity - Dados da entidade a serem salvos.
   * @returns A instância da entidade salva e atualizada (incluindo ID gerado).
   * @throws NoPrimaryKeyError se a entidade não tiver PK definida.
   *
   * @example
   * ```typescript
   * const newUser = await repo.save({ name: 'John Doe' });
   * const updatedUser = await repo.save({ id: 1, name: 'John Updated' });
   * ```
   *
   * @remarks
   * **Firebird quirk:** Toda operação de escrita é executada dentro de uma transação.
   * Se for um INSERT e a PK for auto-gerada, o ORM busca o próximo valor da Sequence
   * antes de inserir e utiliza a cláusula `RETURNING` para garantir a captura do ID.
   */
  async save(entity: Partial<T>): Promise<T> {
    const pk = getPrimaryColumn(this.EntityClass);
    const id = (entity as any)[pk.propertyKey];

    if (id) {
      await this.update(id, entity);
      return this.findOneOrFail(id);
    }

    return this.executeInTransaction(async (db) => {
      const tableName = getTableName(this.EntityClass);
      let entityToInsert = { ...entity };

      if (pk.generated) {
        const seqSql = `SELECT NEXT VALUE FOR ${pk.sequenceName} FROM RDB$DATABASE`;
        const seqResult = await this.queryAsync(db, seqSql);
        const nextId = seqResult[0][Object.keys(seqResult[0])[0]];
        (entityToInsert as any)[pk.propertyKey] = nextId;
      }

      const columnsMap = this.mapToColumns(entityToInsert);
      const { sql, params } = this.qb.buildInsert(
        tableName,
        Object.keys(columnsMap),
        Object.values(columnsMap),
        pk.columnName
      );

      const insertResult = await this.queryAsync(db, sql, params);
      const generatedId = insertResult[0][pk.columnName.toUpperCase()];

      const selectSql = `SELECT * FROM ${tableName} WHERE ${pk.columnName.toUpperCase()} = ?`;
      const rows = await this.queryAsync(db, selectSql, [generatedId]);
      return this.mapToEntity(rows[0]);
    });
  }

  /**
   * Atualiza uma entidade existente pelo seu ID.
   *
   * @param id - Valor da chave primária.
   * @param data - Dados a serem atualizados.
   * @throws NoPrimaryKeyError se a entidade não tiver PK definida.
   *
   * @example
   * ```typescript
   * await repo.update(1, { active: false });
   * ```
   *
   * @remarks
   * **Firebird quirk:** Executado dentro de uma transação.
   */
  async update(id: number | string, data: Partial<T>): Promise<void> {
    const pk = getPrimaryColumn(this.EntityClass);
    const tableName = getTableName(this.EntityClass);

    const sets = this.mapToColumns(data);
    delete sets[pk.columnName.toUpperCase()];

    if (Object.keys(sets).length === 0) return;

    const { sql, params } = this.qb.buildUpdate(
      tableName,
      sets,
      pk.columnName,
      id
    );

    await this.executeInTransaction(async (db) => {
      await this.queryAsync(db, sql, params);
    });
  }

  /**
   * Remove uma entidade pelo seu ID.
   *
   * @param id - Valor da chave primária.
   * @throws NoPrimaryKeyError se a entidade não tiver PK definida.
   *
   * @example
   * ```typescript
   * await repo.delete(1);
   * ```
   *
   * @remarks
   * **Firebird quirk:** Executado dentro de uma transação.
   */
  async delete(id: number | string): Promise<void> {
    const pk = getPrimaryColumn(this.EntityClass);
    const tableName = getTableName(this.EntityClass);

    const { sql, params } = this.qb.buildDelete(tableName, pk.columnName, id);

    await this.executeInTransaction(async (db) => {
      await this.queryAsync(db, sql, params);
    });
  }

  /**
   * Conta a quantidade de registros que satisfazem as condições.
   *
   * @param where - Filtros da busca.
   * @returns Quantidade total de registros.
   *
   * @example
   * ```typescript
   * const count = await repo.count({ active: true });
   * ```
   */
  async count(where?: Partial<T>): Promise<number> {
    const tableName = getTableName(this.EntityClass);
    const whereMap = where ? this.mapToColumns(where) : undefined;

    const { sql, params } = this.qb.buildCount(tableName, whereMap);

    return new Promise((resolve, reject) => {
      this.pool.get((err: Error, db: any) => {
        if (err) return reject(err);
        this.queryAsync(db, sql, params)
          .then(rows => {
            db.detach();
            const count = rows[0][Object.keys(rows[0])[0]];
            resolve(Number(count));
          })
          .catch(err => {
            db.detach();
            reject(err);
          });
      });
    });
  }
}

