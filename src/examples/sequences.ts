import { Entity, PrimaryGeneratedColumn, createConnection } from '../index';

/**
 * Exemplo de uso de sequence padrão.
 *
 * @example
 * ```typescript
 * @Entity('USUARIOS')
 * class Usuario { ... }
 * ```
 */
@Entity('USUARIOS')
class Usuario {
  /**
   * Firebird quirk: Por padrão, o ORM assume que a sequence segue o padrão GEN_{TABELA}_{COLUNA}.
   * No caso abaixo, seria GEN_USUARIOS_ID.
   */
  @PrimaryGeneratedColumn()
  id!: number;
}

/**
 * Exemplo de uso de sequence customizada.
 */
@Entity('CLIENTES')
class Cliente {
  /**
   * Você pode especificar um nome de sequence customizado que já existe no banco.
   */
  @PrimaryGeneratedColumn({ sequenceName: 'SEQ_CLIENTE_PK' })
  codigo!: number;
}

/**
 * Exemplo de funcionamento de sequences.
 *
 * @example
 * ```typescript
 * await runSequencesExample();
 * ```
 */
export async function runSequencesExample() {
  const connection = await createConnection({
    host: 'localhost',
    port: 3050,
    database: 'empresa.fdb',
    user: 'SYSDBA',
    password: 'masterkey'
  });

  const userRepo = await connection.getRepository(Usuario);
  const clientRepo = await connection.getRepository(Cliente);

  // Ao salvar, o ORM executa:
  // Para Usuario: SELECT NEXT VALUE FOR GEN_USUARIOS_ID FROM RDB$DATABASE
  await userRepo.save({ /* ... */ });

  // Para Cliente: SELECT NEXT VALUE FOR SEQ_CLIENTE_PK FROM RDB$DATABASE
  await clientRepo.save({ /* ... */ });

  /**
   * Importante: O Firebird 2.5 usa o termo 'GENERATOR' de forma intercambiável com 'SEQUENCE'.
   * 'CREATE GENERATOR SEQ_CLIENTE_PK;' é equivalente a 'CREATE SEQUENCE SEQ_CLIENTE_PK;'.
   */

  await connection.close();
}
