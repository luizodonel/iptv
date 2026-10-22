# Stage 1: Build React/Vite application
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependências
COPY cinestream-tv/package*.json ./
RUN npm install

# Copiar código fonte e compilar aplicação
COPY cinestream-tv/ ./
RUN npm run build

# Stage 2: Servidor Node.js com Proxy HLS e SPA estático
FROM node:20-alpine
WORKDIR /app

# Copiar arquivos compilados e script do servidor
COPY --from=build /app/dist ./dist
COPY server.js ./

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 80 3000
CMD ["node", "server.js"]
