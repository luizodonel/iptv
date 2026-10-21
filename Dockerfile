# Stage 1: Build React/Vite application
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependências
COPY cinestream-tv/package*.json ./
RUN npm install

# Copiar código fonte e compilar aplicação
COPY cinestream-tv/ ./
RUN npm run build

# Stage 2: Servir aplicação estática com Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 3000
CMD ["nginx", "-g", "daemon off;"]
