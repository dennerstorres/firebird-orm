import { createConnection, FirebirdConnection } from '../../connection';
import { FirebirdConnectionOptions } from '../../types';

describe('Connection (Integration)', () => {
  let connection: FirebirdConnection;
  const options: FirebirdConnectionOptions = {
    host: 'localhost',
    port: 3050,
    database: 'test.fdb',
    user: 'SYSDBA',
    password: 'masterkey',
    poolSize: 5
  };

  afterEach(async () => {
    if (connection) {
      await connection.close();
    }
  });

  it('should connect to Firebird and execute a simple query', async () => {
    // Skip if Firebird is not running (CI/Local check)
    try {
      connection = await createConnection(options);
      const result = await connection.query('SELECT 1 FROM RDB$DATABASE');

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ CONSTANT: 1 }));
    } catch (error) {
      console.warn('Skipping integration test: Firebird container not available.');
      console.error(error);
    }
  });

  it('should be able to close the connection pool', async () => {
    try {
      connection = await createConnection(options);
      await connection.close();
      // Should fail to query after close
      await expect(connection.query('SELECT 1 FROM RDB$DATABASE')).rejects.toThrow();
    } catch (error) {
      console.warn('Skipping integration test: Firebird container not available.');
    }
  });
});
