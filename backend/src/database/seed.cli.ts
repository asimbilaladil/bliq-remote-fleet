import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { seed } from './seed';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const connection = app.get<Connection>(getConnectionToken());

  await seed(connection);
  Logger.log('Seed complete: 3 remote operators, 6 vehicles.', 'Seed');

  await app.close();
}

run().catch((err) => {
  Logger.error('Seed failed', err instanceof Error ? err.stack : String(err), 'Seed');
  process.exit(1);
});
