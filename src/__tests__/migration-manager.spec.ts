import * as fs from 'fs';
import * as path from 'path';
import { MigrationManager } from '../cli/migration-manager';
import { FirebirdConnection } from '../connection';

jest.mock('fs');
jest.mock('../connection');

describe('MigrationManager', () => {
  let manager: MigrationManager;
  let mockConnection: jest.Mocked<FirebirdConnection>;
  const migrationsDir = './migrations';

  beforeEach(() => {
    manager = new MigrationManager({ migrationsDir });
    mockConnection = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as any;
    jest.clearAllMocks();
  });

  it('should create migrations table if it does not exist', async () => {
    mockConnection.query.mockResolvedValueOnce([]); // Table check result

    await manager.ensureMigrationsTable(mockConnection);

    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM RDB$RELATIONS'),
      ['MIGRATIONS']
    );
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE MIGRATIONS')
    );
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE SEQUENCE GEN_MIGRATIONS_ID')
    );
  });

  it('should not create migrations table if it already exists', async () => {
    mockConnection.query.mockResolvedValueOnce([{ '1': 1 }]); // Table exists

    await manager.ensureMigrationsTable(mockConnection);

    expect(mockConnection.query).toHaveBeenCalledTimes(1);
    expect(mockConnection.query).not.toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE MIGRATIONS')
    );
  });

  it('should generate a migration file', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    const filePath = await manager.generate('CreateUsers');

    expect(filePath).toContain('CreateUsers');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('export class CreateUsers')
    );
  });
});
