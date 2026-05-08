import { FluentQueryBuilder } from '../fluent-query-builder';
import { FirebirdConnection } from '../connection';
import { Entity, Column, PrimaryGeneratedColumn } from '../decorators';

@Entity('USERS')
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  active!: number;
}

describe('FluentQueryBuilder', () => {
  let connectionMock: jest.Mocked<FirebirdConnection>;
  let qb: FluentQueryBuilder<User>;

  beforeEach(() => {
    connectionMock = {
      query: jest.fn(),
    } as any;
    qb = new FluentQueryBuilder(connectionMock, User);
  });

  describe('SQL Building', () => {
    it('should build a simple select', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT ID, NAME, ACTIVE FROM USERS',
        []
      );
    });

    it('should build select with where', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.where('ACTIVE = ?', [1]).getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT ID, NAME, ACTIVE FROM USERS WHERE ACTIVE = ?',
        [1]
      );
    });

    it('should build select with andWhere', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.where('ACTIVE = ?', [1]).andWhere('NAME LIKE ?', ['J%']).getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT ID, NAME, ACTIVE FROM USERS WHERE ACTIVE = ? AND NAME LIKE ?',
        [1, 'J%']
      );
    });

    it('should build select with orderBy', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.orderBy('NAME', 'DESC').getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT ID, NAME, ACTIVE FROM USERS ORDER BY NAME DESC',
        []
      );
    });

    it('should build select with take (FIRST)', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.take(10).getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT FIRST 10 ID, NAME, ACTIVE FROM USERS',
        []
      );
    });

    it('should build select with skip (FIRST/SKIP)', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.skip(20).getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT FIRST 999999999 SKIP 20 ID, NAME, ACTIVE FROM USERS',
        []
      );
    });

    it('should build select with take and skip', async () => {
      connectionMock.query.mockResolvedValue([]);
      await qb.take(10).skip(20).getMany();

      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT FIRST 10 SKIP 20 ID, NAME, ACTIVE FROM USERS',
        []
      );
    });
  });

  describe('Execution methods', () => {
    it('should return entities in getMany', async () => {
      connectionMock.query.mockResolvedValue([
        { ID: 1, NAME: 'John', ACTIVE: 1 },
        { ID: 2, NAME: 'Jane', ACTIVE: 1 },
      ]);

      const result = await qb.getMany();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(User);
      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('John');
    });

    it('should return one entity in getOne', async () => {
      connectionMock.query.mockResolvedValue([
        { ID: 1, NAME: 'John', ACTIVE: 1 },
      ]);

      const result = await qb.getOne();

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe(1);
      expect(connectionMock.query).toHaveBeenCalledWith(
        expect.stringContaining('FIRST 1'),
        expect.any(Array)
      );
    });

    it('should return null in getOne if no results', async () => {
      connectionMock.query.mockResolvedValue([]);

      const result = await qb.getOne();

      expect(result).toBeNull();
    });

    it('should return count in getCount', async () => {
      connectionMock.query.mockResolvedValue([{ COUNT: 5 }]);

      const result = await qb.where('ACTIVE = ?', [1]).getCount();

      expect(result).toBe(5);
      expect(connectionMock.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM USERS WHERE ACTIVE = ?',
        [1]
      );
    });
  });
});
