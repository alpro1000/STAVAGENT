#!/usr/bin/env bash
# build_libredwg.sh — idempotent libredwg build for STAVAGENT pipelines.
#
# LibreDWG (https://www.gnu.org/software/libredwg/) is a GNU project for
# reading/writing AutoCAD DWG files. STAVAGENT pipelines use the `dwg2dxf`
# binary to convert vendor DWGs (ArchiCAD output) to DXF for parsing by
# ezdxf.
#
# Behavior:
#   - If /usr/local/bin/dwg2dxf already exists with version >= 0.13.4 → exit 0
#   - Else clone (or update) source, configure --enable-release, make, install
#   - Verify install
#
# Idempotent: safe to re-run; fast path takes ~50 ms when already installed.
#
# Cross-platform: detects Debian/Ubuntu (apt-get) for build deps. Other
# distros print the missing deps and exit non-zero (manual install).
#
# Exit codes:
#   0  success (already installed or freshly built)
#   1  build dependency install failed
#   2  configure failed
#   3  make / install failed
#   4  post-install verification failed
set -euo pipefail

readonly REQUIRED_VERSION="0.13.4"
readonly INSTALL_PREFIX="${LIBREDWG_PREFIX:-/usr/local}"
readonly REPO_URL="https://github.com/LibreDWG/libredwg.git"
readonly CLONE_DIR="${LIBREDWG_CLONE_DIR:-/tmp/libredwg}"
readonly LOG_PREFIX="[build_libredwg]"

log() { echo "${LOG_PREFIX} $*" >&2; }

# ---------------------------------------------------------------------------
# Fast path: already installed?
# ---------------------------------------------------------------------------
if command -v dwg2dxf >/dev/null 2>&1; then
    installed_version="$(dwg2dxf --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "0.0.0")"
    if [ -n "${installed_version}" ] && [ "$(printf '%s\n%s\n' "${REQUIRED_VERSION}" "${installed_version}" | sort -V | head -1)" = "${REQUIRED_VERSION}" ]; then
        log "dwg2dxf ${installed_version} already installed at $(command -v dwg2dxf) — skipping build."
        exit 0
    fi
    log "dwg2dxf ${installed_version} found but < ${REQUIRED_VERSION}; rebuilding."
fi

# ---------------------------------------------------------------------------
# Build dependencies
# ---------------------------------------------------------------------------
declare -a missing=()
for tool in autoconf libtool libtoolize automake make gcc git pkg-config; do
    command -v "${tool}" >/dev/null 2>&1 || missing+=("${tool}")
done
# libpcre3-dev provides the headers, no executable to test directly
if ! pkg-config --exists libpcre 2>/dev/null && ! [ -f /usr/include/pcre.h ]; then
    missing+=("libpcre3-dev")
fi

if [ ${#missing[@]} -gt 0 ]; then
    log "Missing build deps: ${missing[*]}"
    if command -v apt-get >/dev/null 2>&1; then
        log "Installing via apt-get..."
        apt-get update -qq
        apt-get install -y --no-install-recommends \
            autoconf libtool libtool-bin automake make gcc git pkg-config \
            libpcre3-dev || {
                log "apt-get install failed"; exit 1;
            }
    else
        log "ERROR: non-Debian system — install these deps manually: ${missing[*]}"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Clone / update source
# ---------------------------------------------------------------------------
if [ -d "${CLONE_DIR}/.git" ]; then
    log "Updating existing clone at ${CLONE_DIR}..."
    git -C "${CLONE_DIR}" fetch --depth=1 origin
    git -C "${CLONE_DIR}" reset --hard origin/HEAD
else
    log "Cloning LibreDWG to ${CLONE_DIR}..."
    rm -rf "${CLONE_DIR}"
    git clone --depth=1 "${REPO_URL}" "${CLONE_DIR}"
fi
cd "${CLONE_DIR}"

# ---------------------------------------------------------------------------
# Configure → make → install
# ---------------------------------------------------------------------------
log "Running autogen.sh..."
sh autogen.sh

log "Configuring (--enable-release, prefix=${INSTALL_PREFIX})..."
./configure --enable-release --prefix="${INSTALL_PREFIX}" || {
    log "configure failed — see config.log"; exit 2;
}

log "Building (make -j$(nproc))..."
make -j"$(nproc)" || { log "make failed"; exit 3; }

log "Installing to ${INSTALL_PREFIX}..."
make install || { log "make install failed"; exit 3; }

# Refresh ld cache so newly installed libs resolve at runtime
ldconfig 2>/dev/null || true

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
if ! command -v dwg2dxf >/dev/null 2>&1; then
    log "ERROR: dwg2dxf not on PATH after install"
    exit 4
fi

final_version="$(dwg2dxf --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")"
log "Installed dwg2dxf ${final_version} at $(command -v dwg2dxf)"
exit 0
