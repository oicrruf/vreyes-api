import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException(
        'Authentication required. Missing x-api-key header.',
      );
    }

    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      console.error('CRITICAL: API_KEY environment variable is not configured.');
      throw new InternalServerErrorException(
        'Server configuration error. API Key not configured.',
      );
    }

    if (apiKey !== validApiKey) {
      throw new ForbiddenException('Invalid API key.');
    }

    return true;
  }
}
