# ============================================================================
# Completion System Configuration
# ============================================================================
# Optimized completion with caching for faster startup

# Add Homebrew completions to fpath and exclude broken paths
if type brew &>/dev/null; then
  FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"
fi

# Optimized completion system - regenerate dump only once per day
# This reduces startup time from ~360ms to ~50ms
# Note: (#qNmh-20) is a zsh glob qualifier meaning "modified less than 20 hours ago"
setopt extendedglob
autoload -Uz compinit
# shellcheck disable=SC1036,SC1072,SC1073,SC1009
if [[ -e ${ZDOTDIR:-$HOME}/.zcompdump(#qNmh-20) ]]; then
    # Completion dump is fresh (less than 20 hours old)
    # Use -C to skip security check (saves ~250ms)
    compinit -C -d "${ZDOTDIR:-$HOME}/.zcompdump"
else
    # Dump is old or doesn't exist - do full initialization
    compinit -i -d "${ZDOTDIR:-$HOME}/.zcompdump"
    # Compile the completion dump for faster loading
    { rm -f "${ZDOTDIR:-$HOME}/.zcompdump.zwc" && zcompile "${ZDOTDIR:-$HOME}/.zcompdump" } &!
fi

# NVM - Optimized loading for faster startup
export NVM_DIR="$HOME/.nvm"
if [ -d "$NVM_DIR/versions/node" ]; then
    # Quickly add current/default node version to PATH without loading full NVM
    # This makes global npm packages (like claude) available immediately
    latest_node_version="$(ls -t "$NVM_DIR/versions/node" 2>/dev/null | head -1)"

    if [ -n "$latest_node_version" ]; then
        default_node_path="$NVM_DIR/versions/node/$latest_node_version/bin"
        if [ -d "$default_node_path" ]; then
            export PATH="$default_node_path:$PATH"
        fi
    fi

    # Lazy load NVM only when actually needed
    if [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
        _load_nvm() {
            unset -f nvm node npm npx yarn _load_nvm
            \. "/opt/homebrew/opt/nvm/nvm.sh"
            [ -n "$PS1" ] && [ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
        }
        nvm() { _load_nvm; nvm "$@"; }
    fi
fi

zinit cdreplay -q

# SDKMAN initialization (must be before completion styling)
if [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
    # Source SDKMAN directly (caching doesn't work well with SDKMAN's complexity)
    setopt localoptions nolocaltraps
    source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
fi

# Completion styling
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no

# FZF-tab configuration for directory completion
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --color=always --icons $realpath 2>/dev/null || ls -1 $realpath'
zstyle ':fzf-tab:complete:cd:*' fzf-flags '--height=80%' '--preview-window=right:50%'
zstyle ':fzf-tab:complete:cd:*' popup-pad 30 0

# FZF-tab configuration for zoxide (__zoxide_z)
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'eza -1 --color=always --icons $realpath 2>/dev/null || ls -1 $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-flags '--height=80%' '--preview-window=right:50%'
zstyle ':fzf-tab:complete:__zoxide_z:*' query-string prefix input
zstyle ':fzf-tab:complete:__zoxide_z:*' popup-pad 30 0

# FZF-tab general settings
zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':fzf-tab:*' switch-group '<' '>'
zstyle ':fzf-tab:*' fzf-command fzf
# Don't accept-line on enter - just insert the completion and continue editing
zstyle ':fzf-tab:*' continuous-trigger '/'

# Bash style jumps
autoload -U select-word-style
select-word-style bash
