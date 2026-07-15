import 'reflect-metadata';
import { ColumnMetadata, NoPrimaryKeyError, FirebirdOrmError } from './types';

/** @internal */
export const ENTITY_METADATA_KEY = Symbol('entity');
/** @internal */
export const COLUMN_METADATA_KEY = Symbol('column');

/**
 * Opções de configuração para uma coluna de entidade.
 */
export interface ColumnOptions {
  /**
   * Nome da coluna no banco de dados.
   * Se omitido, utiliza o nome da propriedade da classe convertido para MAIÚSCULO.
   */
  name?: string;
  /**
   * Define se a coluna permite valores nulos (NULL).
   */
  nullable?: boolean;
  /**
   * Tipo da coluna para fins de coerção na leitura (mapeamento para o tipo TS).
   * Útil para SMALLINT (0/1) que o Firebird devolve como number mas a entidade
   * declara como boolean.
   */
  type?: 'boolean' | 'string' | 'number' | 'bigint' | 'Date' | 'Buffer';
}

/**
 * Opções de configuração para uma coluna de chave primária com geração automática.
 */
export interface PrimaryGeneratedColumnOptions {
  /**
   * Nome da coluna no banco de dados.
   * Se omitido, utiliza o nome da propriedade da classe convertido para MAIÚSCULO.
   */
  name?: string;
  /**
   * Nome da sequence do Firebird usada para gerar o valor da chave.
   * Se omitido, segue o padrão: `GEN_{TABELA}_{COLUNA}`.
   */
  sequenceName?: string;
}

/**
 * Decorator que marca uma classe como uma entidade persistível no Firebird.
 *
 * @param tableName - Nome da tabela no banco de dados. Será convertido para MAIÚSCULO.
 *
 * @example
 * ```typescript
 * @Entity('USUARIOS')
 * class Usuario {
 *   @PrimaryGeneratedColumn()
 *   id: number;
 * }
 * ```
 */
export function Entity(tableName: string): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(ENTITY_METADATA_KEY, tableName.toUpperCase(), target);
  };
}

/**
 * Decorator que marca uma propriedade da classe como uma coluna comum no banco de dados.
 *
 * @param options - Opções de configuração da coluna (opcional).
 *
 * @example
 * ```typescript
 * class Usuario {
 *   @Column({ name: 'NOME_COMPLETO', nullable: false })
 *   name: string;
 *
 *   @Column()
 *   email: string; // Vira a coluna 'EMAIL' no banco
 * }
 * ```
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns: ColumnMetadata[] = Reflect.getMetadata(COLUMN_METADATA_KEY, target.constructor) || [];

    columns.push({
      propertyKey,
      columnName: (options.name || propertyKey.toString()).toUpperCase(),
      nullable: options.nullable,
      type: options.type,
      primary: false,
      generated: false
    });

    Reflect.defineMetadata(COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

/**
 * Decorator para definir a chave primária da entidade com geração automática de valor via Sequence.
 *
 * @param options - Opções de configuração da chave primária e da sequence (opcional).
 *
 * @example
 * ```typescript
 * class Usuario {
 *   @PrimaryGeneratedColumn()
 *   id: number; // Sequence padrão: GEN_USUARIOS_ID
 *
 *   @PrimaryGeneratedColumn({ sequenceName: 'SEQ_USER_ID' })
 *   otherId: number;
 * }
 * ```
 *
 * @remarks
 * **Firebird quirk:** No Firebird, o valor é obtido via `GEN_ID(sequence, 1)` ou `NEXT VALUE FOR sequence`
 * antes da inserção, ou via `RETURNING` na cláusula `INSERT`.
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
 * Decorator para definir uma chave primária manual (onde o valor deve ser fornecido pela aplicação).
 *
 * @param options - Opções de configuração da coluna de chave primária (opcional).
 *
 * @example
 * ```typescript
 * class Configuracao {
 *   @PrimaryColumn({ name: 'CHAVE_CONFIG' })
 *   key: string;
 * }
 * ```
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
 * Helper para obter o nome da tabela registrado via `@Entity` em uma classe.
 *
 * @param target - Classe da entidade que possui o decorator `@Entity`.
 * @returns O nome da tabela em MAIÚSCULO.
 * @throws Erro se a classe não possuir o metadado de entidade.
 *
 * @example
 * ```typescript
 * const table = getTableName(Usuario); // Retorna 'USUARIOS'
 * ```
 */
export function getTableName(target: Function): string {
  const tableName = Reflect.getMetadata(ENTITY_METADATA_KEY, target);
  if (!tableName) {
    throw new FirebirdOrmError(
      `A classe "${target.name}" não é uma entidade válida.\n` +
      `Adicione o decorator @Entity('NOME_DA_TABELA') no topo da classe.\n\n` +
      `Exemplo:\n` +
      `  @Entity('${target.name.toUpperCase()}')\n` +
      `  class ${target.name} { ... }`
    );
  }
  return tableName;
}

/**
 * Helper para extrair todos os metadados de colunas definidos em uma classe de entidade.
 * Resolve automaticamente os nomes de sequences padrão para colunas geradas.
 *
 * @param target - Classe da entidade.
 * @returns Um array contendo os metadados de todas as colunas encontradas.
 *
 * @example
 * ```typescript
 * const columns = getColumnMetadata(Usuario);
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
 * Helper para obter o metadado da coluna que foi definida como chave primária na entidade.
 *
 * @param target - Classe da entidade.
 * @returns O metadado da coluna PK.
 * @throws NoPrimaryKeyError se nenhuma coluna for marcada como PK.
 *
 * @example
 * ```typescript
 * const pk = getPrimaryColumn(Usuario);
 * console.log(pk.columnName); // 'ID'
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
