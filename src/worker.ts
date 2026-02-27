/**
 * Standalone worker process entry point.
 * Boots only the queue workers (no HTTP server) for independent scaling.
 *
 * Usage: node dist/worker.js
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create the app context without listening on a port.
  // All @Processor-decorated workers will auto-connect to their queues.
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('🔧 AI Job Fetcher worker process running');
  // Keep alive
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}
bootstrap();
