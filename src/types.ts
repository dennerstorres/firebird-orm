export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'blob';

export interface EntityMetadata {
  name: string;
  target: Function;
}

export interface ColumnMetadata {
  name: string;
  propertyKey: string | symbol;
  type?: ColumnType;
  nullable?: boolean;
  length?: number;
  isPrimary?: boolean;
  isGenerated?: boolean;
}

export interface FindOptions<T> {
  where?: Partial<T>;
  orderBy?: {
    [K in keyof T]?: 'ASC' | 'DESC';
  };
  limit?: number;
  offset?: number;
}

export interface QueryBuilder<T> {
  where(condition: Partial<T>): QueryBuilder<T>;
  orderBy(property: keyof T, direction?: 'ASC' | 'DESC'): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  getQuery(): string;
  getParameters(): any[];
} 