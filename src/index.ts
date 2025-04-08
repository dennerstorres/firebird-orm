export * from './decorators';
export * from './connection';
export * from './repository';
export * from './types';

export interface ConnectionOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  role?: string;
  pageSize?: number;
  lowercase_keys?: boolean;
} 