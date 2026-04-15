export type IdentityProvider = 'google' | 'local' | 'keycloak';

export class UserIdentity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly provider: IdentityProvider,
    public readonly providerId: string,
    public readonly passwordHash?: string,
    public readonly lastLogin?: Date,
  ) {}
}
