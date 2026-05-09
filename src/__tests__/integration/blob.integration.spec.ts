import { createConnection, FirebirdConnection } from '../../connection';
import { Repository } from '../../repository';
import { Entity, PrimaryGeneratedColumn, Column } from '../../decorators';
import { FirebirdConnectionOptions } from '../../types';

@Entity('TEST_BLOBS')
class TestBlob {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  description!: string;

  @Column({ name: 'DATA_BLOB' })
  data!: Buffer;
}

describe('BLOB Support (Integration)', () => {
  let connection: FirebirdConnection;
  let repo: Repository<TestBlob>;
  const options: FirebirdConnectionOptions = {
    host: 'localhost',
    port: 3050,
    database: 'test.fdb',
    user: 'SYSDBA',
    password: 'masterkey',
    poolSize: 5
  };

  let isAvailable = false;

  beforeAll(async () => {
    try {
      connection = await createConnection(options);
      await connection.query('SELECT 1 FROM RDB$DATABASE');
      isAvailable = true;

      try {
        await connection.query('CREATE TABLE TEST_BLOBS (ID INTEGER NOT NULL PRIMARY KEY, DESCRIPTION VARCHAR(100), DATA_BLOB BLOB SUB_TYPE 0)');
      } catch (e) {}

      try {
        await connection.query('CREATE SEQUENCE GEN_TEST_BLOBS_ID');
      } catch (e) {}

      repo = await connection.getRepository(TestBlob);
    } catch (error) {
      console.warn('Skipping integration test: Firebird container not available.');
    }
  });

  afterAll(async () => {
    if (connection) {
      try {
        await connection.query('DROP TABLE TEST_BLOBS');
        await connection.query('DROP SEQUENCE GEN_TEST_BLOBS_ID');
      } catch (e) {}
      await connection.close();
    }
  });

  it('should save and retrieve BLOB data', async () => {
    if (!isAvailable) return;

    const testContent = 'This is a test BLOB content ' + 'A'.repeat(1000);
    const testBuffer = Buffer.from(testContent);

    // 1. Create
    const saved = await repo.save({
      description: 'BLOB Test',
      data: testBuffer
    });

    expect(saved.id).toBeDefined();
    expect(saved.data).toBeInstanceOf(Buffer);
    expect(saved.data.toString()).toBe(testContent);

    // 2. Read
    const found = await repo.findOne(saved.id);
    expect(found).toBeDefined();
    expect(found?.data).toBeInstanceOf(Buffer);
    expect(found?.data.toString()).toBe(testContent);
  });

  it('should update BLOB data', async () => {
    if (!isAvailable) return;

    const initialBuffer = Buffer.from('Initial content');
    const saved = await repo.save({
      description: 'Update Test',
      data: initialBuffer
    });

    const updatedBuffer = Buffer.from('Updated content');
    await repo.update(saved.id, { data: updatedBuffer });

    const found = await repo.findOne(saved.id);
    expect(found?.data.toString()).toBe('Updated content');
  });
});
