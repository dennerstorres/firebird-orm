import { createConnection, FirebirdConnection } from '../../connection';
import { Entity, PrimaryGeneratedColumn, Column } from '../../decorators';
import * as Firebird from 'node-firebird';

@Entity('TRANS_TEST')
class TransTest {
  @PrimaryGeneratedColumn({ sequenceName: 'GEN_TRANS_TEST_ID' })
  id!: number;

  @Column()
  description!: string;
}

describe('Transaction Integration', () => {
  let connection: FirebirdConnection;
  const options = {
    host: 'localhost',
    port: 3050,
    database: 'test.fdb',
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false
  };

  let skip = false;

  beforeAll(async () => {
    const isAvailable = await new Promise<boolean>((resolve) => {
      Firebird.attach(options, (err, db) => {
        if (err || !db) {
          resolve(false);
        } else {
          db.detach();
          resolve(true);
        }
      });
    });

    if (!isAvailable) {
      skip = true;
      return;
    }

    const db: any = await new Promise((resolve, reject) => {
      Firebird.attach(options, (err, db) => (err || !db) ? reject(err || new Error('No DB')) : resolve(db));
    });

    try {
      await new Promise((resolve) => {
        db.query('CREATE TABLE TRANS_TEST (ID INTEGER NOT NULL PRIMARY KEY, DESCRIPTION VARCHAR(100))', () => resolve(true));
      });
      await new Promise((resolve) => {
        db.query('CREATE SEQUENCE GEN_TRANS_TEST_ID', () => resolve(true));
      });
    } finally {
      if (db) db.detach();
    }
  });

  it('should commit changes', async () => {
    if (skip) return;

    connection = await createConnection(options);
    const repo = await connection.getRepository(TransTest);

    const item = new TransTest();
    item.description = 'Before transaction';
    const saved = await repo.save(item);

    await connection.transaction(async (dbTrans) => {
      return new Promise((resolve, reject) => {
        dbTrans.query('UPDATE TRANS_TEST SET DESCRIPTION = ? WHERE ID = ?', ['After commit', saved.id], (err: any) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
    });

    const found = await repo.findOne(saved.id);
    expect(found?.description).toBe('After commit');

    await connection.close();
  });

  it('should rollback changes on error', async () => {
    if (skip) return;

    connection = await createConnection(options);
    const repo = await connection.getRepository(TransTest);

    const item = new TransTest();
    item.description = 'Initial';
    const saved = await repo.save(item);

    try {
      await connection.transaction(async (dbTrans) => {
        await new Promise((resolve, reject) => {
          dbTrans.query('UPDATE TRANS_TEST SET DESCRIPTION = ? WHERE ID = ?', ['Should rollback', saved.id], (err: any) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
        throw new Error('Forced error');
      });
    } catch (e) {
      // Expected
    }

    const found = await repo.findOne(saved.id);
    expect(found?.description).toBe('Initial');

    await connection.close();
  });
});
