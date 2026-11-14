import 'reflect-metadata';
import { Logger, ValidationPipe, INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env';

/** Socket.io with the same CORS policy as the REST API. */
class SocketAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly origin: string) {
    super(app);
  }
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: this.origin, credentials: true } });
  }
}

async function bootstrap() {
  // rawBody: required to verify HMAC signatures on billing webhooks.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService<Env, true>);
  const origin = config.get('WEB_ORIGIN', { infer: true });

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  if (config.get('NODE_ENV', { infer: true }) === 'production') app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useWebSocketAdapter(new SocketAdapter(app, origin));
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`HRonE API listening on :${port} (CORS origin ${origin})`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
