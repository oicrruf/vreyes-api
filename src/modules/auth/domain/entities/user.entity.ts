import { UserIdentity } from './user-identity.entity';

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name?: string,
    public readonly avatarUrl?: string,
    public readonly taxpayerId?: string,
    public readonly taxpayer?: { nrc: string; nit: string | null; nombre: string },
    public readonly identities: UserIdentity[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}


  static create(email: string, name?: string, avatarUrl?: string, taxpayerId?: string): User {
    // el id se generará en la infraestructura o podemos usar un generador de uuids aquí
    return new User('', email, name, avatarUrl, taxpayerId, undefined, [], new Date(), new Date());
  }

}

