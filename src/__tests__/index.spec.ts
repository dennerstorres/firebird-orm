/**
 * Smoke test for the public API barrel exports in src/index.ts.
 * Ensures every exported symbol is importable and is a usable value/type.
 * This catches accidental export removal during refactors.
 */
import * as api from '../index';

describe('Public API (index.ts)', () => {
  it('exports connection helpers', () => {
    expect(typeof api.createConnection).toBe('function');
    expect(typeof api.FirebirdConnection).toBe('function');
  });

  it('exports decorators and metadata helpers', () => {
    expect(typeof api.Entity).toBe('function');
    expect(typeof api.Column).toBe('function');
    expect(typeof api.PrimaryGeneratedColumn).toBe('function');
    expect(typeof api.PrimaryColumn).toBe('function');
    expect(typeof api.getTableName).toBe('function');
    expect(typeof api.getColumnMetadata).toBe('function');
    expect(typeof api.getPrimaryColumn).toBe('function');
  });

  it('exports error classes', () => {
    expect(typeof api.FirebirdOrmError).toBe('function');
    expect(typeof api.EntityNotFoundError).toBe('function');
    expect(typeof api.NoPrimaryKeyError).toBe('function');

    const e = new api.EntityNotFoundError('User', 1);
    expect(e).toBeInstanceOf(api.FirebirdOrmError);
    expect(e.message).toContain('User');
    expect(e.message).toContain('1');

    const n = new api.NoPrimaryKeyError('Foo');
    expect(n).toBeInstanceOf(api.FirebirdOrmError);
    expect(n.message).toContain('Foo');
  });

  it('exports Repository', () => {
    expect(typeof api.Repository).toBe('function');
  });

  it('exports blob helpers', () => {
    expect(typeof api.resolveBlob).toBe('function');
  });

  it('exports query builders and procedure helpers', () => {
    expect(typeof api.FluentQueryBuilder).toBe('function');
    expect(typeof api.ProcedureBuilder).toBe('function');
  });
});
