import 'reflect-metadata';
import { ColumnMetadata, NoPrimaryKeyError } from './types';

export const ENTITY_METADATA_KEY = Symbol('entity');
export const COLUMN_METADATA_KEY = Symbol('column');
export const PRIMARY_COLUMN_METADATA_KEY = Symbol('primary');

/**
 * Opções para a entidade.
 */
export interface EntityOptions {
  /** Nome da tabela no banco de dados. Se omitido, usa o nome da classe em minúsculo. */
  name?: string;
}

/**
 * Opções para a coluna.
 */
export interface ColumnOptions {
  /** Nome da coluna no banco de dados. Se omitido, usa o nome da propriedade. */
  name?: string;
  /** Tipo da coluna. */
  type?: string;
  /** Se a coluna pode ser nula. */
  nullable?: boolean;
  /** Tamanho da coluna. */
  length?: number;
}

/**
 * Decorator que marca uma classe como uma entidade.
 *
 * @example
 * ```typescript
 * @Entity({ name: 'USERS' })
 * class User {}
 * ```
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(ENTITY_METADATA_KEY, {
      name: options.name || target.name.toLowerCase(),
      target
    }, target);
  };
}

/**
 * Decorator que marca uma propriedade como uma coluna.
 *
 * @example
 * ```typescript
 * @Column({ name: 'USER_NAME', length: 100 })
 * name: string;
 * ```
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target.constructor) || [];
    columns.push({
      columnName: options.name || propertyKey.toString(),
      propertyKey,
      nullable: options.nullable
    });
    Reflect.defineMetadata(COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Decorator que marca uma propriedade como chave primária gerada automaticamente.
 *
 * @example
 * ```typescript
 * @PrimaryGeneratedColumn()
 * id: number;
 * ```
 */
export function PrimaryGeneratedColumn(): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, target.constructor) || [];
    columns.push({
      columnName: propertyKey.toString(),
      propertyKey,
      primary: true,
      generated: true
    });
    Reflect.defineMetadata(PRIMARY_COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Decorator que marca uma propriedade como chave primária manual.
 *
 * @example
 * ```typescript
 * @PrimaryColumn()
 * code: string;
 * ```
 */
export function PrimaryColumn(options: ColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, target.constructor) || [];
    columns.push({
      columnName: options.name || propertyKey.toString(),
      propertyKey,
      primary: true,
      generated: false
    });
    Reflect.defineMetadata(PRIMARY_COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Helper para obter o nome da tabela de uma entidade.
 *
 * @example
 * ```typescript
 * const tableName = getTableName(User);
 * ```
 */
export function getTableName(target: Function): string {
  const metadata = Reflect.getMetadata(ENTITY_METADATA_KEY, target);
  if (!metadata) {
    throw new Error(`A classe ${target.name} não é uma entidade válida. Adicione @Entity.`);
  }
  return metadata.name.toUpperCase();
}

/**
 * Helper para obter os metadados de coluna de uma entidade.
 *
 * @example
 * ```typescript
 * const columns = getColumnMetadata(User);
 * ```
 */
export function getColumnMetadata(target: Function): ColumnMetadata[] {
  const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target) || [];
  const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, target) || [];
  return [...columns, ...primaryColumns];
}

/**
 * Helper para obter a chave primária de uma entidade.
 *
 * @example
 * ```typescript
 * const pk = getPrimaryColumn(User);
 * ```
 */
export function getPrimaryColumn(target: Function): ColumnMetadata {
  const primaryColumns: ColumnMetadata[] = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, target) || [];
  if (!primaryColumns.length) {
    throw new NoPrimaryKeyError(target.name);
  }
  return primaryColumns[0];
}
