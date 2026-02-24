# ─── Build Stage ─────────────────────────────────────────────────
FROM rust:1.88-bookworm AS rust-builder

# Install corporate root certificate.
COPY vegarootcert2.crt /usr/local/share/ca-certificates/vegarootcert2.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*

# Install system dependencies for Tauri.
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Install corporate root certificate.
COPY vegarootcert2.crt /usr/local/share/ca-certificates/vegarootcert2.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

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

# Install corporate root certificate.
COPY vegarootcert2.crt /usr/local/share/ca-certificates/vegarootcert2.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*

# Install system dependencies.
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    && apt-get install -y --no-install-recommends nodejs

WORKDIR /app

# Copy everything.
COPY . .

# Copy pre-built frontend from node stage.
COPY --from=node-builder /app/dist/ dist/

# Copy pre-fetched cargo registry from rust-builder stage.
COPY --from=rust-builder /usr/local/cargo/registry /usr/local/cargo/registry

# Build the Tauri application.
WORKDIR /app/src-tauri
RUN cargo build --release

# ─── Output Stage ───────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# WebKit / GTK runtime libs  +  Xvfb / VNC / noVNC for portable display
RUN apt-get update && apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.1-0 \
    libgtk-3-0 \
    libayatana-appindicator3-1 \
    librsvg2-common \
    shared-mime-info \
    adwaita-icon-theme \
    # Virtual framebuffer + window manager
    xvfb \
    openbox \
    # VNC server
    x11vnc \
    # noVNC dependencies
    python3 python3-numpy \
    procps \
    git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install noVNC + websockify
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC \
    && git clone --depth 1 https://github.com/novnc/websockify.git /opt/noVNC/utils/websockify \
    && rm -rf /opt/noVNC/.git /opt/noVNC/utils/websockify/.git

WORKDIR /app

# Copy the built binary.
COPY --from=builder /app/src-tauri/target/release/ics-threat-modeller /app/ics-threat-modeller

# Copy bundled assets if they exist (cargo build --release may not produce bundles).
RUN mkdir -p /app/bundle

# Copy entrypoint script.
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 6080

ENTRYPOINT ["/app/entrypoint.sh"]
