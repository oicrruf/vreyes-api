# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install

# Copiar el resto del código
COPY . .

# Generar cliente Prisma y build de TypeScript
# SUPABASE_DATABASE_URI es requerido por prisma.config.ts pero no se usa en generate
RUN SUPABASE_DATABASE_URI=postgresql://dummy:dummy@localhost/dummy npx prisma generate && npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /usr/src/app

# Copiar solo lo necesario desde el stage de build
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist

# Instalar solo dependencias de producción
RUN npm install --omit=dev

# Copiar cliente Prisma generado (los enums y tipos no se regeneran sin prisma CLI)
COPY --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Crear directorios para volúmenes opcionalmente (Docker los creará si no existen)
RUN mkdir -p attachments logs

# Exponer el puerto configurado (el 3001 es el nuevo default)
EXPOSE 9000

# Comando para arrancar en producción
CMD [ "node", "dist/main.js" ]
