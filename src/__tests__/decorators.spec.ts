import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn, getTableName, getColumnMetadata, getPrimaryColumn } from '../decorators';
import { NoPrimaryKeyError } from '../types';

describe('Decorators', () => {
  @Entity('users')
  class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'user_name' })
    name!: string;

    @Column()
    email!: string;
  }

  @Entity('products')
  class Product {
    @PrimaryColumn({ name: 'sku_code' })
    sku!: string;

    @PrimaryGeneratedColumn({ sequenceName: 'custom_seq' })
    id!: number;
  }

  class NotAnEntity {}

  describe('@Entity', () => {
    it('should store and return table name in uppercase', () => {
      expect(getTableName(User)).toBe('USERS');
      expect(getTableName(Product)).toBe('PRODUCTS');
    });

    it('should throw error if class is not an entity', () => {
      expect(() => getTableName(NotAnEntity)).toThrow(/A classe "NotAnEntity" não é uma entidade válida/);
    });
  });

  describe('@Column', () => {
    it('should store column metadata with uppercase name', () => {
      const metadata = getColumnMetadata(User);
      const nameCol = metadata.find(m => m.propertyKey === 'name');
      const emailCol = metadata.find(m => m.propertyKey === 'email');

      expect(nameCol?.columnName).toBe('USER_NAME');
      expect(emailCol?.columnName).toBe('EMAIL');
    });
  });

  describe('@PrimaryGeneratedColumn', () => {
    it('should store generated primary key metadata', () => {
      const metadata = getColumnMetadata(User);
      const idCol = metadata.find(m => m.propertyKey === 'id');

      expect(idCol?.primary).toBe(true);
      expect(idCol?.generated).toBe(true);
      expect(idCol?.columnName).toBe('ID');
    });

    it('should generate default sequence name', () => {
      const metadata = getColumnMetadata(User);
      const idCol = metadata.find(m => m.propertyKey === 'id');
      expect(idCol?.sequenceName).toBe('GEN_USERS_ID');
    });

    it('should use custom sequence name in uppercase', () => {
      const metadata = getColumnMetadata(Product);
      const idCol = metadata.find(m => m.propertyKey === 'id');
      expect(idCol?.sequenceName).toBe('CUSTOM_SEQ');
    });
  });

  describe('@PrimaryColumn', () => {
    it('should store manual primary key metadata', () => {
      const metadata = getColumnMetadata(Product);
      const skuCol = metadata.find(m => m.propertyKey === 'sku');

      expect(skuCol?.primary).toBe(true);
      expect(skuCol?.generated).toBe(false);
      expect(skuCol?.columnName).toBe('SKU_CODE');
    });
  });

  describe('Helpers', () => {
    it('getPrimaryColumn should return the primary column metadata', () => {
      const pk = getPrimaryColumn(User);
      expect(pk.propertyKey).toBe('id');
    });

    it('getPrimaryColumn should throw NoPrimaryKeyError if no PK defined', () => {
      @Entity('test')
      class NoPk {}
      expect(() => getPrimaryColumn(NoPk)).toThrow(NoPrimaryKeyError);
    });
  });
});
