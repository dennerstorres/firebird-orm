import * as fs from 'fs';
import * as path from 'path';
import { Migration, MigrationOptions } from '../types';
import { FirebirdConnection } from '../connection';

/**
 * Gerenciador de migrations do Firebird ORM.
 *
 * @example
 * ```typescript
 * const manager = new MigrationManager({
 *   migrationsDir: './src/migrations',
 *   migrationsTable: 'MIGRATIONS'
 * });
 * ```
 */
export class MigrationManager {
  private options: MigrationOptions;
  private tableName: string;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.tableName = (options.migrationsTable || 'MIGRATIONS').toUpperCase();
  }

  /**
   * Garante que a tabela de histórico de migrations existe.
   *
   * @param connection - Instância da conexão com o banco.
   *
   * @example
   * ```typescript
   * await manager.ensureMigrationsTable(connection);
   * ```
   */
  async ensureMigrationsTable(connection: FirebirdConnection): Promise<void> {
    const checkSql = `
      SELECT 1 FROM RDB$RELATIONS
      WHERE RDB$RELATION_NAME = ?
    `;
    const result = await connection.query(checkSql, [this.tableName]);

    if (result.length === 0) {
      await connection.query(`
        CREATE TABLE ${this.tableName} (
          ID INTEGER NOT NULL,
          NAME VARCHAR(255) NOT NULL,
          EXECUTED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (ID)
        )
      `);

      await connection.query(`CREATE SEQUENCE GEN_${this.tableName}_ID`);
    }
  }

  /**
   * Gera um novo arquivo de migration.
   *
   * @param name - Nome base para a migration.
   * @returns O caminho do arquivo gerado.
   *
   * @example
   * ```typescript
   * const path = await manager.generate('CreateUsers');
   * ```
   */
  async generate(name: string): Promise<string> {
    if (!fs.existsSync(this.options.migrationsDir)) {
      fs.mkdirSync(this.options.migrationsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const className = `${name}${timestamp}`;
    const fileName = `${timestamp}-${name}.ts`;
    const filePath = path.join(this.options.migrationsDir, fileName);

    const template = `import { Migration, FirebirdConnection } from 'firebird-orm';

export class ${className} implements Migration {
  name = '${className}';

  async up(connection: FirebirdConnection): Promise<void> {
    // Implemente a lógica para aplicar a migration
  }

  async down(connection: FirebirdConnection): Promise<void> {
    // Implemente a lógica para reverter a migration
  }
}
`;

    fs.writeFileSync(filePath, template);
    return filePath;
  }

  /**
   * Executa todas as migrations pendentes.
   *
   * @param connection - Instância da conexão com o banco.
   * @returns Lista com o nome das migrations executadas.
   *
   * @example
   * ```typescript
   * const executed = await manager.run(connection);
   * ```
   */
  async run(connection: FirebirdConnection): Promise<string[]> {
    await this.ensureMigrationsTable(connection);

    try {
      require('ts-node').register();
    } catch (e) {}

    const files = fs.readdirSync(this.options.migrationsDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    const executedSql = `SELECT NAME FROM ${this.tableName}`;
    const executedRows = await connection.query<{ NAME: string }>(executedSql);
    const executedNames = new Set(executedRows.map(r => r.NAME.trim()));

    const migrationsToRun: string[] = [];

    for (const file of files) {
      const filePath = path.resolve(this.options.migrationsDir, file);

      delete require.cache[filePath];
      const migrationModule = require(filePath);

      const MigrationClass = Object.values(migrationModule).find(
        (val: any) => typeof val === 'function' && val.prototype && 'up' in val.prototype
      ) as new () => Migration;

      if (!MigrationClass) continue;
      const migration = new MigrationClass();

      if (!executedNames.has(migration.name)) {
        await connection.transaction(async (transaction: any) => {
          // Wrapped connection to match FirebirdConnection interface roughly
          const wrappedConn = {
            query: (sql: string, params: unknown[] = []) =>
              new Promise((resolve, reject) => {
                transaction.query(sql, params, (err: Error, res: any) => {
                  if (err) return reject(err);
                  resolve(res);
                });
              })
          } as unknown as FirebirdConnection;

          await migration.up(wrappedConn);

          const insertSql = `
            INSERT INTO ${this.tableName} (ID, NAME)
            VALUES (NEXT VALUE FOR GEN_${this.tableName}_ID, ?)
            RETURNING ID
          `;
          await new Promise((resolve, reject) => {
             transaction.query(insertSql, [migration.name], (err: Error) => {
               if (err) return reject(err);
               resolve(true);
             });
          });
        });
        migrationsToRun.push(migration.name);
      }
    }

    return migrationsToRun;
  }

  /**
   * Reverte a última migration executada.
   *
   * @param connection - Instância da conexão com o banco.
   * @returns O nome da migration revertida ou null se não houver nenhuma.
   *
   * @example
   * ```typescript
   * const reverted = await manager.revert(connection);
   * ```
   */
  async revert(connection: FirebirdConnection): Promise<string | null> {
    await this.ensureMigrationsTable(connection);

    try {
      require('ts-node').register();
    } catch (e) {}

    const lastMigrationSql = `
      SELECT FIRST 1 NAME FROM ${this.tableName}
      ORDER BY ID DESC
    `;
    const result = await connection.query<{ NAME: string }>(lastMigrationSql);

    if (result.length === 0) {
      return null;
    }

    const migrationName = result[0].NAME.trim();

    const files = fs.readdirSync(this.options.migrationsDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    let migrationToRevert: Migration | null = null;
    for (const file of files) {
      const filePath = path.resolve(this.options.migrationsDir, file);
      delete require.cache[filePath];
      const migrationModule = require(filePath);
      const MigrationClass = Object.values(migrationModule).find(
        (val: any) => typeof val === 'function' && val.prototype && 'down' in val.prototype
      ) as new () => Migration;

      if (!MigrationClass) continue;
      const migration = new MigrationClass();

      if (migration.name === migrationName) {
        migrationToRevert = migration;
        break;
      }
    }

    if (!migrationToRevert) {
      throw new Error(`Arquivo da migration "${migrationName}" não encontrado no diretório.`);
    }

    await connection.transaction(async (transaction: any) => {
      const wrappedConn = {
        query: (sql: string, params: unknown[] = []) =>
          new Promise((resolve, reject) => {
            transaction.query(sql, params, (err: Error, res: any) => {
              if (err) return reject(err);
              resolve(res);
            });
          })
      } as unknown as FirebirdConnection;

      await migrationToRevert!.down(wrappedConn);

      await new Promise((resolve, reject) => {
        transaction.query(`DELETE FROM ${this.tableName} WHERE NAME = ?`, [migrationName], (err: Error) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    });

    return migrationName;
  }
}
