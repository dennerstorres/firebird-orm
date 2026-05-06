import { createConnection, FirebirdConnection } from '../../connection';
import { Repository } from '../../repository';
import { Entity, PrimaryGeneratedColumn, Column } from '../../decorators';
import { FirebirdConnectionOptions } from '../../types';

@Entity('TEST_USERS')
class TestUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ name: 'IS_ACTIVE' })
  isActive!: boolean;
}

describe('Repository (Integration)', () => {
  let connection: FirebirdConnection;
  let repo: Repository<TestUser>;
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
      // Check if connection is really available
      await connection.query('SELECT 1 FROM RDB$DATABASE');
      isAvailable = true;

      // Setup: Create table and sequence if they don't exist
      // Firebird 3.0+ supports CREATE TABLE IF NOT EXISTS, but for 2.5 compatibility:
      try {
        await connection.query('CREATE TABLE TEST_USERS (ID INTEGER NOT NULL PRIMARY KEY, NAME VARCHAR(100), IS_ACTIVE SMALLINT)');
      } catch (e) {}

      try {
        await connection.query('CREATE SEQUENCE GEN_TEST_USERS_ID');
      } catch (e) {}

      repo = await connection.getRepository(TestUser);
    } catch (error) {
      console.warn('Skipping integration test: Firebird container not available.');
    }
  });

  afterAll(async () => {
    if (connection) {
      try {
        await connection.query('DROP TABLE TEST_USERS');
        await connection.query('DROP SEQUENCE GEN_TEST_USERS_ID');
      } catch (e) {}
      await connection.close();
    }
  });

  it('should perform full CRUD lifecycle', async () => {
    if (!isAvailable) return;

    // 1. Create (Save)
    const newUser = await repo.save({ name: 'Integration Test', isActive: true });
    expect(newUser.id).toBeDefined();
    expect(newUser.name).toBe('Integration Test');
    expect(newUser.isActive).toBe(true);

    // 2. Read (FindOne)
    const foundUser = await repo.findOne(newUser.id);
    expect(foundUser).toBeDefined();
    expect(foundUser?.id).toBe(newUser.id);
    expect(foundUser?.name).toBe('Integration Test');

    // 3. Update (Save with ID)
    foundUser!.name = 'Updated Name';
    const updatedUser = await repo.save(foundUser!);
    expect(updatedUser.name).toBe('Updated Name');

    // 4. Count
    const total = await repo.count();
    expect(total).toBe(1);

    // 5. Delete
    await repo.delete(newUser.id);
    const afterDelete = await repo.findOne(newUser.id);
    expect(afterDelete).toBeNull();

    const finalTotal = await repo.count();
    expect(finalTotal).toBe(0);
  });

  it('should find multiple records with pagination', async () => {
    if (!isAvailable) return;

    await repo.save({ name: 'User 1', isActive: true });
    await repo.save({ name: 'User 2', isActive: true });
    await repo.save({ name: 'User 3', isActive: false });

    const all = await repo.find();
    expect(all.length).toBeGreaterThanOrEqual(3);

    const firstTwo = await repo.find({ take: 2 });
    expect(firstTwo).toHaveLength(2);

    const skipOne = await repo.find({ skip: 1, take: 1 });
    expect(skipOne).toHaveLength(1);
    expect(skipOne[0].name).toBe('User 2');
  });
});
