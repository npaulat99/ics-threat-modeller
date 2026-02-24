#!/bin/bash
set -e

# ─── ICS Threat Modeller – Docker Entrypoint ───────────────────
# Starts Xvfb (virtual display), openbox (window manager),
# x11vnc (VNC server) and noVNC (browser access) so the app
# works on any host OS without X11 forwarding.

DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"
SCREEN_WIDTH="${SCREEN_WIDTH:-1400}"
SCREEN_HEIGHT="${SCREEN_HEIGHT:-900}"
SCREEN_DEPTH="${SCREEN_DEPTH:-24}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

echo "────────────────────────────────────────────────────"
echo " ICS Threat Modeller (Docker)"
echo "────────────────────────────────────────────────────"
echo " Display : ${DISPLAY}  (${SCREEN_WIDTH}x${SCREEN_HEIGHT})"
echo " VNC     : vnc://localhost:${VNC_PORT}"
echo " Browser : http://localhost:${NOVNC_PORT}/vnc.html?autoconnect=true"
echo "────────────────────────────────────────────────────"

# 1) Virtual framebuffer
Xvfb "${DISPLAY}" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH}" -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 1

# 2) Lightweight window manager (so windows get decorations & can move/resize)
openbox &
sleep 0.5

# 3) VNC server (no password by default; set VNC_PASSWORD env to enable)
VNC_ARGS="-display ${DISPLAY} -rfbport ${VNC_PORT} -shared -forever -nopw"
if [ -n "${VNC_PASSWORD}" ]; then
    mkdir -p ~/.vnc
    x11vnc -storepasswd "${VNC_PASSWORD}" ~/.vnc/passwd
    VNC_ARGS="-display ${DISPLAY} -rfbport ${VNC_PORT} -shared -forever -rfbauth ~/.vnc/passwd"
fi
x11vnc ${VNC_ARGS} &
sleep 0.5

# 4) noVNC web proxy (browser access)
/opt/noVNC/utils/novnc_proxy --vnc localhost:${VNC_PORT} --listen ${NOVNC_PORT} &
sleep 0.5

# 5) Start the Tauri application
echo "Starting ICS Threat Modeller …"
exec /app/ics-threat-modeller
