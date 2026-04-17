import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { UserRepository } from '../../domain/ports/user-repository.port';
import { User } from '../../domain/entities/user.entity';
import { UserIdentity, IdentityProvider } from '../../domain/entities/user-identity.entity';
import { IdentityProvider as PrismaProvider } from '@prisma/client';

@Injectable()
export class PrismaUserAdapter implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const record = await (this.prisma as any).user.findUnique({
      where: { email },
      include: { identities: true, taxpayer: true },
    });

    if (!record) return null;

    return this.mapToDomain(record);
  }

  async findByIdentity(provider: IdentityProvider, providerId: string): Promise<User | null> {
    const identityRecord = await (this.prisma as any).userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: provider as PrismaProvider,
          providerId,
        },
      },
      include: { user: { include: { identities: true, taxpayer: true } } },
    });

    if (!identityRecord) return null;

    return this.mapToDomain(identityRecord.user);
  }

  async save(user: User): Promise<User> {
    const record = await (this.prisma as any).user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      create: {
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      include: { identities: true, taxpayer: true },
    });

    return this.mapToDomain(record);
  }

  async addIdentity(userId: string, identity: Partial<UserIdentity>): Promise<void> {
    await (this.prisma as any).userIdentity.create({
      data: {
        userId,
        provider: identity.provider as PrismaProvider,
        providerId: identity.providerId!,
        passwordHash: identity.passwordHash,
        lastLogin: new Date(),
      },
    });
  }

  async updateLastLogin(identityId: string): Promise<void> {
    await (this.prisma as any).userIdentity.update({
      where: { id: identityId },
      data: { lastLogin: new Date() },
    });
  }

  async updateTaxpayerId(userId: string, taxpayerId: string): Promise<User> {
    const record = await (this.prisma as any).user.update({
      where: { id: userId },
      data: { taxpayerId },
      include: { identities: true, taxpayer: true },
    });

    return this.mapToDomain(record);
  }

  private mapToDomain(record: any): User {
    return new User(
      record.id,
      record.email,
      record.name,
      record.avatarUrl,
      record.taxpayerId,
      record.taxpayer ? { 
        nrc: record.taxpayer.nrc, 
        nit: record.taxpayer.nit, 
        nombre: record.taxpayer.nombre 
      } : undefined,
      record.identities.map(
        (i: any) =>
          new UserIdentity(
            i.id,
            i.userId,
            i.provider as IdentityProvider,
            i.providerId,
            i.passwordHash,
            i.lastLogin,
          ),
      ),
      record.createdAt,
      record.updatedAt,
    );
  }
}
