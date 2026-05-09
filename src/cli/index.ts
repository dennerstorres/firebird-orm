import * as fs from 'fs';
import * as path from 'path';
import { createConnection } from '../connection';
import { MigrationManager } from './migration-manager';

async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    const config = loadConfig();
    const migrationOptions = {
      migrationsDir: config.migrationsDir || path.join(process.cwd(), 'src/migrations'),
      migrationsTable: config.migrationsTable
    };
    const manager = new MigrationManager(migrationOptions);

    switch (command) {
      case 'migration:generate':
        let name = 'Migration';
        const nameIdx = args.findIndex(a => a === '-n' || a === '--name');
        if (nameIdx !== -1 && args[nameIdx + 1]) {
          name = args[nameIdx + 1];
        }
        const filePath = await manager.generate(name);
        console.log(`Migration gerada em: ${filePath}`);
        break;

      case 'migration:run':
        const runConn = await createConnection(config);
        const executed = await manager.run(runConn);
        if (executed.length === 0) {
          console.log('Nenhuma migration pendente.');
        } else {
          console.log('Migrations executadas com sucesso:');
          executed.forEach(m => console.log(` - ${m}`));
        }
        await runConn.close();
        break;

      case 'migration:revert':
        const revertConn = await createConnection(config);
        const reverted = await manager.revert(revertConn);
        if (reverted) {
          console.log(`Migration revertida com sucesso: ${reverted}`);
        } else {
          console.log('Nenhuma migration para reverter.');
        }
        await revertConn.close();
        break;

      default:
        console.error(`Comando desconhecido: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Erro ao executar comando:');
    console.error(error);
    process.exit(1);
  }
}

function loadConfig() {
  const configPaths = [
    path.join(process.cwd(), 'firebird-orm.config.js'),
    path.join(process.cwd(), 'firebird-orm.config.json'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      if (configPath.endsWith('.js')) {
        return require(configPath);
      } else {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    }
  }

  throw new Error('Arquivo de configuração firebird-orm.config.js ou .json não encontrado.');
}

function showHelp() {
  console.log(`
Uso: firebird-orm <comando> [opções]

Comandos:
  migration:generate -n <nome>  Gera um novo arquivo de migration
  migration:run                 Executa todas as migrations pendentes
  migration:revert              Reverte a última migration executada

Opções:
  -n, --name <nome>             Nome da migration (para gerar)
  --help                        Mostra esta mensagem de ajuda
`);
}

runCli();
