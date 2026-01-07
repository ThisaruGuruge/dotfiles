# ============================================================================
# Shell Integrations with Caching
# ============================================================================
# Configure modern CLI tools (fzf, zoxide, atuin, direnv) with optimized initialization

# Helper function to cache tool initialization
_cache_tool_init() {
    local tool=$1
    local init_cmd=$2
    local cache_file="$HOME/.cache/zsh/${tool}_init.zsh"

    [[ ! -d "$HOME/.cache/zsh" ]] && mkdir -p "$HOME/.cache/zsh"

    # Check if cache exists and is newer than the tool binary
    local tool_path=$(command -v "$tool" 2>/dev/null)
    if [[ -f "$cache_file" ]] && [[ -n "$tool_path" ]] && [[ "$cache_file" -nt "$tool_path" ]]; then
        source "$cache_file"
    else
        # Generate and cache - write first, then source for reliability
        eval "$init_cmd" > "$cache_file" && source "$cache_file"
    fi
}

# Initialize fzf with caching
if command -v fzf >/dev/null 2>&1; then
    _cache_tool_init "fzf" "fzf --zsh"
fi

# FZF configuration - show important hidden files/dirs like .config and .env
# Excludes noise like .git/, node_modules/, .cache/ for better performance
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git --exclude node_modules --exclude .cache'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git --exclude node_modules --exclude .cache'

# Initialize zoxide with caching - using 'z' command instead of overriding 'cd'
# This keeps 'cd' working normally for scripts and tools
if command -v zoxide >/dev/null 2>&1; then
    _cache_tool_init "zoxide" "zoxide init --cmd z zsh"
fi

# Lazy load direnv - initialize only when entering directory with .envrc
if command -v direnv >/dev/null 2>&1; then
    _direnv_lazy_load() {
        eval "$(direnv hook zsh)"
        unset -f _direnv_lazy_load
        # Re-trigger the hook
        _direnv_hook
    }
    # Set up a minimal hook that loads direnv when needed
    chpwd_functions+=(_direnv_check)
    _direnv_check() {
        if [[ -f .envrc ]]; then
            _direnv_lazy_load
        fi
    }
fi

# Initialize atuin with caching
if command -v atuin >/dev/null 2>&1; then
    _cache_tool_init "atuin" "atuin init zsh --disable-up-arrow --disable-ctrl-r"
    # Bind Ctrl+Alt+R to Atuin search (avoid Warp conflicts)
    bindkey '^[^R' _atuin_search_widget
fi
