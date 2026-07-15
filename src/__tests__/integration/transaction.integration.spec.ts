import { createConnection, FirebirdConnection } from '../../connection';
import { Repository } from '../../repository';
import { Entity, PrimaryGeneratedColumn, Column } from '../../decorators';
import { getTestConnectionOptions } from './test-connection';

@Entity('TEST_TRANS')
class TestTrans {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}

describe('Transactions (Integration)', () => {
  let connection: FirebirdConnection;
  let repo: Repository<TestTrans>;
  const options = getTestConnectionOptions();

  let isAvailable = false;

  beforeAll(async () => {
    try {
      connection = await createConnection(options);
      await connection.query('SELECT 1 FROM RDB$DATABASE');
      isAvailable = true;

      try {
        await connection.query('CREATE TABLE TEST_TRANS (ID INTEGER NOT NULL PRIMARY KEY, NAME VARCHAR(100))');
      } catch (e) {}
      try {
        await connection.query('CREATE SEQUENCE GEN_TEST_TRANS_ID');
      } catch (e) {}
      repo = await connection.getRepository(TestTrans);
    } catch (error) {
      console.warn('Skipping integration test: Firebird container not available.');
    }
  });

  afterAll(async () => {
    if (connection) {
      try {
        await connection.query('DROP TABLE TEST_TRANS');
        await connection.query('DROP SEQUENCE GEN_TEST_TRANS_ID');
      } catch (e) {}
      await connection.close();
    }
  });

  it('should commit changes', async () => {
    if (!isAvailable) return;

    await connection.transaction(async (transaction) => {
      // In F4, Repository was implemented to take pool, but Connection.transaction passes a raw transaction object.
      // However, Connection.transaction JSDoc says it receives Repository in the roadmap,
      // but current implementation in src/connection.ts passes 'transaction' (raw node-firebird transaction).
      // Let's check how F4/F5 implemented it.

      // Checking connection.ts:
      // async transaction<R>(fn: (transaction: any) => Promise<R>): Promise<R> { ... fn(transaction) ... }

      // Wait, the roadmap for F5 says:
      // transaction<R>(fn: (repo: Repository<T>) => Promise<R>): Promise<R>

      // But the current code in connection.ts I read earlier was:
      // async transaction<R>(fn: (transaction: any) => Promise<R>): Promise<R>

      // Let's use raw transaction query to verify it works.
      return new Promise((resolve, reject) => {
        transaction.query('INSERT INTO TEST_TRANS (ID, NAME) VALUES (?, ?)', [100, 'Committed'], (err: any) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    });

    const found = await repo.findOne(100);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Committed');
  });

  it('should rollback changes on error', async () => {
    if (!isAvailable) return;

    try {
      await connection.transaction(async (transaction) => {
        await new Promise((resolve, reject) => {
          transaction.query('INSERT INTO TEST_TRANS (ID, NAME) VALUES (?, ?)', [200, 'Rollback'], (err: any) => {
            if (err) return reject(err);
            resolve(true);
          });
        });
        throw new Error('Force Rollback');
      });
    } catch (e) {
      // expected
    }

    const found = await repo.findOne(200);
    expect(found).toBeNull();
  });
});
