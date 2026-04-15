# autenticación agnóstica y google login

**fecha:** 2026-04-15  
**estado:** propuesta

## contexto
necesitamos un sistema de usuarios que permita iniciar sesión inicialmente con google (gmail), pero que sea lo suficientemente flexible para soportar email/password local y keycloak en el futuro sin rediseñar la tabla de usuarios.

## diseño de base de datos (prisma)

implementaremos un patrón de "identidades federadas" donde el usuario es una entidad separada de sus métodos de autenticación.

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String?
  avatarUrl     String?        @map("avatar_url")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")
  identities    UserIdentity[]

  @@map("users")
}

enum IdentityProvider {
  google
  local
  keycloak
}

model UserIdentity {
  id                String           @id @default(uuid())
  userId            String           @map("user_id")
  provider          IdentityProvider
  providerId        String           @map("provider_id") // id de google, sub de keycloak, etc.
  passwordHash      String?          @map("password_hash") // solo para proveedor 'local'
  lastLogin         DateTime?        @map("last_login")
  user              User             @relation(fields: [userId], references: id, onDelete: Cascade)

  @@unique([provider, providerId])
  @@map("user_identities")
}
```

## arquitectura (hexagonal)

### puertos (domain/ports)
- `auth.port.ts`: interfaz genérica para login/registro.
- `google-auth.port.ts`: interfaz específica para validar tokens de google.
- `user-repository.port.ts`: para persistencia de usuarios e identidades.

### infraestructura (adapters)
- `google-auth.adapter.ts`: implementación usando `google-auth-library`.
- `jwt.service.ts`: para emitir tokens de nuestra propia api tras el login exitoso.

## flujo de autenticación (google)
1. el frontend envía el `id_token` de google al endpoint `/auth/google`.
2. el `google-auth.adapter` valida el token con los servidores de google.
3. si es válido, buscamos la identidad en `UserIdentity` donde `provider = google` y `providerId = google_sub`.
4. si no existe, creamos el `User` y su `UserIdentity`.
5. generamos un jwt propio de la api para sesiones subsecuentes.
