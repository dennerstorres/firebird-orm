import { ENTITY_METADATA_KEY, COLUMN_METADATA_KEY, PRIMARY_COLUMN_METADATA_KEY } from './decorators';
import { FindOptions, EntityNotFoundError, NoPrimaryKeyError, ColumnMetadata } from './types';

export class Repository<T> {
  private pool: any;
  private entity: new () => T;
  private metadata: any;

  constructor(pool: any, entity: new () => T) {
    this.pool = pool;
    this.entity = entity;
    this.metadata = Reflect.getMetadata(ENTITY_METADATA_KEY, entity);
  }

  private getColumnName(propertyKey: string | symbol): string {
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
    const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
    
    const allColumns = [...columns, ...primaryColumns];
    const column = allColumns.find(col => col.propertyKey === propertyKey);
    return (column?.columnName || propertyKey.toString()).toUpperCase();
  }

  private async getNextId(): Promise<number> {
    return new Promise((resolve, reject) => {
      const tableName = this.metadata.name.toUpperCase();
      const sql = `SELECT NEXT VALUE FOR GEN_${tableName}_ID FROM RDB$DATABASE`;

      this.pool.get((err: Error, db: any) => {
        if (err) {
          reject(err);
          return;
        }

        db.query(sql, [], (err: Error, result: any[]) => {
          db.detach();
          if (err) {
            reject(err);
            return;
          }
          // node-firebird can return different structures depending on query
          const id = result[0][Object.keys(result[0])[0]];
          resolve(id);
        });
      });
    });
  }

  private buildWhereClause(where: Partial<T>): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    
    Object.entries(where).forEach(([key, value]) => {
      const columnName = this.getColumnName(key);
      conditions.push(`${columnName} = ?`);
      params.push(value);
    });

    return {
      sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  private buildOrderByClause(orderBy: { [K in keyof T]?: 'ASC' | 'DESC' }): string {
    const orders: string[] = [];
    
    Object.entries(orderBy).forEach(([key, direction]) => {
      const columnName = this.getColumnName(key);
      orders.push(`${columnName} ${direction}`);
    });

    return orders.length > 0 ? `ORDER BY ${orders.join(', ')}` : '';
  }

  private mapResultToEntity(result: any): T {
    const entity = new this.entity();
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
    const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
    
    const allColumns = [...columns, ...primaryColumns];
    
    allColumns.forEach(column => {
      const columnName = column.columnName.toUpperCase();
      const resultKey = Object.keys(result).find(key => key.toUpperCase() === columnName);
      
      if (resultKey) {
        (entity as any)[column.propertyKey] = result[resultKey];
      }
    });

    return entity;
  }

  /**
   * Encontra uma entidade pelo ID.
   *
   * @example
   * ```typescript
   * const user = await repository.findOne(1);
   * ```
   */
  async findOne(id: string | number): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      if (!primaryColumns.length) {
        reject(new NoPrimaryKeyError(this.entity.name));
        return;
      }

      const primaryColumn = primaryColumns[0];
      const tableName = this.metadata.name.toUpperCase();
      const sql = `SELECT * FROM ${tableName} WHERE ${primaryColumn.columnName.toUpperCase()} = ?`;

      this.pool.get((err: Error, db: any) => {
        if (err) {
          reject(err);
          return;
        }

        db.query(sql, [id], (err: Error, result: any[]) => {
          db.detach();
          if (err) {
            reject(err);
            return;
          }
          if (!result || result.length === 0) {
            resolve(null);
            return;
          }
          resolve(this.mapResultToEntity(result[0]));
        });
      });
    });
  }

  /**
   * Encontra entidades que satisfaçam as opções.
   *
   * @example
   * ```typescript
   * const users = await repository.find({ where: { active: true } });
   * ```
   */
  async find(options?: FindOptions<T>): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tableName = this.metadata.name.toUpperCase();
      const whereClause = options?.where ? this.buildWhereClause(options.where) : { sql: '', params: [] };
      const orderByClause = options?.orderBy ? this.buildOrderByClause(options.orderBy) : '';
      const limitClause = options?.take ? `FIRST ${options.take}` : '';
      const offsetClause = options?.skip ? `SKIP ${options.skip}` : '';

      const sql = `
        SELECT ${limitClause} ${offsetClause} * FROM ${tableName}
        ${whereClause.sql}
        ${orderByClause}
      `.trim().replace(/\s+/g, ' ');

      this.pool.get((err: Error, db: any) => {
        if (err) {
          reject(err);
          return;
        }

        db.query(sql, whereClause.params, (err: Error, result: any[]) => {
          db.detach();
          if (err) {
            reject(err);
            return;
          }
          if (!result) {
            resolve([]);
            return;
          }
          resolve(result.map(row => this.mapResultToEntity(row)));
        });
      });
    });
  }

  /**
   * Salva uma entidade (INSERT ou UPDATE).
   *
   * @example
   * ```typescript
   * const savedUser = await repository.save({ name: 'John' });
   * ```
   */
  async save(entity: Partial<T>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
      const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name.toUpperCase();

      try {
        if (primaryColumns.length) {
          const primaryColumn = primaryColumns[0];
          const id = (entity as any)[primaryColumn.propertyKey];
          
          if (!id) {
            const nextId = await this.getNextId();
            (entity as any)[primaryColumn.propertyKey] = nextId;
          }
        }
        
        const columnNames = columns.map((col: ColumnMetadata) => col.columnName.toUpperCase()).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((col: ColumnMetadata) => (entity as any)[col.propertyKey]);

        // Using RETURNING for Firebird 2.1+
        const primaryColumn = primaryColumns[0];
        const sql = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) RETURNING ${primaryColumn.columnName.toUpperCase()}`;

        this.pool.get((err: Error, db: any) => {
          if (err) {
            reject(err);
            return;
          }

          db.query(sql, values, (err: Error, result: any) => {
            db.detach();
            if (err) {
              reject(err);
              return;
            }

            const id = result[0][primaryColumn.columnName.toUpperCase()];
            this.findOne(id)
              .then(savedEntity => {
                if (!savedEntity) {
                  reject(new EntityNotFoundError(this.entity.name, id));
                  return;
                }
                resolve(savedEntity);
              })
              .catch(reject);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Atualiza uma entidade pelo ID.
   *
   * @example
   * ```typescript
   * await repository.update(1, { name: 'John Doe' });
   * ```
   */
  async update(id: string | number, entity: Partial<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
      const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name.toUpperCase();

      if (!primaryColumns.length) {
        reject(new NoPrimaryKeyError(this.entity.name));
        return;
      }

      const primaryColumn = primaryColumns[0];
      const setClause = columns
        .map((col: ColumnMetadata) => `${col.columnName.toUpperCase()} = ?`)
        .join(', ');
      const values = [
        ...columns.map((col: ColumnMetadata) => (entity as any)[col.propertyKey]),
        id
      ];

      const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryColumn.columnName.toUpperCase()} = ?`;

      this.pool.get((err: Error, db: any) => {
        if (err) {
          reject(err);
          return;
        }

        db.query(sql, values, (err: Error) => {
          db.detach();
          if (err) {
            reject(err);
            return;
          }
          this.findOne(id)
            .then(updatedEntity => {
              if (!updatedEntity) {
                reject(new EntityNotFoundError(this.entity.name, id));
                return;
              }
              resolve(updatedEntity);
            })
            .catch(reject);
        });
      });
    });
  }

  /**
   * Deleta uma entidade pelo ID.
   *
   * @example
   * ```typescript
   * await repository.delete(1);
   * ```
   */
  async delete(id: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name.toUpperCase();

      if (!primaryColumns.length) {
        reject(new NoPrimaryKeyError(this.entity.name));
        return;
      }

      const primaryColumn = primaryColumns[0];
      const sql = `DELETE FROM ${tableName} WHERE ${primaryColumn.columnName.toUpperCase()} = ?`;

      this.pool.get((err: Error, db: any) => {
        if (err) {
          reject(err);
          return;
        }

        db.query(sql, [id], (err: Error) => {
          db.detach();
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }
}
