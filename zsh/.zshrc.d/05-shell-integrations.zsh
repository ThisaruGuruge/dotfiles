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

    # Use zsh's $commands hash for fast path lookup (no subprocess)
    local tool_path="${commands[$tool]}"
    if [[ -f "$cache_file" ]] && [[ -n "$tool_path" ]] && [[ "$cache_file" -nt "$tool_path" ]]; then
        source "$cache_file"
    else
        # Generate and cache - write first, then source for reliability
        eval "$init_cmd" > "$cache_file" && source "$cache_file"
    fi
}

# Initialize fzf with caching
if (( $+commands[fzf] )); then
    _cache_tool_init "fzf" "fzf --zsh"
fi

# FZF configuration - show important hidden files/dirs like .config and .env
# Excludes noise like .git/, node_modules/, .cache/ for better performance
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git --exclude node_modules --exclude .cache'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git --exclude node_modules --exclude .cache'

# Initialize zoxide with caching - using 'z' command instead of overriding 'cd'
# This keeps 'cd' working normally for scripts and tools
if (( $+commands[zoxide] )); then
    _cache_tool_init "zoxide" "zoxide init --cmd z zsh"
fi

# Lazy load direnv - initialize only when entering directory with .envrc
if (( $+commands[direnv] )); then
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

# Initialize atuin with caching - handles Ctrl+R and up-arrow for history
if (( $+commands[atuin] )); then
    _cache_tool_init "atuin" "atuin init zsh"

    # Override atuin's autosuggestion strategy to use host-wide history.
    # Atuin injects _zsh_autosuggest_strategy_atuin which inherits filter_mode
    # from config.toml — but inline suggestions should always search across all
    # directories on this machine, not just the current one.
    _zsh_autosuggest_strategy_atuin() {
        suggestion=$(ATUIN_QUERY="$1" atuin search --cmd-only --limit 1 \
            --search-mode prefix --filter-mode host 2>/dev/null)
    }
fi
