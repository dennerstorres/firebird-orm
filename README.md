# Firebird ORM

ORM simples e tipado para Firebird com TypeScript.

## Instalação

```bash
npm install firebird-orm
```

## Uso Básico

### 1. Definir uma Entidade

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'firebird-orm';

@Entity('usuarios')
class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nome: string;

  @Column()
  email: string;
}
```

### 2. Conectar ao Banco

```typescript
import { createConnection } from 'firebird-orm';

const connection = await createConnection({
  host: 'localhost',
  database: '/path/to/database.fdb',
  user: 'SYSDBA',
  password: 'masterkey'
});
```

### 3. Usar o Repositório

```typescript
const repository = connection.getRepository(Usuario);

// Criar
const usuario = new Usuario();
usuario.nome = "João";
usuario.email = "joao@email.com";
await repository.save(usuario);

// Buscar
const usuarios = await repository.find();
const usuario = await repository.findOne(1);

// Atualizar
await repository.update(1, { nome: "João Silva" });

// Deletar
await repository.delete(1);
```

## Recursos

- ✅ TypeScript completo
- ✅ Decorators para entidades
- ✅ Operações CRUD simples
- ✅ Conexão automática
- ✅ Suporte a transações

## Licença

MIT 