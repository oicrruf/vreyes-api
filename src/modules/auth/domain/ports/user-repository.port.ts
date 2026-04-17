import { User } from '../entities/user.entity';
import { UserIdentity, IdentityProvider } from '../entities/user-identity.entity';

export const USER_REPOSITORY = 'USER_REPOSITORY';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByIdentity(provider: IdentityProvider, providerId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  addIdentity(userId: string, identity: Partial<UserIdentity>): Promise<void>;
  updateLastLogin(identityId: string): Promise<void>;
  updateTaxpayerId(userId: string, taxpayerId: string): Promise<User>;
}

