import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { extname } from 'path';

// .env 파일 로드 (로컬 개발용)
config();

export const getTypeOrmPaths = (runtimeExtension: '.ts' | '.js') => {
  const root = runtimeExtension === '.ts' ? 'src' : 'dist';

  return {
    entities: [
      `${root}/entities/*.entity${runtimeExtension}`,
      `${root}/tenders/entities/*.entity${runtimeExtension}`,
    ],
    migrations: [`${root}/migrations/*${runtimeExtension}`],
  };
};

const runtimeExtension = extname(__filename) === '.js' ? '.js' : '.ts';
const typeOrmPaths = getTypeOrmPaths(runtimeExtension);

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432'),
  username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'dfkorea',
  entities: typeOrmPaths.entities,
  migrations: typeOrmPaths.migrations,
  synchronize: false,
  logging: true,
});
