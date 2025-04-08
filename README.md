# FireORM

Um ORM (Object-Relational Mapping) elegante e tipado para Firebird, desenvolvido em TypeScript.

## Características

- Totalmente tipado com TypeScript
- Suporte a decorators para mapeamento de entidades
- Conexão simplificada com banco de dados Firebird
- Operações CRUD facilitadas
- Suporte a relacionamentos
- Query builder intuitivo
- Pool de conexões automático
- Suporte a transações

## Instalação

```bash
npm install fireorm
```

## Requisitos

- Node.js 14 ou superior
- TypeScript 4.5 ou superior
- Banco de dados Firebird 2.5 ou superior

## Uso Básico

### Definindo uma Entidade

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'fireorm';

@Entity('usuarios')
class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nome_completo' })
  nome: string;

  @Column({ name: 'endereco_email' })
  email: string;

  @Column({ name: 'data_criacao', type: 'date' })
  dataCriacao: Date;
}
```

### Conectando ao Banco de Dados

```typescript
import { createConnection } from 'fireorm';

const connection = await createConnection({
  host: 'localhost',
  port: 3050,
  database: '/path/to/database.fdb',
  user: 'SYSDBA',
  password: 'masterkey',
  role: 'RDB$ADMIN',
  pageSize: 4096
});
```

### Operações CRUD

```typescript
// Obtendo um repositório
const usuarioRepository = connection.getRepository(Usuario);

// Criando um novo usuário
const novoUsuario = new Usuario();
novoUsuario.nome = "João Silva";
novoUsuario.email = "joao@exemplo.com";
novoUsuario.dataCriacao = new Date();
const usuarioSalvo = await usuarioRepository.save(novoUsuario);

// Buscando um usuário
const usuario = await usuarioRepository.findOne(1);
console.log(usuario.nome); // "João Silva"

// Buscando todos os usuários
const usuarios = await usuarioRepository.find();
console.log(usuarios.length); // Número total de usuários

// Atualizando um usuário
usuario.nome = "João da Silva";
const usuarioAtualizado = await usuarioRepository.update(usuario.id, usuario);

// Deletando um usuário
await usuarioRepository.delete(usuario.id);
```

## Opções de Coluna

O decorator `@Column` aceita as seguintes opções:

```typescript
@Column({
  name: 'nome_da_coluna',      // Nome da coluna no banco
  type: 'string',              // Tipo da coluna (string, number, boolean, date, blob)
  nullable: true,              // Se a coluna pode ser nula
  length: 255,                 // Tamanho máximo para strings
  default: 'valor_padrao'      // Valor padrão
})
```

## Transações

```typescript
await connection.transaction(async (transaction) => {
  const usuarioRepository = transaction.getRepository(Usuario);
  
  const usuario = new Usuario();
  usuario.nome = "João Silva";
  await usuarioRepository.save(usuario);
  
  // Se algo der errado, a transação será revertida automaticamente
});
```

## Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

MIT

## Suporte

Se encontrar algum problema ou tiver sugestões, por favor abra uma issue no GitHub. 