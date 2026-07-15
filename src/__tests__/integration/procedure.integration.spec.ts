import { createConnection, FirebirdConnection } from '../../connection';
import { getTestConnectionOptions } from './test-connection';

describe('Procedure (Integration)', () => {
  let connection: FirebirdConnection;
  const options = getTestConnectionOptions();

  let skip = false;

  beforeAll(async () => {
    try {
      connection = await createConnection(options);
      await connection.query('SELECT 1 FROM RDB$DATABASE');
    } catch (error) {
      skip = true;
      console.warn('Skipping integration tests: Firebird container not available.');
    }
  });

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
  });

  it('should execute a procedure (selectable mockup via RDB$DATABASE)', async () => {
    if (skip) return;

    // We can't easily create a procedure without DDL permissions/setup,
    // but we can test if callProcedure generates a valid SELECT against a known table
    // acting as a "selectable procedure" syntax wise.
    // However, Firebird requires the procedure to exist for SELECT * FROM PROC.

    // So let's try to create a temporary procedure if we can.
    try {
      // Clean up just in case
      try { await connection.query('DROP PROCEDURE SP_ORM_TEST'); } catch (e) {}

      await connection.query(`
        CREATE PROCEDURE SP_ORM_TEST (IN_VAL INTEGER)
        RETURNS (OUT_VAL INTEGER)
        AS
        BEGIN
          OUT_VAL = IN_VAL * 2;
          SUSPEND;
        END
      `);

      const result = await connection.callProcedure<{ OUT_VAL: number }>('SP_ORM_TEST', [21], 'selectable');

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].OUT_VAL).toBe(42);

    } catch (error) {
       console.error('Failed to create/execute test procedure:', error);
       throw error;
    } finally {
       try { await connection.query('DROP PROCEDURE SP_ORM_TEST'); } catch (e) {}
    }
  });

  it('should execute an executable procedure', async () => {
    if (skip) return;

    try {
      try { await connection.query('DROP PROCEDURE SP_ORM_EXEC_TEST'); } catch (e) {}

      await connection.query(`
        CREATE PROCEDURE SP_ORM_EXEC_TEST (IN_VAL INTEGER)
        RETURNS (OUT_VAL INTEGER)
        AS
        BEGIN
          OUT_VAL = IN_VAL + 10;
        END
      `);

      const result = await connection.callProcedure<{ OUT_VAL: number }>('SP_ORM_EXEC_TEST', [5]);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].OUT_VAL).toBe(15);

    } catch (error) {
       console.error('Failed to create/execute test executable procedure:', error);
       throw error;
    } finally {
       try { await connection.query('DROP PROCEDURE SP_ORM_EXEC_TEST'); } catch (e) {}
    }
  });
});
