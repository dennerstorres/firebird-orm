import * as Firebird from 'node-firebird';
import { QueryBuilder } from './query-builder';
import { getTableName, getColumnMetadata, getPrimaryColumn } from './decorators';
import { FindOptions, EntityNotFoundError, ColumnMetadata } from './types';

/**
 * Repositório genérico para realizar operações CRUD (Create, Read, Update, Delete)
 * em entidades do banco de dados Firebird.
 *
 * @template T - Tipo da classe de entidade.
 *
 * @example
 * ```typescript
 * const userRepository = connection.getRepository(User);
 * const activeUsers = await userRepository.find({ where: { active: true } });
 * ```
 */
export class Repository<T> {
  private readonly qb = new QueryBuilder();

  /**
   * @internal
   * @param pool - Pool de conexões do node-firebird.
   * @param EntityClass - Classe da entidade associada a este repositório.
   */
  constructor(
    private readonly pool: any,
    private readonly EntityClass: new () => T
  ) {}

  /**
   * Executa um conjunto de operações dentro de uma transação Firebird.
   * Garante a atomicidade das operações de escrita.
   *
   * @param fn - Função assíncrona que recebe o objeto de transação do driver.
   * @returns O resultado retornado pela função `fn`.
   *
   * @example
   * ```typescript
   * await repository.executeInTransaction(async (transaction) => {
   *   await repository.queryAsync(transaction, 'UPDATE ...');
   *   await repository.queryAsync(transaction, 'INSERT ...');
   * });
   * ```
   *
   * @remarks
   * **Firebird quirk:** O Firebird exige transações explícitas para manter a integridade dos dados,
   * especialmente em ambientes concorrentes. Este ORM utiliza `ISOLATION_READ_COMMITTED` por padrão.
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
   * Wrapper para executar queries SQL usando Promises.
   *
   * @param connection - Instância de conexão ou transação do node-firebird.
   * @param sql - String SQL com placeholders `?`.
   * @param params - Array de parâmetros para substituir os placeholders.
   * @returns Array de resultados da query.
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
   * Converte uma linha bruta retornada pelo driver para uma instância da classe da entidade,
   * mapeando as colunas em UPPERCASE para as propriedades da classe.
   *
   * @param row - Objeto retornado pelo driver node-firebird.
   * @returns Uma nova instância da entidade preenchida com os dados do banco.
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
   * Mapeia as propriedades de um objeto parcial da entidade para os nomes de colunas
   * em MAIÚSCULO configurados via decorators.
   *
   * @param entity - Objeto parcial da entidade.
   * @returns Objeto com chaves correspondentes aos nomes das colunas no banco.
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
   * Busca múltiplos registros que atendam aos critérios especificados.
   *
   * @param options - Opções de filtro, ordenação e paginação.
   * @returns Uma Promise que resolve em um array de instâncias da entidade.
   *
   * @example
   * ```typescript
   * const users = await repo.find({
   *   where: { active: true },
   *   orderBy: { name: 'ASC' },
   *   take: 10,
   *   skip: 0
   * });
   * ```
   *
   * @remarks
   * **Firebird quirk:** A paginação é implementada usando as cláusulas `FIRST` e `SKIP`
   * no SQL gerado.
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
   * Busca uma única entidade pelo valor da sua chave primária.
   *
   * @param id - Valor do ID (número ou string).
   * @returns A entidade encontrada ou `null` caso não exista.
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
   * Busca uma única entidade pelo ID e lança um erro caso não seja encontrada.
   *
   * @param id - Valor do ID.
   * @returns A entidade encontrada.
   * @throws EntityNotFoundError - Se nenhum registro for encontrado.
   *
   * @example
   * ```typescript
   * const user = await repo.findOneOrFail(5);
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
   * Salva as alterações de uma entidade no banco de dados.
   * Se o objeto possuir o valor da chave primária, realiza um UPDATE.
   * Caso contrário, realiza um INSERT gerando um novo ID via Sequence.
   *
   * @param entity - Objeto parcial contendo os dados a serem salvos.
   * @returns A entidade atualizada com os dados do banco após o salvamento.
   *
   * @example
   * ```typescript
   * // Inserindo um novo registro (ID gerado automaticamente via Sequence)
   * const newUser = await repo.save({ name: 'Alice' });
   *
   * // Atualizando um registro existente
   * const updatedUser = await repo.save({ id: 1, name: 'Alice Updated' });
   * ```
   *
   * @remarks
   * **Firebird quirk:** Para o INSERT, o ID é gerado usando `SELECT NEXT VALUE FOR sequence FROM RDB$DATABASE`
   * antes da execução da query principal, garantindo que o objeto retornado contenha o novo ID.
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
   * Atualiza dados de um registro existente baseado no seu ID.
   *
   * @param id - Identificador do registro.
   * @param data - Objeto parcial com as propriedades a serem alteradas.
   *
   * @example
   * ```typescript
   * await repo.update(1, { active: false });
   * ```
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
   * Remove permanentemente um registro do banco de dados pelo seu ID.
   *
   * @param id - Identificador do registro a ser excluído.
   *
   * @example
   * ```typescript
   * await repo.delete(1);
   * ```
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
   * Conta a quantidade total de registros que satisfazem um determinado critério.
   *
   * @param where - Critérios de filtro (opcional).
   * @returns A quantidade de registros encontrados.
   *
   * @example
   * ```typescript
   * const total = await repo.count();
   * const activeCount = await repo.count({ active: true });
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
