import * as Firebird from 'node-firebird';
import { ConnectionOptions } from './index';
import { Repository } from './repository';

export class Connection {
  private options: ConnectionOptions;
  private pool: any;

  constructor(options: ConnectionOptions) {
    this.options = options;
    this.pool = Firebird.pool(5, options);
  }

  async getRepository<T>(entity: new () => T): Promise<Repository<T>> {
    return new Repository<T>(this.pool, entity);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.pool.get((err: Error, db: any) => {
        if (err) {
          reject(err);
          return;
        }

        db.query(sql, params, (err: Error, result: T[]) => {
          db.detach();
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pool.destroy((err: Error) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

export async function createConnection(options: ConnectionOptions): Promise<Connection> {
  return new Connection(options);
} 