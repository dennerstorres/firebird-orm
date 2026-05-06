import { Entity, Column, PrimaryGeneratedColumn, createConnection } from '../index';

/**
 * Entidade de Conta para exemplo de transação.
 *
 * @example
 * ```typescript
 * @Entity('CONTA_BANCARIA')
 * class Conta { ... }
 * ```
 */
@Entity('CONTA_BANCARIA')
class Conta {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  titular!: string;

  @Column()
  saldo!: number;
}

/**
 * Exemplo de uso de transações.
 *
 * @example
 * ```typescript
 * await runTransactionExample();
 * ```
 */
export async function runTransactionExample() {
  const connection = await createConnection({
    host: 'localhost',
    port: 3050,
    database: 'banco.fdb',
    user: 'SYSDBA',
    password: 'masterkey'
  });

  const repo = await connection.getRepository(Conta);

  /**
   * Firebird quirk: Transações são obrigatórias para operações de escrita.
   * O método connection.transaction() abstrai o controle de commit/rollback.
   */
  try {
    await connection.transaction(async (transaction) => {
      // Todas as operações aqui dentro rodam na mesma transação.
      // Em caso de erro, um rollback automático é executado.

      const contaOrigem = await repo.findOneOrFail(1);
      const contaDestino = await repo.findOneOrFail(2);

      const valorTransferencia = 100;

      if (contaOrigem.saldo < valorTransferencia) {
        throw new Error('Saldo insuficiente');
      }

      // Atualizando saldos
      await repo.update(contaOrigem.id, { saldo: contaOrigem.saldo - valorTransferencia });
      await repo.update(contaDestino.id, { saldo: contaDestino.saldo + valorTransferencia });

      // Se chegar aqui sem erros, o connection.transaction fará o commit.
    });
    console.log('Transferência realizada com sucesso!');
  } catch (error) {
    console.error('Erro na transação (Rollback executado):', error);
  } finally {
    await connection.close();
  }
}
