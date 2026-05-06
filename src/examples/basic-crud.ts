import { Entity, Column, PrimaryGeneratedColumn, createConnection } from '../index';

/**
 * Exemplo de definição de entidade Produto.
 * No Firebird, nomes de tabelas e colunas são convertidos para UPPERCASE.
 *
 * @example
 * ```typescript
 * @Entity('PRODUTOS')
 * class Produto {
 *   @PrimaryGeneratedColumn()
 *   id!: number;
 * }
 * ```
 */
@Entity('PRODUTOS')
export class Produto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'NOME_PRODUTO' })
  nome!: string;

  @Column()
  preco!: number;

  @Column({ nullable: true })
  descricao?: string;
}

/**
 * Demonstração básica de CRUD (Create, Read, Update, Delete).
 *
 * @example
 * ```typescript
 * await runBasicCrudExample();
 * ```
 */
export async function runBasicCrudExample() {
  // 1. Criar conexão
  const connection = await createConnection({
    host: 'localhost',
    port: 3050,
    database: '/caminho/para/banco.fdb',
    user: 'SYSDBA',
    password: 'masterkey'
  });

  // 2. Obter repositório
  const repo = await connection.getRepository(Produto);

  // 3. CREATE (Insert)
  // Firebird quirk: IDs gerados usam sequences (generators).
  // O ORM busca o próximo ID via SELECT NEXT VALUE FOR GEN_PRODUTOS_ID FROM RDB$DATABASE
  const novoProduto = await repo.save({
    nome: 'Teclado Mecânico',
    preco: 250.00,
    descricao: 'Switch Blue'
  });
  console.log('Produto criado com ID:', novoProduto.id);

  // 4. READ (Find)
  const produtos = await repo.find({
    where: { nome: 'Teclado Mecânico' }
  });
  console.log('Produtos encontrados:', produtos.length);

  // 5. UPDATE
  // Se o objeto possuir a chave primária, o save() realiza um UPDATE.
  novoProduto.preco = 230.00;
  await repo.save(novoProduto);

  // 6. DELETE
  await repo.delete(novoProduto.id);

  // 7. Fechar conexão
  await connection.close();
}
