import * as Firebird from 'node-firebird';
import { FirebirdConnectionOptions } from './types';
import { Repository } from './repository';

/**
 * Representa uma conexão ativa com o banco de dados Firebird.
 *
 * @example
 * ```typescript
 * const connection = await createConnection(options);
 * const repo = await connection.getRepository(User);
 * ```
 */
export class Connection {
  private options: FirebirdConnectionOptions;
  private pool: any;
  private repositories: Map<Function, Repository<unknown>> = new Map();

  constructor(options: FirebirdConnectionOptions) {
    this.options = options;
    this.pool = Firebird.pool(options.poolSize || 5, options);
  }

  /**
   * Obtém um repositório para a entidade fornecida.
   *
   * @example
   * ```typescript
   * const repo = await connection.getRepository(User);
   * ```
   */
  async getRepository<T>(entity: new () => T): Promise<Repository<T>> {
    if (this.repositories.has(entity)) {
      return this.repositories.get(entity) as Repository<T>;
    }
    const repo = new Repository<T>(this.pool, entity);
    this.repositories.set(entity, repo as Repository<unknown>);
    return repo;
  }

  /**
   * Executa uma query SQL diretamente.
   *
   * @example
   * ```typescript
   * const results = await connection.query('SELECT * FROM USERS WHERE ID = ?', [1]);
   * ```
   */
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
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

  /**
   * Fecha o pool de conexões.
   *
   * @example
   * ```typescript
   * await connection.close();
   * ```
   */
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

/**
 * Cria uma nova conexão com o banco de dados Firebird.
 *
 * @example
 * ```typescript
 * const connection = await createConnection({
 *   host: 'localhost',
 *   database: 'test',
 *   user: 'SYSDBA',
 *   password: 'masterkey',
 *   port: 3050
 * });
 * ```
 */
export async function createConnection(options: FirebirdConnectionOptions): Promise<Connection> {
  return new Connection(options);
}
