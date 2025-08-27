import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

const config = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'vulnerability_scanner',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  retryAttempts: 10,
  retryDelay: 3000,
  autoLoadEntities: true,
  keepConnectionAlive: true,
} as TypeOrmModuleOptions & DataSourceOptions;

export default registerAs('database', () => config);

export const databaseConfig = registerAs('database', () => config);

// Export datasource for TypeORM CLI
export const AppDataSource = new DataSource(config);
