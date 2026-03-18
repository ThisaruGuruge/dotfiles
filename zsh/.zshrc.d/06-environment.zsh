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

# Load environment variables with caching (supports both encrypted and plaintext .env)
if [ -f "$HOME/.env" ]; then
    env_cache_file="$HOME/.cache/zsh/env_cache"
    env_file="$HOME/.env"

    # Create cache directory if it doesn't exist
    [ ! -d "$HOME/.cache/zsh" ] && mkdir -p "$HOME/.cache/zsh"

    # Check if cache is valid (newer than .env file)
    if [ -f "$env_cache_file" ] && [ "$env_cache_file" -nt "$env_file" ]; then
        # Use cached version
        source "$env_cache_file" 2>/dev/null
    else
        # Check if file is encrypted (starts with #ENC)
        if head -1 "$env_file" | grep -q "^#ENC\["; then
            # Encrypted - decrypt and cache
            if (( $+commands[sops] )); then
                if sops_output=$(sops -d "$env_file" 2>/dev/null); then
                    echo "$sops_output" >"$env_cache_file"
                    chmod 600 "$env_cache_file"
                    # Safely source only lines matching export KEY="VALUE" or KEY='VALUE' pattern
                    # This validates the export statement structure to prevent code injection
                    # Pattern explanation:
                    # - ^export[[:space:]]+     : Must start with 'export' and whitespace
                    # - [A-Za-z_][A-Za-z0-9_]*  : Valid variable name (alphanumeric + underscore)
                    # - =                       : Assignment operator
                    # - Value must not contain: $( ) ` ; & | < > \n (command injection chars)
                    # - Accepts: quoted strings without dangerous chars, or simple unquoted values
                    while IFS= read -r line; do
                        # Skip empty lines and comments
                        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

                        # Validate safe export pattern (no command injection characters)
                        # Must be: export VARNAME=value (no $(), `, ;, &, |, <, >, ${})
                        if [[ "$line" =~ ^export[[:space:]]+[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; then
                            # Block dangerous patterns by checking for their absence
                            if [[ "$line" != *'$('* && "$line" != *'`'* && "$line" != *'${'* &&
                                  "$line" != *';'* && "$line" != *'&'* &&
                                  "$line" != *'|'* && "$line" != *'<'* && "$line" != *'>'* ]]; then
                                eval "$line"
                            fi
                        fi
                    done <<<"$sops_output"
                else
                    echo "Warning: Failed to decrypt $HOME/.env - check your SOPS/age configuration" >&2
                fi
            else
                echo "Warning: SOPS not available - cannot decrypt $HOME/.env" >&2
            fi
        else
            # Plaintext - copy to cache and source
            cp "$env_file" "$env_cache_file"
            source "$env_file"
        fi
    fi
fi

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

