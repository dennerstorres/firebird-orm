import 'reflect-metadata';

export const ENTITY_METADATA_KEY = Symbol('entity');
export const COLUMN_METADATA_KEY = Symbol('column');
export const PRIMARY_COLUMN_METADATA_KEY = Symbol('primary');

export interface EntityOptions {
  name?: string;
}

export interface ColumnOptions {
  name?: string;
  type?: string;
  nullable?: boolean;
  length?: number;
}

export function Entity(options: EntityOptions = {}): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(ENTITY_METADATA_KEY, {
      name: options.name || target.name.toLowerCase(),
      target
    }, target);
  };
}

export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns = Reflect.getMetadata(COLUMN_METADATA_KEY, target.constructor) || [];
    columns.push({
      name: options.name || propertyKey,
      propertyKey,
      type: options.type,
      nullable: options.nullable,
      length: options.length
    });
    Reflect.defineMetadata(COLUMN_METADATA_KEY, columns, target.constructor);
  };
}

export function PrimaryGeneratedColumn(): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const columns = Reflect.getMetadata(PRIMARY_COLUMN_METADATA_KEY, target.constructor) || [];
    columns.push({
      name: propertyKey,
      propertyKey,
      type: 'number',
      isPrimary: true,
      isGenerated: true
    });
    Reflect.defineMetadata(PRIMARY_COLUMN_METADATA_KEY, columns, target.constructor);
  };
} 