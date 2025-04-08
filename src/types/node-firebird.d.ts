declare module 'node-firebird' {
  export interface Options {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    role?: string;
    pageSize?: number;
    lowercase_keys?: boolean;
  }

  export interface Database {
    query(sql: string, params: any[], callback: (err: Error | null, result?: any[]) => void): void;
    execute(sql: string, params: any[], callback: (err: Error | null, result?: any) => void): void;
    detach(callback?: (err: Error | null) => void): void;
  }

  export interface Pool {
    get(callback: (err: Error | null, db?: Database) => void): void;
    destroy(callback: (err: Error | null) => void): void;
  }

  export function attach(options: Options, callback: (err: Error | null, db?: Database) => void): void;
  export function pool(size: number, options: Options): Pool;
} 