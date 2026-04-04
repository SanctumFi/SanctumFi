# Stage 1: Build TEE node (Go binary)
FROM golang:1.23-alpine AS node-builder
RUN apk add --no-cache git
RUN git clone https://github.com/flare-foundation/tee-node.git /build
WORKDIR /build/cmd/extension-server
RUN CGO_ENABLED=0 go build -o /server .

# Stage 2: Build extension (TypeScript)
FROM node:22-alpine AS ext-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 3: Final image
FROM alpine:3.20
RUN apk add --no-cache nodejs gosu ca-certificates
RUN adduser -D -u 1001 server && adduser -D -u 1002 extension

COPY --from=node-builder /server /usr/local/bin/server
COPY --from=ext-builder /app/dist /app/dist
COPY --from=ext-builder /app/node_modules /app/node_modules
COPY --from=ext-builder /app/package.json /app/package.json

ENV CONFIG_PORT=5500
ENV SIGN_PORT=8882
ENV EXTENSION_PORT=8883
ENV MODE=1

EXPOSE 5500

WORKDIR /app
CMD ["sh", "-c", "gosu server /usr/local/bin/server & gosu extension node dist/main.js"]
