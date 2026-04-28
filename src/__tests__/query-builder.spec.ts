import { QueryBuilder } from '../query-builder';

describe('QueryBuilder', () => {
  let qb: QueryBuilder;

  beforeEach(() => {
    qb = new QueryBuilder();
  });

  describe('buildSelect', () => {
    it('should build a simple SELECT', () => {
      const { sql, params } = qb.buildSelect('usuarios', ['id', 'nome']);
      expect(sql).toBe('SELECT ID, NOME FROM USUARIOS');
      expect(params).toEqual([]);
    });

    it('should build a SELECT with FIRST and SKIP', () => {
      const { sql, params } = qb.buildSelect('usuarios', ['id'], {}, {}, 10, 20);
      expect(sql).toBe('SELECT FIRST 10 SKIP 20 ID FROM USUARIOS');
      expect(params).toEqual([]);
    });

    it('should build a SELECT with multiple WHERE conditions', () => {
      const { sql, params } = qb.buildSelect('usuarios', ['*'], { ativo: 1, tipo: 'admin' });
      expect(sql).toBe('SELECT * FROM USUARIOS WHERE ATIVO = ? AND TIPO = ?');
      expect(params).toEqual([1, 'admin']);
    });

    it('should build a SELECT with ORDER BY', () => {
      const { sql, params } = qb.buildSelect('usuarios', ['id'], {}, { nome: 'ASC', id: 'DESC' });
      expect(sql).toBe('SELECT ID FROM USUARIOS ORDER BY NOME ASC, ID DESC');
      expect(params).toEqual([]);
    });
  });

  describe('buildInsert', () => {
    it('should build an INSERT with RETURNING', () => {
      const { sql, params } = qb.buildInsert('usuarios', ['id', 'nome'], [1, 'João'], 'id');
      expect(sql).toBe('INSERT INTO USUARIOS (ID, NOME) VALUES (?, ?) RETURNING ID');
      expect(params).toEqual([1, 'João']);
    });

    it('should build an INSERT without RETURNING', () => {
      const { sql, params } = qb.buildInsert('usuarios', ['nome'], ['Maria']);
      expect(sql).toBe('INSERT INTO USUARIOS (NOME) VALUES (?)');
      expect(params).toEqual(['Maria']);
    });
  });

  describe('buildUpdate', () => {
    it('should build an UPDATE by ID', () => {
      const { sql, params } = qb.buildUpdate('usuarios', { nome: 'João Silva', ativo: 0 }, 'id', 1);
      expect(sql).toBe('UPDATE USUARIOS SET NOME = ?, ATIVO = ? WHERE ID = ?');
      expect(params).toEqual(['João Silva', 0, 1]);
    });
  });

  describe('buildDelete', () => {
    it('should build a DELETE by ID', () => {
      const { sql, params } = qb.buildDelete('usuarios', 'id', 1);
      expect(sql).toBe('DELETE FROM USUARIOS WHERE ID = ?');
      expect(params).toEqual([1]);
    });
  });

  describe('buildCount', () => {
    it('should build a simple COUNT', () => {
      const { sql, params } = qb.buildCount('usuarios');
      expect(sql).toBe('SELECT COUNT(*) FROM USUARIOS');
      expect(params).toEqual([]);
    });

    it('should build a COUNT with WHERE', () => {
      const { sql, params } = qb.buildCount('usuarios', { ativo: 1 });
      expect(sql).toBe('SELECT COUNT(*) FROM USUARIOS WHERE ATIVO = ?');
      expect(params).toEqual([1]);
    });
  });
});
