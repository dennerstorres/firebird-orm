import { FirebirdOrmError, EntityNotFoundError, NoPrimaryKeyError } from '../types';

describe('Types and Errors', () => {
  it('FirebirdOrmError should have correct prefix', () => {
    const error = new FirebirdOrmError('Some error');
    expect(error.message).toBe('[firebird-orm] Some error');
    expect(error.name).toBe('FirebirdOrmError');
  });

  it('EntityNotFoundError should have correct message', () => {
    const error = new EntityNotFoundError('User', 1);
    expect(error.message).toBe('[firebird-orm] Entidade "User" com ID 1 não encontrada.');
    expect(error.name).toBe('EntityNotFoundError');
    expect(error).toBeInstanceOf(FirebirdOrmError);
  });

  it('NoPrimaryKeyError should have correct message', () => {
    const error = new NoPrimaryKeyError('User');
    expect(error.message).toBe('[firebird-orm] A entidade "User" não possui uma chave primária definida. Use @PrimaryColumn ou @PrimaryGeneratedColumn.');
    expect(error.name).toBe('NoPrimaryKeyError');
    expect(error).toBeInstanceOf(FirebirdOrmError);
  });
});
