import { createConnection, FirebirdConnection } from '../../connection';
import { Entity, PrimaryGeneratedColumn, Column } from '../../decorators';
import * as Firebird from 'node-firebird';

@Entity('TEST_USERS')
class TestUser {
  @PrimaryGeneratedColumn({ sequenceName: 'GEN_TEST_USERS_ID' })
  id!: number;

  @Column()
  name!: string;

  @Column({ name: 'EMAIL' })
  email!: string;
}

describe('Repository Integration', () => {
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

    // Setup table and sequence
    const db: any = await new Promise((resolve, reject) => {
      Firebird.attach(options, (err, db) => (err || !db) ? reject(err || new Error('No DB')) : resolve(db));
    });

    try {
      await new Promise((resolve) => {
        db.query('CREATE TABLE TEST_USERS (ID INTEGER NOT NULL PRIMARY KEY, NAME VARCHAR(100), EMAIL VARCHAR(100))', () => {
           // Ignore if table exists
           resolve(true);
        });
      });
      await new Promise((resolve) => {
        db.query('CREATE SEQUENCE GEN_TEST_USERS_ID', () => {
           // Ignore if sequence exists
           resolve(true);
        });
      });
    } finally {
      if (db) db.detach();
    }
  });

  it('should perform full CRUD operations', async () => {
    if (skip) {
      console.warn('Skipping Repository Integration test');
      return;
    }

    connection = await createConnection(options);
    const repo = await connection.getRepository(TestUser);

    // CREATE
    const user = new TestUser();
    user.name = 'Integration Test';
    user.email = 'test@example.com';
    const savedUser = await repo.save(user);

    expect(savedUser.id).toBeDefined();
    expect(savedUser.name).toBe('Integration Test');

    // READ
    const foundUser = await repo.findOne(savedUser.id);
    expect(foundUser).toBeDefined();
    expect(foundUser?.name).toBe('Integration Test');

    // UPDATE
    savedUser.name = 'Updated Name';
    await repo.save(savedUser);
    const updatedUser = await repo.findOne(savedUser.id);
    expect(updatedUser?.name).toBe('Updated Name');

    // DELETE
    await repo.delete(savedUser.id);
    const deletedUser = await repo.findOne(savedUser.id);
    expect(deletedUser).toBeNull();

    await connection.close();
  });
});
