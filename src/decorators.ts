import 'reflect-metadata';
import { ColumnMetadata, NoPrimaryKeyError } from './types';

/** @internal */
export const ENTITY_METADATA_KEY = Symbol('entity');
/** @internal */
export const COLUMN_METADATA_KEY = Symbol('column');

/**
 * Opções para a coluna.
 */
export interface ColumnOptions {
  /** Nome da coluna no banco de dados. Se omitido, usa o nome da propriedade em MAIÚSCULO. */
  name?: string;
  /** Se a coluna pode ser nula. */
  nullable?: boolean;
}

/**
 * Opções para coluna de chave primária gerada.
 */
export interface PrimaryGeneratedColumnOptions {
  /** Nome da coluna no banco de dados. Se omitido, usa o nome da propriedade em MAIÚSCULO. */
  name?: string;
  /** Nome da sequence. Se omitido, usa o padrão GEN_{TABELA}_{COLUNA}. */
  sequenceName?: string;
}

/**
 * Decorator que marca uma classe como uma entidade do Firebird.
 *
 * @param tableName - Nome da tabela no banco de dados.
 *
 * @example
 * ```typescript
 * @Entity('USUARIOS')
 * class Usuario {
 *   @PrimaryGeneratedColumn()
 *   id: number;
 * }
 * ```
 *
 * @remarks
 * **Firebird quirk:** Nomes de tabela sem aspas são convertidos para MAIÚSCULO internamente no Firebird.
 * O ORM armazena o nome da tabela sempre em MAIÚSCULO para garantir consistência.
 */
export function Entity(tableName: string): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(ENTITY_METADATA_KEY, tableName.toUpperCase(), target);
  };
}

/**
 * Decorator que marca uma propriedade como uma coluna comum.
 *
 * @param options - Opções de configuração da coluna.
 *
 * @example
 * ```typescript
 * @Column({ name: 'NOME_COMPLETO', nullable: false })
 * name: string;
 *
 * @Column()
 * email: string; // vira EMAIL no banco
 * ```
 *
 * @remarks
 * **Firebird quirk:** O nome da coluna é convertido para MAIÚSCULO ao ser enviado para o banco.
 * Se omitido, o nome da propriedade na classe é usado como nome da coluna em MAIÚSCULO.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target.constructor) || [];

    columns.push({
      propertyKey,
      columnName: (options.name || propertyKey.toString()).toUpperCase(),
      nullable: options.nullable,
      primary: false,
      generated: false
    });

    Reflect.defineMetadata(COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Decorator para chave primária com geração automática via Sequence.
 *
 * @param options - Opções de configuração da PK e Sequence.
 *
 * @example
 * ```typescript
 * @PrimaryGeneratedColumn()
 * id: number; // sequence padrão: GEN_TABELA_ID
 *
 * @PrimaryGeneratedColumn({ sequenceName: 'SEQ_USER_ID' })
 * id: number;
 * ```
 *
 * @remarks
 * **Firebird quirk:** O Firebird não possui AUTO_INCREMENT. É necessário usar Sequences e Triggers
 * ou buscar o próximo valor manualmente. Este ORM busca via `SELECT NEXT VALUE FOR`.
 */
export function PrimaryGeneratedColumn(options: PrimaryGeneratedColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target.constructor) || [];

    const columnName = (options.name || propertyKey.toString()).toUpperCase();

    columns.push({
      propertyKey,
      columnName,
      primary: true,
      generated: true,
      sequenceName: options.sequenceName?.toUpperCase()
    });

    Reflect.defineMetadata(COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Decorator para chave primária manual (sem sequence).
 *
 * @param options - Opções de configuração da coluna.
 *
 * @example
 * ```typescript
 * @PrimaryColumn({ name: 'COD_SISTEMA' })
 * code: string;
 * ```
 *
 * @remarks
 * **Firebird quirk:** O nome da coluna é convertido para MAIÚSCULO.
 */
export function PrimaryColumn(options: ColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target.constructor) || [];

    columns.push({
      propertyKey,
      columnName: (options.name || propertyKey.toString()).toUpperCase(),
      nullable: options.nullable,
      primary: true,
      generated: false
    });

    Reflect.defineMetadata(COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Helper para obter o nome da tabela registrado em uma entidade.
 *
 * @param target - Classe da entidade.
 * @returns O nome da tabela em MAIÚSCULO.
 * @throws Erro se a classe não tiver o decorator @Entity.
 *
 * @example
 * ```typescript
 * const table = getTableName(Usuario); // 'USUARIOS'
 * ```
 */
export function getTableName(target: Function): string {
  const tableName = Reflect.getMetadata(ENTITY_METADATA_KEY, target);
  if (!tableName) {
    throw new Error(`[firebird-orm] A classe ${target.name} não é uma entidade válida. Adicione @Entity('TABELA').`);
  }
  return tableName;
}

/**
 * Helper para obter todos os metadados de colunas de uma entidade.
 *
 * @param target - Classe da entidade.
 * @returns Array com os metadados de todas as colunas.
 *
 * @example
 * ```typescript
 * const meta = getColumnMetadata(Usuario);
 * ```
 */
export function getColumnMetadata(target: Function): ColumnMetadata[] {
  const tableName = getTableName(target);
  const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target) || [];

  // Resolve default sequence names for generated columns
  return columns.map(col => {
    if (col.generated && !col.sequenceName) {
      return {
        ...col,
        sequenceName: `GEN_${tableName}_${col.columnName}`.toUpperCase()
      };
    }
    return col;
  });
}

/**
 * Helper para obter o metadado da chave primária de uma entidade.
 *
 * @param target - Classe da entidade.
 * @returns Metadado da coluna PK.
 * @throws NoPrimaryKeyError se não houver coluna PK definida.
 *
 * @example
 * ```typescript
 * const pk = getPrimaryColumn(Usuario);
 * ```
 */
export function getPrimaryColumn(target: Function): ColumnMetadata {
  const columns = getColumnMetadata(target);
  const primary = columns.find(col => col.primary);

  if (!primary) {
    throw new NoPrimaryKeyError(target.name);
  }

  return primary;
}
