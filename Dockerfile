# 1. Usar una imagen ligera de Node
FROM node:20-alpine

# 2. Crear directorio de trabajo
WORKDIR /usr/src/app

# 3. Copiar archivos de dependencias
COPY package*.json ./

# 4. Instalar dependencias (incluyendo devDependencies para build)
RUN npm install

# 5. Copiar el resto del código
COPY . .

# Build de la aplicación TypeScript
RUN npm run build

# Opcional: Limpiar dependencias de desarrollo
RUN npm prune --production

# Definiendo el puerto por defecto o desde argumento
ARG PORT
ENV PORT=$PORT

# 6. Exponer el puerto
EXPOSE $PORT

# 7. Comando para arrancar
CMD [ "node", "dist/app.js" ]
