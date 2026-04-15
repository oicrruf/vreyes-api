import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { GOOGLE_AUTH_SERVICE } from './domain/ports/google-auth.port';
import { PrismaUserAdapter } from './infrastructure/adapters/prisma-user.adapter';
import { GoogleAuthAdapter } from './infrastructure/adapters/google-auth.adapter';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LoginWithGoogleHandler } from './application/commands/login-with-google/login-with-google.handler';
import { AuthController } from './infrastructure/http/auth.controller';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserAdapter,
    },
    {
      provide: GOOGLE_AUTH_SERVICE,
      useClass: GoogleAuthAdapter,
    },
    JwtStrategy,
    LoginWithGoogleHandler,
  ],
  exports: [USER_REPOSITORY],
})
export class AuthModule {}
