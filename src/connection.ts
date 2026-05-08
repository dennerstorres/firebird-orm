import * as Firebird from 'node-firebird';
import { FirebirdConnectionOptions } from './types';
import { Repository } from './repository';
import { FluentQueryBuilder } from './fluent-query-builder';

/**
 * Classe principal para gerenciar a conexão com o banco de dados Firebird.
 * Utiliza um pool de conexões interno para otimizar o acesso.
 *
 * @example
 * ```typescript
 * const connection = await createConnection({
 *   host: 'localhost',
 *   database: 'C:/dados/sistema.fdb',
 *   user: 'SYSDBA',
 *   password: 'masterkey',
 *   port: 3050
 * });
 *
 * const userRepository = await connection.getRepository(User);
 * ```
 */
export class FirebirdConnection {
  private options: FirebirdConnectionOptions;
  private pool: any;
  private repositories: Map<Function, Repository<unknown>> = new Map();

  /**
   * @internal
   * @param options - Opções de configuração da conexão.
   */
  constructor(options: FirebirdConnectionOptions) {
    this.options = options;
    this.pool = Firebird.pool(options.poolSize || 5, options);
  }

  /**
   * Cria uma nova instância do FluentQueryBuilder para a entidade especificada.
   *
   * @template T - Tipo da entidade.
   * @param EntityClass - Classe da entidade que possui o decorator `@Entity`.
   * @returns Uma nova instância de FluentQueryBuilder.
   *
   * @example
   * ```typescript
   * const qb = connection.createQueryBuilder(User);
   * ```
   */
  createQueryBuilder<T>(EntityClass: new () => T): FluentQueryBuilder<T> {
    return new FluentQueryBuilder<T>(this, EntityClass);
  }

  /**
   * Obtém (ou cria) uma instância de repositório para a entidade especificada.
   * Repositórios são cacheados internamente por classe de entidade.
   *
   * @template T - Tipo da entidade.
   * @param entity - Classe da entidade que possui o decorator `@Entity`.
   * @returns Uma Promise que resolve na instância do repositório.
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
   * Executa um conjunto de operações de banco de dados dentro de uma transação.
   * A transação é commitada automaticamente se a função `fn` for bem-sucedida,
   * ou revertida (rollback) em caso de erro.
   *
   * @template R - Tipo do retorno da função.
   * @param fn - Função que recebe o objeto de transação e executa as operações.
   * @returns O resultado da função `fn`.
   *
   * @example
   * ```typescript
   * const total = await connection.transaction(async (transaction) => {
   *   // Uso de queries diretas ou repositórios passando a transação
   *   return 100;
   * });
   * ```
   *
   * @remarks
   * **Firebird quirk:** No Firebird, transações são obrigatórias para operações de escrita (INSERT, UPDATE, DELETE).
   * Este método utiliza o nível de isolamento `READ_COMMITTED`.
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
   * Executa uma query SQL arbitrária diretamente no banco de dados.
   * Ideal para SELECTs complexos ou comandos que não se encaixam no modelo de repositório.
   *
   * @template T - Tipo esperado para os objetos retornados.
   * @param sql - String SQL com placeholders `?`.
   * @param params - Lista de parâmetros para a query.
   * @returns Uma Promise que resolve em um array com os resultados da query.
   *
   * @example
   * ```typescript
   * const rawUsers = await connection.query('SELECT ID, NOME FROM USUARIOS WHERE ATIVO = ?', [1]);
   * ```
   *
   * @example
   * ```typescript
   * // Usando paginação nativa do Firebird
   * const users = await connection.query('SELECT FIRST 10 SKIP 0 * FROM USUARIOS');
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
   * Encerra todas as conexões do pool de forma segura.
   * Deve ser chamado ao finalizar a aplicação para liberar recursos do servidor.
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
 * Função de fábrica para criar e inicializar uma nova `FirebirdConnection`.
 *
 * @param options - Configurações de acesso ao banco (host, database, user, password, etc).
 * @returns Uma Promise que resolve na nova instância de conexão.
 *
 * @example
 * ```typescript
 * const connection = await createConnection({
 *   host: '127.0.0.1',
 *   port: 3050,
 *   database: 'main_db',
 *   user: 'SYSDBA',
 *   password: 'masterkey'
 * });
 * ```
 */
export async function createConnection(options: FirebirdConnectionOptions): Promise<FirebirdConnection> {
  return new FirebirdConnection(options);
}
