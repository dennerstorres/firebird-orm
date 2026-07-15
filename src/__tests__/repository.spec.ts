import { Repository } from '../repository';
import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column } from '../decorators';
import { EntityNotFoundError } from '../types';
import { EventEmitter } from 'events';

@Entity('USERS')
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ name: 'IS_ACTIVE' })
  isActive!: boolean;
}

describe('Repository', () => {
  let poolMock: any;
  let dbMock: any;
  let transactionMock: any;
  let repo: Repository<User>;

  beforeEach(() => {
    transactionMock = {
      query: jest.fn(),
      commit: jest.fn((cb: any) => cb(null)),
      rollback: jest.fn((cb: any) => cb()),
    };

    dbMock = {
      query: jest.fn(),
      detach: jest.fn(),
      transaction: jest.fn((isolation: any, cb: any) => cb(null, transactionMock)),
    };

    poolMock = {
      get: jest.fn((cb: any) => cb(null, dbMock)),
    };

    repo = new Repository<User>(poolMock, User);
  });

  describe('find', () => {
    it('should query the database and return entities', async () => {
      const mockRows = [{ ID: 1, NAME: 'John', IS_ACTIVE: 1 }];
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, mockRows));

      const results = await repo.find({ where: { isActive: true } });

      expect(dbMock.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM USERS WHERE IS_ACTIVE = ?'),
        [true],
        expect.any(Function)
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(User);
      expect(results[0].id).toBe(1);
      expect(results[0].name).toBe('John');
      expect(results[0].isActive).toBe(1); // node-firebird returns numbers for smallint
    });
  });

  describe('findOne', () => {
    it('should return a single entity by ID', async () => {
      const mockRows = [{ ID: 1, NAME: 'John', IS_ACTIVE: 1 }];
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, mockRows));

      const result = await repo.findOne(1);

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe(1);
    });

    it('should return null if not found', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, []));
      const result = await repo.findOne(999);
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should insert a new entity when ID is missing', async () => {
      // Mock for sequence
      transactionMock.query.mockImplementationOnce((sql: any, params: any, cb: any) => cb(null, [{ GEN_ID: 10 }]));
      // Mock for insert
      transactionMock.query.mockImplementationOnce((sql: any, params: any, cb: any) => cb(null, [{ ID: 10 }]));
      // Mock for findOne after save
      transactionMock.query.mockImplementationOnce((sql: any, params: any, cb: any) => cb(null, [{ ID: 10, NAME: 'New User', IS_ACTIVE: 1 }]));

      const newUser = await repo.save({ name: 'New User', isActive: true });

      expect(transactionMock.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT NEXT VALUE FOR GEN_USERS_ID'),
        [],
        expect.any(Function)
      );

      // Check parameters of the second call (insert)
      const insertCall = transactionMock.query.mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO USERS');
      // The order of columns in Repository.mapToColumns depends on Object.entries,
      // but Repository.save uses getColumnMetadata order indirectly or direct mapping.
      // In my implementation of Repository.save:
      // const columnsMap = this.mapToColumns(entityToInsert);
      // const { sql, params } = this.qb.buildInsert(tableName, Object.keys(columnsMap), Object.values(columnsMap), pk.columnName);
      // mapToColumns uses Object.entries(entity).
      // { name: 'New User', isActive: true, id: 10 }
      // So order is ['NAME', 'IS_ACTIVE', 'ID'] -> values ['New User', true, 10]
      expect(insertCall[1]).toEqual(expect.arrayContaining(['New User', true, 10]));

      expect(newUser.id).toBe(10);
    });

    it('should update an existing entity when ID is present', async () => {
      // Mock for update
      transactionMock.query.mockImplementationOnce((sql: any, params: any, cb: any) => cb(null, []));
      // Mock for findOneOrFail (which calls find)
      dbMock.query.mockImplementationOnce((sql: any, params: any, cb: any) => cb(null, [{ ID: 1, NAME: 'Updated Name', IS_ACTIVE: 1 }]));

      const updatedUser = await repo.save({ id: 1, name: 'Updated Name' });

      expect(transactionMock.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE USERS SET NAME = ? WHERE ID = ?'),
        ['Updated Name', 1],
        expect.any(Function)
      );
      expect(updatedUser.name).toBe('Updated Name');
    });
  });

  describe('count', () => {
    it('should return the number of records', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, [{ COUNT: 5 }]));

      const total = await repo.count();

      expect(dbMock.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM USERS'),
        [],
        expect.any(Function)
      );
      expect(total).toBe(5);
    });
  });

  describe('delete', () => {
    it('should delete a record by ID', async () => {
      transactionMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, []));

      await repo.delete(1);

      expect(transactionMock.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM USERS WHERE ID = ?'),
        [1],
        expect.any(Function)
      );
    });
  });

  describe('branch coverage', () => {
    it('find with orderBy should append ORDER BY clause', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) =>
        cb(null, [{ ID: 2, NAME: 'B', IS_ACTIVE: 1 }, { ID: 1, NAME: 'A', IS_ACTIVE: 1 }])
      );

      const results = await repo.find({ orderBy: { name: 'ASC' } });

      expect(dbMock.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY NAME ASC'),
        [],
        expect.any(Function)
      );
      expect(results).toHaveLength(2);
    });

    it('find with select should project only selected columns', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, [{ NAME: 'Only' }]));

      const results = await repo.find({ select: ['name'] });

      expect(dbMock.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT NAME FROM USERS/),
        [],
        expect.any(Function)
      );
      expect(results[0].name).toBe('Only');
      // IS_ACTIVE not selected, so it stays undefined on the entity instance
      expect(results[0].isActive).toBeUndefined();
    });

    it('findOneOrFail throws EntityNotFoundError when not found', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, []));

      await expect(repo.findOneOrFail(999)).rejects.toThrow(EntityNotFoundError);
      await expect(repo.findOneOrFail(999)).rejects.toThrow(/User.*999/);
    });

    it('update with only the PK in payload returns early (no SQL emitted)', async () => {
      // Calling update with just the PK should be a no-op (don't update PK to itself)
      const callCountBefore = transactionMock.query.mock.calls.length;
      await repo.update(1, { id: 1 });
      const callCountAfter = transactionMock.query.mock.calls.length;
      expect(callCountAfter).toBe(callCountBefore);
    });

    it('count with where clause applies the filter', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) => cb(null, [{ COUNT: 3 }]));

      const total = await repo.count({ isActive: true });

      expect(dbMock.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM USERS WHERE IS_ACTIVE = ?'),
        [true],
        expect.any(Function)
      );
      expect(total).toBe(3);
    });

    it('transaction rolls back when inner fn throws', async () => {
      // Build a transaction mock whose query will throw to simulate a DB error mid-transaction.
      const rollbackMock = jest.fn((cb: any) => cb && cb());
      const failingTx: any = {
        query: jest.fn((_sql: any, _params: any, cb: any) => cb(new Error('simulated DB error'))),
        commit: jest.fn(),
        rollback: rollbackMock,
      };
      dbMock.transaction = jest.fn((iso: any, cb: any) => cb(null, failingTx));

      await expect(repo.delete(123)).rejects.toThrow('simulated DB error');
      // Inner fn threw, so transaction.rollback must be called and transaction.commit must NOT.
      expect(rollbackMock).toHaveBeenCalledTimes(1);
      expect(failingTx.commit).not.toHaveBeenCalled();
    });

    it('save with non-generated PK (provided ID) takes the update path', async () => {
      // When id is provided, save() goes through update() + findOneOrFail(), not insert/sequence.
      @Entity('NO_GEN')
      class NoGen {
        @PrimaryColumn()
        id!: number;
        @Column() name!: string;
      }
      const localRepo = new Repository<NoGen>(poolMock, NoGen);

      // update() runs inside executeInTransaction → transaction.query
      transactionMock.query.mockImplementationOnce((sql: any, _p: any, cb: any) => {
        expect(sql).toContain('UPDATE NO_GEN');
        cb(null, []);
      });
      // findOneOrFail() → find() → db.query
      dbMock.query.mockImplementationOnce((sql: any, _p: any, cb: any) => {
        expect(sql).toContain('FROM NO_GEN');
        cb(null, [{ ID: 42, NAME: 'Manual' }]);
      });

      const result = await localRepo.save({ id: 42, name: 'Manual' });
      expect(result.id).toBe(42);
      expect(result.name).toBe('Manual');
      // No sequence call should ever be made.
      const allSql = transactionMock.query.mock.calls.map((c: any[]) => c[0]).join(' ');
      expect(allSql).not.toContain('NEXT VALUE FOR');
    });

    it('mapToEntity resolves BLOB values that come back as functions', async () => {
      // node-firebird returns BLOBs as a function that calls cb(err, name, EventEmitter).
      const blobFn = jest.fn().mockImplementation((cb: any) => {
        const ee = new EventEmitter();
        cb(null, 'blob', ee);
        setImmediate(() => {
          ee.emit('data', Buffer.from('BLOBPAYLOAD'));
          ee.emit('end');
        });
      });

      dbMock.query.mockImplementation((sql: any, params: any, cb: any) =>
        cb(null, [{ ID: 1, NAME: 'B', DATA_BLOB: blobFn }])
      );

      @Entity('BLOB_ENT')
      class BlobEnt {
        @PrimaryGeneratedColumn()
        id!: number;
        @Column() name!: string;
        @Column({ name: 'DATA_BLOB' })
        data!: Buffer;
      }
      const blobRepo = new Repository<BlobEnt>(poolMock, BlobEnt);

      const results = await blobRepo.find();
      expect(blobFn).toHaveBeenCalled();
      expect(results[0].data).toBeInstanceOf(Buffer);
      expect(results[0].data.toString()).toBe('BLOBPAYLOAD');
    });

    it('findOneOrFail returns the entity when found', async () => {
      dbMock.query.mockImplementation((sql: any, params: any, cb: any) =>
        cb(null, [{ ID: 5, NAME: 'Found', IS_ACTIVE: 1 }])
      );

      const entity = await repo.findOneOrFail(5);
      expect(entity.id).toBe(5);
      expect(entity.name).toBe('Found');
    });
  });
});
