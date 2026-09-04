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

# 1. Crear usuario primero
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

# 2. Crear directorio de uploads y dar permisos SOLO a esa carpeta (INSTANTÁNEO)
# Ya NO hacemos chown -R /app, solo a la carpeta que necesita escritura
RUN mkdir -p /app/uploads && \
    chown -R 1001:1001 /app/uploads

# 3. Copiar package.json y prisma (usando --chown para que ya queden con el dueño correcto)
COPY --chown=1001:1001 package*.json ./
COPY --chown=1001:1001 prisma ./prisma/

# Instalar SOLO dependencias de producción (tsx está en dependencies)
RUN npm ci --omit=dev && \
    npx prisma generate

# 4. Copiar archivos necesarios (usando --chown en CADA COPY)
# Al usar --chown aquí, NO necesitas el chown -R lento del final
COPY --chown=1001:1001 --from=builder /app/.next ./.next
COPY --chown=1001:1001 --from=builder /app/public ./public
COPY --chown=1001:1001 --from=builder /app/src ./src
COPY --chown=1001:1001 --from=builder /app/next.config.ts ./

# Copiar server.ts DIRECTAMENTE (sin compilar)
COPY --chown=1001:1001 --from=builder /app/server.ts ./server.ts

# Copiar tsconfig.json para que tsx funcione correctamente
COPY --chown=1001:1001 --from=builder /app/tsconfig.json ./tsconfig.json

# Exponer puerto
EXPOSE 3000

# Cambiar a usuario no-root
USER 1001

# Ejecutar con tsx (se usa igual que en desarrollo)
CMD ["npx", "tsx", "server.ts"]