# ─── Build Stage ─────────────────────────────────────────────────
FROM rust:1.88-bookworm AS rust-builder

# Install system dependencies for Tauri.
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    librsvg2-dev \
    patchelf \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Rust project files.
COPY src-tauri/ src-tauri/

WORKDIR /app/src-tauri

# Pre-build dependencies (caching layer).
RUN cargo fetch

# ─── Node.js Build Stage ────────────────────────────────────────
FROM node:22-bookworm AS node-builder

WORKDIR /app

# Copy package files for dependency caching.
COPY package.json package-lock.json* ./

# Install Node dependencies.
RUN npm install

# Copy frontend source.
COPY index.html .
COPY svelte.config.js .
COPY tsconfig.json .
COPY vite.config.ts .
COPY src/ src/
COPY public/ public/

# Build frontend.
RUN npm run build

# ─── Final Build Stage ──────────────────────────────────────────
FROM rust:1.88-bookworm AS builder

# Install system dependencies.
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    librsvg2-dev \
    patchelf \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for tauri build.
RUN wget -qO- https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Copy everything.
COPY . .

# Copy pre-built frontend from node stage.
COPY --from=node-builder /app/dist/ dist/

# Build the Tauri application.
WORKDIR /app/src-tauri
RUN cargo build --release

# ─── Output Stage ───────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-0 \
    libgtk-3-0 \
    libayatana-appindicator3-1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary.
COPY --from=builder /app/src-tauri/target/release/ics-threat-modeller /app/ics-threat-modeller

# Copy bundled assets if they exist (cargo build --release may not produce bundles).
RUN mkdir -p /app/bundle

ENTRYPOINT ["/app/ics-threat-modeller"]
