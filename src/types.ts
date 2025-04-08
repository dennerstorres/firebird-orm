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

export interface QueryBuilder<T> {
  where(condition: Partial<T>): QueryBuilder<T>;
  orderBy(property: keyof T, direction?: 'ASC' | 'DESC'): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  getQuery(): string;
  getParameters(): any[];
} 