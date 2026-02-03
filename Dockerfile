# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install

# Copiar el resto del código
COPY . .

# Generar el build de TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /usr/src/app

# Copiar solo lo necesario desde el stage de build
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/dist ./dist

# Instalar solo dependencias de producción
RUN npm install --omit=dev

# Crear directorios para volúmenes opcionalmente (Docker los creará si no existen)
RUN mkdir -p attachments logs

# Exponer el puerto configurado (el 3001 es el nuevo default)
EXPOSE 3001

# Comando para arrancar en producción
CMD [ "node", "dist/app.js" ]
