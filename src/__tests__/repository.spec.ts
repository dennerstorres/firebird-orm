import { Repository } from '../repository';
import { Entity, PrimaryGeneratedColumn, Column } from '../decorators';

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
});
