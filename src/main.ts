import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:9000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auto Task API Documentation')
    .setDescription('API de DTE (Documento Tributario Electrónico) y automatización de tareas.')
    .setVersion('2.0')
    .addServer('http://localhost:3001', 'Servidor local')
    .addServer('https://api.vreyes.dev', 'Servidor api.vreyes.dev')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Server is running on http://localhost:${port}`);
}

bootstrap();
