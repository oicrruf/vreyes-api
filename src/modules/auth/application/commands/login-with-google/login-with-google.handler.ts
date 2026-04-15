import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginWithGoogleCommand } from './login-with-google.command';
import { GOOGLE_AUTH_SERVICE, GoogleAuthService } from '../../../domain/ports/google-auth.port';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user-repository.port';
import { User } from '../../../domain/entities/user.entity';

@CommandHandler(LoginWithGoogleCommand)
export class LoginWithGoogleHandler implements ICommandHandler<LoginWithGoogleCommand> {
  constructor(
    @Inject(GOOGLE_AUTH_SERVICE) private readonly googleAuth: GoogleAuthService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: LoginWithGoogleCommand) {
    const googleUser = await this.googleAuth.verifyToken(command.token);

    // 1. buscar usuario por identidad de google
    let user = await this.userRepository.findByIdentity('google', googleUser.sub);

    if (!user) {
      // 2. si no existe por identidad, buscar por email (por si ya existe como 'local')
      user = await this.userRepository.findByEmail(googleUser.email);

      if (!user) {
        // 3. si no existe, crear nuevo usuario
        user = await this.userRepository.save(
          new User('', googleUser.email, googleUser.name, googleUser.picture),
        );
      }

      // 4. vincular identidad de google al usuario
      await this.userRepository.addIdentity(user.id, {
        provider: 'google',
        providerId: googleUser.sub,
      });
    } else {
      // 5. actualizar último login si ya existía la identidad
      const googleIdentity = user.identities.find(
        (i) => i.provider === 'google' && i.providerId === googleUser.sub,
      );
      if (googleIdentity) {
        await this.userRepository.updateLastLogin(googleIdentity.id);
      }
    }

    // 6. generar jwt de nuestra api
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
