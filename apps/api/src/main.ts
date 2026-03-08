import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import multipart from '@fastify/multipart'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  // Register multipart for file uploads
  await app.register(multipart as any, {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  })

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
  })

  const port = process.env.PORT || 3001
  await app.listen(port, '0.0.0.0')
  console.log(`API running on http://0.0.0.0:${port}`)
}

bootstrap()
