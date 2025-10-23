import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // Enable CORS for health endpoints
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`FOMObot is running on port ${port}`);
}
bootstrap();
