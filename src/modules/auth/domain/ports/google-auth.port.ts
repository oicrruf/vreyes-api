export interface GoogleUserPayload {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
}

export const GOOGLE_AUTH_SERVICE = 'GOOGLE_AUTH_SERVICE';

export interface GoogleAuthService {
  verifyToken(token: string): Promise<GoogleUserPayload>;
}
