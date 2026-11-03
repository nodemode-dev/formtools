#!/usr/bin/env bash
FORMTOOLS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FORMTOOLS_ROOT
ft_say() { printf '[formtools] %s\n' "$*"; }
ft_die() { printf '[formtools] error: %s\n' "$*" >&2; exit 1; }
ft_os() {
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo macos ;;
    Linux) echo linux ;;
    MINGW*|MSYS*|CYGWIN*|*_NT-*) echo windows ;;
    *) echo unknown ;;
  esac
}
ft_python() {
  local c
  for c in python3.14 python3.13 python3.12 python3 python; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
      echo "$c"
      return 0
    fi
  done
  return 1
}
ft_venv() {
  local act="$FORMTOOLS_ROOT/backend/venv/bin/activate"
  [ -f "$act" ] || act="$FORMTOOLS_ROOT/backend/venv/Scripts/activate"
  [ -f "$act" ] || ft_die "backend venv missing, run ./formtools install"
  # shellcheck disable=SC1090
  source "$act"
}
ft_native_path() {
  if [ "$(ft_os)" = windows ] && command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s\n' "$1"; fi
}
ft_target_triple() {
  if [ -n "${FORMTOOLS_TARGET:-}" ]; then echo "$FORMTOOLS_TARGET"; return 0; fi
  command -v rustc >/dev/null 2>&1 || return 1
  rustc -vV | awk '/^host:/ {print $2}'
}
ft_exe() { [ "$(ft_os)" = windows ] && echo ".exe" || echo ""; }
ft_port() { printf '%s' "${FORMTOOLS_PORT:-8240}"; }
ft_rust_env() {
  [ -d "$HOME/.cargo/bin" ] && PATH="$HOME/.cargo/bin:$PATH"
  export PATH
}
