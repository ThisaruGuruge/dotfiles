# ============================================================================
# Completion System Configuration
# ============================================================================
# Optimized completion with caching for faster startup

# Add Homebrew completions to fpath (hardcoded prefix for performance)
if [[ -d "${HOMEBREW_PREFIX:-/opt/homebrew}/share/zsh/site-functions" ]]; then
  FPATH="${HOMEBREW_PREFIX:-/opt/homebrew}/share/zsh/site-functions:${FPATH}"
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
# NVM_DIR and node PATH are set in .zshenv for non-interactive shell support.
# Here we only set up the lazy-load wrappers for the interactive shell.
# Each stub is self-contained (inlines the load logic) so that tools like
# Claude Code that snapshot shell functions still work correctly.
export NVM_DIR="$HOME/.nvm"
if [[ -d "$NVM_DIR/versions/node" ]]; then
    if [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]]; then
        nvm() {
            unset -f nvm node npm npx
            \. "/opt/homebrew/opt/nvm/nvm.sh"
            [[ -n "$PS1" ]] && [[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ]] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
            nvm "$@"
        }
        node() {
            unset -f nvm node npm npx
            \. "/opt/homebrew/opt/nvm/nvm.sh"
            node "$@"
        }
        npm() {
            unset -f nvm node npm npx
            \. "/opt/homebrew/opt/nvm/nvm.sh"
            npm "$@"
        }
        npx() {
            unset -f nvm node npm npx
            \. "/opt/homebrew/opt/nvm/nvm.sh"
            npx "$@"
        }
    fi
fi

zinit cdreplay -q

# SDKMAN - lazy-loaded for faster startup (saves ~1s)
if [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
    export SDKMAN_DIR="$HOME/.sdkman"
    # Add current candidates to PATH immediately (without full init)
    for candidate_dir in "$SDKMAN_DIR"/candidates/*/current/bin(N); do
        [[ -d "$candidate_dir" ]] && export PATH="$candidate_dir:$PATH"
    done
    # Lazy-load full SDKMAN on first use
    sdk() {
        unset -f sdk
        setopt localoptions nolocaltraps
        source "$SDKMAN_DIR/bin/sdkman-init.sh" 2>/dev/null || true
        sdk "$@"
    }
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
