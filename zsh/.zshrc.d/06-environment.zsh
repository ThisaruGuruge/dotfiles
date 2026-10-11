# ============================================================================
# Environment Variables and Personal Configuration
# ============================================================================
# Load personal configs, environment variables, and tool-specific settings

# Source the personal configs
source "$HOME/.aliases.sh"

# Source modular functions from .functions.d/
for file in "$HOME/.functions.d"/*.zsh; do
    [[ -r "$file" ]] && source "$file"
done

source "$HOME/.paths.sh"

# Configure SOPS age key location
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"

# Load ~/.env (sops-encrypted or plaintext). _dotfiles_load_env lives in
# .functions.d/06-dotfiles.zsh: it keeps the decrypted copy in a private cache
# (0600 file, 0700 dir) and parses KEY=value lines instead of sourcing them,
# on cache hits as well as misses.
(( $+functions[_dotfiles_load_env] )) && _dotfiles_load_env

# Claude Code - default to personal account; cce alias overrides per-invocation
export CLAUDE_CONFIG_DIR="$HOME/.claude-personal"

# Docker settings
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Ripgrep configuration (XDG standard location, managed by stow)
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/config"

# Lazygit configuration - force use of ~/.config/lazygit instead of ~/Library/Application Support
export LG_CONFIG_FILE="$HOME/.config/lazygit/config.yml"

# Homebrew settings
export HOMEBREW_AUTO_UPDATE_SECS=86400

# Initialize rbenv (lightweight - skip rehash on startup)
if (( $+commands[rbenv] )); then
    export PATH="$HOME/.rbenv/shims:${PATH}"
    export RBENV_SHELL=zsh
    rbenv() {
        local command="${1:-}"
        [ "$#" -gt 0 ] && shift
        case "$command" in
        rehash|shell) eval "$(command rbenv "sh-$command" "$@")" ;;
        *) command rbenv "$command" "$@" ;;
        esac
    }
fi

# Initialize pyenv (lightweight - skip rehash and bash subprocess on startup)
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
if (( $+commands[pyenv] )); then
    export PATH="$HOME/.pyenv/shims:${PATH}"
    export PYENV_SHELL=zsh
    pyenv() {
        local command="${1:-}"
        [ "$#" -gt 0 ] && shift
        case "$command" in
        rehash|shell) eval "$(command pyenv "sh-$command" "$@")" ;;
        *) command pyenv "$command" "$@" ;;
        esac
    }
fi

# Source local environment if it exists
if [ -d "$HOME/.local/bin" ] && [ -f "$HOME/.local/bin/env" ]; then
    source "$HOME/.local/bin/env"
fi

