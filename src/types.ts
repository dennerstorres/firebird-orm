/**
 * Opções de conexão com o banco de dados Firebird.
 *
 * @example
 * ```typescript
 * const options: FirebirdConnectionOptions = {
 *   host: 'localhost',
 *   port: 3050,
 *   database: '/path/to/db.fdb',
 *   user: 'SYSDBA',
 *   password: 'masterkey',
 *   charset: 'UTF8'
 * };
 * ```
 */
export interface FirebirdConnectionOptions {
  /** Endereço do servidor (ex: localhost) */
  host: string;
  /** Porta do servidor (padrão Firebird é 3050) */
  port: number;
  /** Caminho para o arquivo do banco de dados ou alias */
  database: string;
  /** Usuário do banco de dados */
  user: string;
  /** Senha do usuário */
  password: string;
  /** Charset da conexão (ex: UTF8, WIN1252) */
  charset?: string;
  /** Tamanho do pool de conexões */
  poolSize?: number;
  /** Role do banco de dados */
  role?: string;
  /** Tamanho da página */
  pageSize?: number;
  /** Se deve converter chaves para minúsculo no retorno do driver (não recomendado pelo ORM) */
  lowercase_keys?: boolean;
}

/**
 * Opções para busca de registros.
 *
 * @example
 * ```typescript
 * const options: FindOptions<User> = {
 *   where: { active: true },
 *   take: 10,
 *   skip: 20,
 *   orderBy: { name: 'ASC' }
 * };
 * ```
 */
export interface FindOptions<T> {
  /** Filtros da busca */
  where?: Partial<T>;
  /** Ordenação dos resultados */
  orderBy?: {
    [K in keyof T]?: 'ASC' | 'DESC';
  };
  /**
   * Quantidade de registros a retornar.
   *
   * @remarks
   * **Firebird quirk:** No Firebird, isso é convertido para a cláusula `FIRST`.
   */
  take?: number;
  /**
   * Quantidade de registros a pular.
   *
   * @remarks
   * **Firebird quirk:** No Firebird, isso é convertido para a cláusula `SKIP`.
   */
  skip?: number;
  /** Colunas a serem selecionadas */
  select?: (keyof T)[];
}

/**
 * Metadados de uma coluna da entidade.
 *
 * @example
 * ```typescript
 * const metadata: ColumnMetadata = {
 *   propertyKey: 'id',
 *   columnName: 'ID',
 *   primary: true,
 *   generated: true,
 *   sequenceName: 'GEN_USER_ID'
 * };
 * ```
 */
export interface ColumnMetadata {
  /** Nome da propriedade na classe TypeScript */
  propertyKey: string | symbol;
  /** Nome da coluna no banco de dados (será convertido para MAIÚSCULO) */
  columnName: string;
  /** Indica se a coluna pode ser nula */
  nullable?: boolean;
  /** Indica se é chave primária */
  primary?: boolean;
  /** Indica se o valor é gerado automaticamente */
  generated?: boolean;
  /** Nome da sequence usada para gerar o ID (se aplicável) */
  sequenceName?: string;
}

/**
 * Erro base do ORM.
 *
 * @example
 * ```typescript
 * throw new FirebirdOrmError('Algo deu errado');
 * ```
 */
export class FirebirdOrmError extends Error {
  constructor(message: string) {
    super(`[firebird-orm] ${message}`);
    this.name = 'FirebirdOrmError';
  }
}

/**
 * Erro lançado quando uma entidade não é encontrada.
 *
 * @example
 * ```typescript
 * throw new EntityNotFoundError('User', 1);
 * ```
 */
export class EntityNotFoundError extends FirebirdOrmError {
  constructor(entityName: string, id?: string | number | unknown) {
    super(`Entidade "${entityName}"${id !== undefined ? ` com ID ${id}` : ''} não encontrada.`);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Erro lançado quando uma entidade não possui chave primária definida.
 *
 * @example
 * ```typescript
 * throw new NoPrimaryKeyError('User');
 * ```
 */
export class NoPrimaryKeyError extends FirebirdOrmError {
  constructor(entityName: string) {
    super(`A entidade "${entityName}" não possui uma chave primária definida. Use @PrimaryColumn ou @PrimaryGeneratedColumn.`);
    this.name = 'NoPrimaryKeyError';
  }
}
