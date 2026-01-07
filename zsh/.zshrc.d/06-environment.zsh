# ============================================================================
# Environment Variables and Personal Configuration
# ============================================================================
# Load personal configs, environment variables, and tool-specific settings

# Source the personal configs
source "$HOME/.aliases.sh"
source "$HOME/.functions.sh"
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
            if command -v sops >/dev/null 2>&1; then
                if sops_output=$(sops -d "$env_file" 2>/dev/null); then
                    echo "$sops_output" >"$env_cache_file"
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

# Initialize rbenv with caching
if command -v rbenv >/dev/null 2>&1; then
    _cache_tool_init "rbenv" "rbenv init - zsh"
fi

# Initialize pyenv with caching
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
if command -v pyenv >/dev/null 2>&1; then
    _cache_tool_init "pyenv" "pyenv init -"
fi

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="/Users/thisaru/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

# Source local environment if it exists
if [ -d "$HOME/.local/bin" ] && [ -f "$HOME/.local/bin/env" ]; then
    source "$HOME/.local/bin/env"
fi

# Antigravity
export PATH="$HOME/.antigravity/antigravity/bin:$PATH"

# Force command hash rebuild at the end (fixes Warp terminal command discovery)
# Only run if we added new paths that might need discovery
if [[ -n "$ZSH_VERSION" ]]; then
    rehash
fi
