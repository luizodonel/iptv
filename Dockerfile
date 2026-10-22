# Stage 1: Build React/Vite application
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependências do frontend
COPY cinestream-tv/package*.json ./
RUN npm install

# Copiar código fonte e compilar aplicação
COPY cinestream-tv/ ./
RUN npm run build

# Stage 2: Servidor Node.js com PostgreSQL, Proxy HLS e SPA estático
FROM node:20-alpine
WORKDIR /app

# Instalar dependências do servidor backend (driver PostgreSQL pg)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar arquivos compilados e scripts do servidor
COPY --from=build /app/dist ./dist
COPY server.js db.js authService.js mercadoPagoService.js ./
RUN mkdir -p /app/data

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 80 3000
CMD ["node", "server.js"]
