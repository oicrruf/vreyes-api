import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { USER_REPOSITORY } from './domain/ports/user-repository.port';
import { GOOGLE_AUTH_SERVICE } from './domain/ports/google-auth.port';
import { PrismaUserAdapter } from './infrastructure/adapters/prisma-user.adapter';
import { GoogleAuthAdapter } from './infrastructure/adapters/google-auth.adapter';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LoginWithGoogleHandler } from './application/commands/login-with-google/login-with-google.handler';
import { LinkUserTaxpayerHandler } from './application/commands/link-user-taxpayer/link-user-taxpayer.handler';
import { AuthController } from './infrastructure/http/auth.controller';
import { UsersController } from './infrastructure/http/users.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { TaxpayerModule } from '../taxpayer/taxpayer.module';

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    TaxpayerModule,
  ],
  controllers: [AuthController, UsersController],
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
    LinkUserTaxpayerHandler,
  ],
  exports: [USER_REPOSITORY, PassportModule, JwtStrategy],
})
export class AuthModule {}
