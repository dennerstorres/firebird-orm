import { EntityNotFoundError, NoPrimaryKeyError, FirebirdOrmError } from '../types';
import { getTableName } from '../decorators';

describe('Actionable Error Messages', () => {
  it('EntityNotFoundError should suggest checking database and mapping', () => {
    const error = new EntityNotFoundError('User', 123);
    expect(error.message).toContain('Entidade "User" com ID 123 não encontrada.');
    expect(error.message).toContain('Verifique se o registro existe no banco de dados');
    expect(error.message).toContain('colunas estão mapeadas corretamente');
  });

  it('NoPrimaryKeyError should include a code example', () => {
    const error = new NoPrimaryKeyError('User');
    expect(error.message).toContain('A entidade "User" não possui uma chave primária definida.');
    expect(error.message).toContain('@PrimaryColumn ou @PrimaryGeneratedColumn');
    expect(error.message).toContain('Exemplo:');
    expect(error.message).toContain('@PrimaryGeneratedColumn()');
    expect(error.message).toContain('id: number;');
  });

  it('getTableName should throw FirebirdOrmError with @Entity code example', () => {
    class NotAnEntity {}
    try {
      getTableName(NotAnEntity);
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(error).toBeInstanceOf(FirebirdOrmError);
      expect(error.message).toContain('A classe "NotAnEntity" não é uma entidade válida.');
      expect(error.message).toContain('Adicione o decorator @Entity(\'NOME_DA_TABELA\')');
      expect(error.message).toContain('Exemplo:');
      expect(error.message).toContain('@Entity(\'NOTANENTITY\')');
      expect(error.message).toContain('class NotAnEntity { ... }');
    }
  });
});
