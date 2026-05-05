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
  /**
   * Se deve converter chaves para minúsculo no retorno do driver.
   *
   * @remarks
   * **Firebird quirk:** Não recomendado pelo ORM, pois o mapeamento automático de entidades
   * espera que as chaves retornadas pelo driver estejam em MAIÚSCULO.
   */
  lowercase_keys?: boolean;
}

/**
 * Opções para busca de registros no repositório.
 *
 * @template T - Tipo da entidade.
 *
 * @example
 * ```typescript
 * const options: FindOptions<User> = {
 *   where: { active: true },
 *   take: 10,
 *   skip: 20,
 *   orderBy: { name: 'ASC' },
 *   select: ['id', 'name']
 * };
 * ```
 */
export interface FindOptions<T> {
  /** Filtros da busca baseados nas propriedades da entidade. */
  where?: Partial<T>;
  /** Ordenação dos resultados por propriedade. */
  orderBy?: {
    [K in keyof T]?: 'ASC' | 'DESC';
  };
  /**
   * Quantidade de registros a retornar (limite).
   *
   * @remarks
   * **Firebird quirk:** No Firebird, isso é convertido para a cláusula `FIRST`.
   */
  take?: number;
  /**
   * Quantidade de registros a pular (offset).
   *
   * @remarks
   * **Firebird quirk:** No Firebird, isso é convertido para a cláusula `SKIP`.
   */
  skip?: number;
  /** Lista de propriedades da entidade que devem ser selecionadas. */
  select?: (keyof T)[];
}

/**
 * Metadados de uma coluna da entidade mapeada.
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
  /** Nome da propriedade na classe TypeScript. */
  propertyKey: string | symbol;
  /** Nome da coluna no banco de dados (armazenado em MAIÚSCULO). */
  columnName: string;
  /** Indica se a coluna permite valores NULL. */
  nullable?: boolean;
  /** Indica se a coluna faz parte da chave primária. */
  primary?: boolean;
  /** Indica se o valor da coluna é gerado automaticamente (ex: via Sequence). */
  generated?: boolean;
  /** Nome da sequence usada para gerar o ID (relevante apenas se `generated` for true). */
  sequenceName?: string;
}

/**
 * Erro base lançado pelo Firebird ORM.
 *
 * @example
 * ```typescript
 * throw new FirebirdOrmError('Conexão perdida com o banco');
 * ```
 */
export class FirebirdOrmError extends Error {
  /**
   * @param message - Mensagem detalhada do erro.
   */
  constructor(message: string) {
    super(`[firebird-orm] ${message}`);
    this.name = 'FirebirdOrmError';
  }
}

/**
 * Erro lançado quando uma operação espera encontrar uma entidade mas ela não existe.
 *
 * @example
 * ```typescript
 * throw new EntityNotFoundError('User', 123);
 * ```
 */
export class EntityNotFoundError extends FirebirdOrmError {
  /**
   * @param entityName - Nome da classe da entidade.
   * @param id - Identificador que foi buscado (opcional).
   */
  constructor(entityName: string, id?: string | number | unknown) {
    super(`Entidade "${entityName}"${id !== undefined ? ` com ID ${id}` : ''} não encontrada.`);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Erro lançado quando uma entidade é utilizada sem ter uma chave primária definida.
 *
 * @example
 * ```typescript
 * throw new NoPrimaryKeyError('User');
 * ```
 */
export class NoPrimaryKeyError extends FirebirdOrmError {
  /**
   * @param entityName - Nome da classe da entidade sem PK.
   */
  constructor(entityName: string) {
    super(`A entidade "${entityName}" não possui uma chave primária definida. Use @PrimaryColumn ou @PrimaryGeneratedColumn.`);
    this.name = 'NoPrimaryKeyError';
  }
}
