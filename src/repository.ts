import { ENTITY_METADATA_KEY, COLUMN_METADATA_KEY, PRIMARY_COLUMN_METADATA_KEY } from './decorators';

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

  private mapResultToEntity(result: any): T {
    const entity = new this.entity();
    const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
    const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
    
    const allColumns = [...columns, ...primaryColumns];

    allColumns.forEach(column => {
      // Verifica se a coluna existe no resultado (case insensitive)
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
          const mappedEntity = this.mapResultToEntity(result[0]);
          resolve(mappedEntity);
        });
      });
    });
  }

  async find(): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tableName = this.metadata.name;
      const sql = `SELECT * FROM ${tableName}`;


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
          if (!result) {
            resolve([]);
            return;
          }
          const mappedEntities = result.map(row => {
            const entity = this.mapResultToEntity(row);
            return entity;
          });
          resolve(mappedEntities);
        });
      });
    });
  }

  async save(entity: Partial<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, this.entity) || [];
      const primaryColumns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, this.entity) || [];
      const tableName = this.metadata.name;
      
      const columnNames = columns.map((col: any) => col.name).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((col: any) => (entity as any)[col.propertyKey]);

      const sql = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;

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

          if (primaryColumns.length) {
            const primaryColumn = primaryColumns[0];
            const id = (entity as any)[primaryColumn.propertyKey];
            
            if (id) {
              // Se já tem ID, busca o registro
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
              // Se não tem ID, busca o último registro inserido
              const lastIdSql = `SELECT GEN_ID(GEN_${tableName}_ID, 0) AS ID FROM RDB$DATABASE`;
              db.query(lastIdSql, [], (err: Error, result: any[]) => {
                if (err) {
                  reject(err);
                  return;
                }
                const lastId = result[0].ID;
                this.findOne(lastId)
                  .then(savedEntity => {
                    if (!savedEntity) {
                      reject(new Error('Failed to save entity'));
                      return;
                    }
                    resolve(savedEntity);
                  })
                  .catch(reject);
              });
            }
          } else {
            resolve(this.mapResultToEntity(entity));
          }
        });
      });
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