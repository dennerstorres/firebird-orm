import { createConnection, FirebirdConnection } from '../../connection';
import * as Firebird from 'node-firebird';

describe('Connection Integration', () => {
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
    // Defensive check to skip tests if Firebird is not available
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
      console.warn('Firebird container not reachable, skipping integration tests.');
      return;
    }
  });

  it('should connect, ping and close the connection', async () => {
    if (skip) return;

    connection = await createConnection(options);

    const result = await connection.query('SELECT 1 FROM RDB$DATABASE');
    expect(result).toBeDefined();
    expect(result.length).toBe(1);

    await connection.close();
  });
});
