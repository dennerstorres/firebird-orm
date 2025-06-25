import { ENTITY_METADATA_KEY, COLUMN_METADATA_KEY, PRIMARY_COLUMN_METADATA_KEY } from './decorators';
import { FindOptions } from './types';

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
    const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
    const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
    
    const allColumns = [...columns, ...primaryColumns];
    const column = allColumns.find(col => col.propertyKey === propertyKey);
    return column?.name || propertyKey.toString();
  }

  private async getNextId(): Promise<number> {
    return new Promise((resolve, reject) => {
      const tableName = this.metadata.name;
      const sql = `SELECT GEN_ID(GEN_${tableName}_ID, 1) AS ID FROM RDB$DATABASE`;

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
          resolve(result[0].ID);
        });
      });
    });
  }

  private buildWhereClause(where: Partial<T>): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    
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
    const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
    const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
    
    const allColumns = [...columns, ...primaryColumns];
    
    allColumns.forEach(column => {
      const columnName = column.name.toLowerCase();
      const resultKey = Object.keys(result).find(key => key.toLowerCase() === columnName);
      
      if (resultKey) {
        (entity as any)[column.propertyKey] = result[resultKey];
      }
    });

    return entity;
  }

  async findOne(id: number): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      if (!primaryColumns.length) {
        reject(new Error('No primary key defined'));
        return;
      }

      const primaryColumn = primaryColumns[0];
      const tableName = this.metadata.name;
      const sql = `SELECT * FROM ${tableName} WHERE ${primaryColumn.name} = ?`;

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

  async find(options?: FindOptions<T>): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tableName = this.metadata.name;
      const whereClause = options?.where ? this.buildWhereClause(options.where) : { sql: '', params: [] };
      const orderByClause = options?.orderBy ? this.buildOrderByClause(options.orderBy) : '';
      const limitClause = options?.limit ? `ROWS ${options.limit}` : '';
      const offsetClause = options?.offset ? `OFFSET ${options.offset}` : '';

      const sql = `
        SELECT * FROM ${tableName}
        ${whereClause.sql}
        ${orderByClause}
        ${limitClause}
        ${offsetClause}
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

  async save(entity: Partial<T>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
      const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name;

      try {
        // Se não tem ID e tem coluna primária, gera o próximo ID
        if (primaryColumns.length) {
          const primaryColumn = primaryColumns[0];
          const id = (entity as any)[primaryColumn.propertyKey];
          
          if (!id) {
            const nextId = await this.getNextId();
            (entity as any)[primaryColumn.propertyKey] = nextId;
          }
        }
        
        const columnNames = columns.map((col: any) => col.name).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((col: any) => (entity as any)[col.propertyKey]);

        const sql = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;

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

            if (primaryColumns.length) {
              const primaryColumn = primaryColumns[0];
              const id = (entity as any)[primaryColumn.propertyKey];
              
              this.findOne(id)
                .then(savedEntity => {
                  if (!savedEntity) {
                    reject(new Error('Failed to save entity'));
                    return;
                  }
                  resolve(savedEntity);
                })
                .catch(reject);
            } else {
              resolve(this.mapResultToEntity(entity));
            }
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async update(id: number, entity: Partial<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
      const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name;

      if (!primaryColumns.length) {
        reject(new Error('No primary key defined'));
        return;
      }

      const primaryColumn = primaryColumns[0];
      const setClause = columns
        .map((col: any) => `${col.name} = ?`)
        .join(', ');
      const values = [
        ...columns.map((col: any) => (entity as any)[col.propertyKey]),
        id
      ];

      const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryColumn.name} = ?`;

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
                reject(new Error('Failed to update entity'));
                return;
              }
              resolve(updatedEntity);
            })
            .catch(reject);
        });
      });
    });
  }

  async delete(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name;

      if (!primaryColumns.length) {
        reject(new Error('No primary key defined'));
        return;
      }

      const primaryColumn = primaryColumns[0];
      const sql = `DELETE FROM ${tableName} WHERE ${primaryColumn.name} = ?`;

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