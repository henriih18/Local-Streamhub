# =========================================
# Stage 1: Builder (Solo para Next.js)
# =========================================
FROM node:20-bullseye AS builder

WORKDIR /app

# Instalar herramientas necesarias para dependencias nativas
RUN apt-get update && apt-get install -y \
    python3 g++ make build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (incluyendo dev para build)
RUN npm ci

# Generar Prisma Client
RUN npx prisma generate

# Copiar el resto del código
COPY . .

# Construir SOLO Next.js (el servidor TS se copiará directamente)
RUN npm run build

# =========================================
# Stage 2: Runner (Producción con tsx)
# =========================================
FROM node:20-bullseye AS runner

WORKDIR /app

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Copiar package.json y prisma
COPY package*.json ./
COPY prisma ./prisma/

# Instalar SOLO dependencias de producción (tsx está en dependencies)
RUN npm ci --omit=dev && \
    npx prisma generate

# Copiar archivos necesarios
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./


# Copiar server.ts DIRECTAMENTE (sin compilar)
COPY --from=builder /app/server.ts ./server.ts

# Copiar tsconfig.json para que tsx funcione correctamente
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Exponer puerto
EXPOSE 3000

# Ejecutar con tsx (se usa igual que en desarrollo)
CMD ["npx", "tsx", "server.ts"]