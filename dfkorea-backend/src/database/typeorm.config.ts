import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// .env 파일 로드 (로컬 개발용)
config();

// Railway 환경에서는 process.env에서 직접 읽기
const isProduction = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432'),
  username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'dfkorea',
  entities: ['src/entities/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
