import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuthService, GoogleUserPayload } from '../../domain/ports/google-auth.port';

@Injectable()
export class GoogleAuthAdapter implements GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID not found in environment variables');
    }
    this.client = new OAuth2Client(clientId);
  }

  async verifyToken(token: string): Promise<GoogleUserPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      return {
        email: payload.email,
        sub: payload.sub,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      throw new UnauthorizedException(`Google authentication failed: ${error.message}`);
    }
  }
}
