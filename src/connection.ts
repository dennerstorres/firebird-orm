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
   * @param entity - Classe da entidade.
   * @returns Repositório da entidade.
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
   * Executa um bloco de código dentro de uma transação.
   *
   * @param fn - Função que recebe o banco e executa operações.
   * @returns Resultado da função.
   *
   * @example
   * ```typescript
   * await connection.transaction(async (db) => {
   *   // operações usando repositórios ou queries diretas
   * });
   * ```
   *
   * @remarks
   * **Firebird quirk:** Toda operação de escrita DEVE estar em uma transação.
   */
  async transaction<R>(fn: (transaction: any) => Promise<R>): Promise<R> {
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
