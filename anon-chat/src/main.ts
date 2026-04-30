import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './redis/redis.io-adapter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const redisService = app.get(RedisService);

  // Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors and filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS
  app.enableCors();

  // Socket.io Redis adapter for cross-instance fan-out
  app.useWebSocketAdapter(
    new RedisIoAdapter(
      app,
      redisService.getPubClient(),
      redisService.getSubClient(),
    ),
  );

  // ── Swagger / Scalar API Documentation ──────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Anonymous Chat API')
    .setDescription(
      'Real-time group chat service API. Users identify with a username only — no passwords, no registration. ' +
      'They can create or join rooms and exchange messages instantly.\n\n' +
      '**Auth:** All routes except `/api/v1/login` require a Bearer session token in the `Authorization` header.\n\n' +
      '**Response envelope:** Every response is wrapped in `{ success, data }` (success) or `{ success, error: { code, message } }` (error).\n\n' +
      '**WebSocket:** Connect to the `/chat` namespace with query params `token` and `roomId` for real-time events.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Hex Token',
        description: 'Session token obtained from POST /api/v1/login. Expires after 24 hours.',
      },
      'bearer',
    )
    .addTag('Authentication', 'Login / session management (no registration required)')
    .addTag('Rooms', 'Create, list, get, and delete chat rooms')
    .addTag('Messages', 'Send messages and retrieve paginated message history')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Serve the raw OpenAPI JSON at /api-json
  SwaggerModule.setup('api-docs', app, document, {
    jsonDocumentUrl: '/api-json',
  });

  // Scalar interactive API reference at /reference
  app.use(
    '/reference',
    apiReference({
      spec: {
        content: document,
      },
      theme: 'kepler',
      layout: 'modern',
      defaultHttpClient: {
        targetKey: 'javascript',
        clientKey: 'fetch',
      },
      metaData: {
        title: 'Anonymous Chat API — Reference',
        description: 'Interactive API documentation for the Anonymous Chat service',
      },
    }),
  );

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📖 API Docs (Scalar): http://localhost:${port}/reference`);
    console.log(`📋 OpenAPI JSON: http://localhost:${port}/api-json`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
