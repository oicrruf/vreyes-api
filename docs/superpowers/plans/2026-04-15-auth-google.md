# plan: implementación de autenticación con google

**fecha:** 2026-04-15  
**tarea principal:** implementar login de google y estructura de usuarios agnóstica.

## tareas

### fase 1: base de datos y dominio
- [x] t1: actualizar `schema.prisma` con modelos `User` y `UserIdentity`.
- [x] t2: ejecutar migración de prisma hacia supabase.
- [x] t3: definir entidades de dominio `User` y objetos de valor necesarios.
- [x] t4: definir puertos `UserRepository` y `AuthService`.

### fase 2: infraestructura (google & jwt)
- [x] t5: instalar dependencias (`google-auth-library`, `@nestjs/jwt`, `@nestjs/passport`).
- [x] t6: implementar `GoogleAuthAdapter` para validación de tokens.
- [x] t7: implementar `PrismaUserAdapter` para persistencia.
- [x] t8: configurar módulo de jwt y estrategias de passport.

### fase 3: aplicación y api
- [x] t9: crear comando `LoginWithGoogle` y su handler.
- [x] t10: crear `AuthController` con endpoint `POST /auth/google`.
- [x] t11: implementar guard de jwt para proteger rutas.

### fase 4: validación
- [x] t12: pruebas de flujo completo (registro automático en primer login).
- [x] t13: verificar creación de identidades vinculadas.

## notas
- el diseño permite que un mismo email tenga múltiples identidades (ej. google y local) vinculadas al mismo usuario.
