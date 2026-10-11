# Keep PATH free of duplicates for the whole session. `.paths.sh` has its own
# path_dedupe(), but that runs once and only covers entries added before it —
# anything appended later (pyenv prepends its shims in .zshrc.d/06-environment.zsh
# on every source, so re-sourcing .zshrc duplicated them) slipped past it.
# zsh's -U keeps the array unique on every assignment instead. It lives here
# rather than in .paths.sh because that file is also sourced by bash, which has
# no typeset -U.
typeset -U path PATH
typeset -U fpath

# Default editor
export EDITOR="nvim"
export VISUAL="$EDITOR"

# XDG paths. Set here (not in .zprofile) so every zsh sees them, including
# non-login and non-interactive shells. XDG_CACHE_HOME deliberately stays at
# ~/Library/Caches (the macOS convention); the zsh caches in ~/.cache/zsh are
# addressed by their literal path and do not depend on it.
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/Library/Caches"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"
export XDG_BIN_HOME="$HOME/.local/bin"

# Make Ghostty's terminfo available to all processes (including the tmux server).
# The xterm-ghostty terminfo lives inside the app bundle, not in system paths.
# Without this, tmux cannot render choose-tree and other TUI overlays.
_ghostty_terminfo="/Applications/Ghostty.app/Contents/Resources/terminfo"
if [[ -d "$_ghostty_terminfo" && ":${TERMINFO_DIRS}:" != *":${_ghostty_terminfo}:"* ]]; then
    export TERMINFO_DIRS="${TERMINFO_DIRS:+${TERMINFO_DIRS}:}${_ghostty_terminfo}"
fi
unset _ghostty_terminfo

[ -f "$HOME/.rover/env" ] && source "$HOME/.rover/env"
[ -d "$HOME/Setup/flutter/bin" ] && export PATH="$HOME/Setup/flutter/bin:$PATH"

# NVM - make node/npm/npx available in non-interactive shells (e.g. Claude Code agents)
# Resolves the nvm default alias to the matching installed version's bin dir.
# Only version-shaped defaults (22, 22.2, 22.2.0, v22.2.0) are resolved, after
# following up to three levels of nvm alias files (lts/* -> lts/jod -> v22.x.y).
# Anything else (node, stable, system, a missing lts alias) changes nothing and
# prints nothing; interactive shells still get the full nvm via its lazy loader.
export NVM_DIR="$HOME/.nvm"
unset NVM_DEFAULT_BIN
if [[ -f "$NVM_DIR/alias/default" && -d "$NVM_DIR/versions/node" ]]; then
    _nvm_ver="$(<"$NVM_DIR/alias/default")"
    for _nvm_i in 1 2 3; do
        [[ -n "$_nvm_ver" && "$_nvm_ver" != */../* && -f "$NVM_DIR/alias/$_nvm_ver" ]] || break
        _nvm_ver="$(<"$NVM_DIR/alias/$_nvm_ver")"
    done
    _nvm_ver="${_nvm_ver#v}"
    _nvm_node=()
    if [[ "$_nvm_ver" =~ '^[0-9]+(\.[0-9]+){0,2}$' ]]; then
        # Exact directory first; otherwise the highest anchored match ("22.2"
        # matches v22.2.x, never v22.22.2). (N) keeps a miss silent instead of
        # a NOMATCH error, (n) sorts numerically so v22.10 beats v22.9.
        _nvm_node=("$NVM_DIR/versions/node/v${_nvm_ver}"(N/))
        ((${#_nvm_node})) || _nvm_node=("$NVM_DIR/versions/node/v${_nvm_ver}".*(Nn/))
    fi
    # NVM_DEFAULT_BIN is a plain (unexported) shell variable: .zprofile uses it
    # to put this directory back in front after path_helper and Homebrew's
    # PATH setup have run (see the end of .zprofile).
    if ((${#_nvm_node})) && [[ -d "${_nvm_node[-1]}/bin" ]]; then
        NVM_DEFAULT_BIN="${_nvm_node[-1]}/bin"
        export PATH="$NVM_DEFAULT_BIN:$PATH"
    fi
    unset _nvm_ver _nvm_node _nvm_i
fi
