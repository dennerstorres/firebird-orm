import { ProcedureBuilder } from '../procedure';

describe('ProcedureBuilder', () => {
  it('should build executable procedure call without params', () => {
    const { sql, params } = ProcedureBuilder.build('sp_test');
    expect(sql).toBe('EXECUTE PROCEDURE SP_TEST');
    expect(params).toEqual([]);
  });

  it('should build executable procedure call with params', () => {
    const { sql, params } = ProcedureBuilder.build('sp_test', [1, 'text']);
    expect(sql).toBe('EXECUTE PROCEDURE SP_TEST(?, ?)');
    expect(params).toEqual([1, 'text']);
  });

  it('should build selectable procedure call without params', () => {
    const { sql, params } = ProcedureBuilder.build('sp_test', [], 'selectable');
    expect(sql).toBe('SELECT * FROM SP_TEST');
    expect(params).toEqual([]);
  });

  it('should build selectable procedure call with params', () => {
    const { sql, params } = ProcedureBuilder.build('sp_test', [1, 'text'], 'selectable');
    expect(sql).toBe('SELECT * FROM SP_TEST(?, ?)');
    expect(params).toEqual([1, 'text']);
  });

  it('should uppercase the procedure name', () => {
    const { sql } = ProcedureBuilder.build('sp_lowercase');
    expect(sql).toContain('SP_LOWERCASE');
  });
});
