import { Entity, Column, PrimaryGeneratedColumn, createConnection } from '../index';

/**
 * Entidade de Log para exemplo de paginação.
 *
 * @example
 * ```typescript
 * @Entity('LOGS_SISTEMA')
 * class Log { ... }
 * ```
 */
@Entity('LOGS_SISTEMA')
class Log {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  mensagem!: string;

  @Column({ name: 'DATA_HORA' })
  dataHora!: Date;
}

/**
 * Exemplo de paginação com FIRST/SKIP.
 *
 * @example
 * ```typescript
 * await runPaginationExample();
 * ```
 */
export async function runPaginationExample() {
  const connection = await createConnection({
    host: 'localhost',
    port: 3050,
    database: 'sistema.fdb',
    user: 'SYSDBA',
    password: 'masterkey'
  });

  const repo = await connection.getRepository(Log);

  /**
   * Firebird quirk: Paginação usa FIRST e SKIP.
   * O ORM mapeia 'take' para FIRST e 'skip' para SKIP.
   */

  // Página 1 (Primeiros 10 registros)
  const logsPagina1 = await repo.find({
    take: 10,
    skip: 0,
    orderBy: { dataHora: 'DESC' }
  });
  // SQL gerado: SELECT FIRST 10 SKIP 0 * FROM LOGS_SISTEMA ORDER BY DATA_HORA DESC

  // Página 2 (Próximos 10 registros)
  const logsPagina2 = await repo.find({
    take: 10,
    skip: 10,
    orderBy: { dataHora: 'DESC' }
  });
  // SQL gerado: SELECT FIRST 10 SKIP 10 * FROM LOGS_SISTEMA ORDER BY DATA_HORA DESC

  console.log(`Logs na página 1: ${logsPagina1.length}`);
  console.log(`Logs na página 2: ${logsPagina2.length}`);

  await connection.close();
}
