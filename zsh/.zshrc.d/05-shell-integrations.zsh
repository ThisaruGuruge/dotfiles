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

    # Use zsh's $commands hash for fast path lookup (no subprocess). The cache
    # is keyed on the binary's resolved real path (${...:A}), recorded in its
    # first line: Homebrew keeps build-time mtimes on upgraded binaries, so an
    # mtime comparison alone can call a stale cache fresh forever, while a
    # changed real path (new Cellar version) always invalidates it. The init
    # command is recorded too, so changing a flag (e.g. atuin --disable-ai)
    # regenerates the cache instead of serving the old output forever.
    local tool_path="${commands[$tool]:A}"
    local header="# tool-path: $tool_path | init: $init_cmd"
    local first_line=""
    [[ -s "$cache_file" ]] && read -r first_line <"$cache_file"
    if [[ -n "$tool_path" && "$first_line" == "$header" && "$cache_file" -nt "$tool_path" ]]; then
        source "$cache_file"
    else
        # Generate into a temp file and publish it only if the command
        # succeeded and produced output; a failed init must never leave an
        # empty cache that then counts as fresh. On failure nothing is
        # sourced and the next shell retries.
        local body tmp_file="$cache_file.tmp.$$"
        if body="$(eval "$init_cmd" 2>/dev/null)" && [[ -n "$body" ]]; then
            print -r -- "$header"$'\n'"$body" >"$tmp_file" &&
                command mv -f "$tmp_file" "$cache_file" &&
                source "$cache_file"
        fi
        rm -f "$tmp_file" 2>/dev/null
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

# Previews for Ctrl-T (files) and Alt-C (directories). Only the two widgets get
# options; FZF_DEFAULT_OPTS (layout, height, colours) is left alone on purpose.
# Ctrl-/ toggles the preview pane; it moves below the list on narrow terminals.
_fzf_file_preview='head -200 {}'
(( $+commands[bat] )) && _fzf_file_preview='bat --color=always --style=numbers --line-range :200 {}'
_fzf_dir_preview='ls -la {}'
(( $+commands[eza] )) && _fzf_dir_preview='eza --tree --level=2 --color=always {}'
_fzf_preview_window="--preview-window='right,55%,border-left,<90(down,50%,border-top)' --bind='ctrl-/:toggle-preview'"
export FZF_CTRL_T_OPTS="--preview '$_fzf_file_preview' $_fzf_preview_window"
export FZF_ALT_C_OPTS="--preview '$_fzf_dir_preview' $_fzf_preview_window"
unset _fzf_file_preview _fzf_dir_preview _fzf_preview_window

# Initialize zoxide with caching - using 'z' command instead of overriding 'cd'
# This keeps 'cd' working normally for scripts and tools
if (( $+commands[zoxide] )); then
    _cache_tool_init "zoxide" "zoxide init --cmd z zsh"
fi

# Lazy load direnv - initialize only when a .envrc applies, i.e. when the
# current directory or any parent has one. Checked on every cd and once at the
# first prompt, so a new shell or tmux pane opened inside a pinned tree (and a
# cd into one of its subdirectories) loads direnv too. Trees with no .envrc
# above them never pay for the hook. `envrc` calls _direnv_check/_direnv_hook
# itself after writing or removing a pin.
if (( $+commands[direnv] )); then
    _direnv_lazy_load() {
        eval "$(direnv hook zsh)"
        unset -f _direnv_lazy_load
        # Remove our check hooks now that direnv's own hook is active
        chpwd_functions=(${chpwd_functions:#_direnv_check})
        precmd_functions=(${precmd_functions:#_direnv_check_once})
        unset -f _direnv_check _direnv_check_once 2>/dev/null
        # Re-trigger the hook
        _direnv_hook
    }
    # Pure-zsh walk up from $PWD (no forks); load direnv at the first .envrc
    _direnv_check() {
        local dir="$PWD"
        while :; do
            if [[ -f "$dir/.envrc" ]]; then
                _direnv_lazy_load
                return
            fi
            [[ "$dir" == / || -z "$dir" ]] && return
            dir="${dir:h}"
        done
    }
    # One-shot at the first prompt: covers the directory the shell started in
    _direnv_check_once() {
        precmd_functions=(${precmd_functions:#_direnv_check_once})
        unset -f _direnv_check_once
        _direnv_check
    }
    chpwd_functions+=(_direnv_check)
    precmd_functions+=(_direnv_check_once)
fi

# Initialize atuin with caching - handles Ctrl+R and up-arrow for history.
# --disable-ai leaves `?` as a plain character (atuin 18.23+ binds it to an AI helper).
if (( $+commands[atuin] )); then
    _cache_tool_init "atuin" "atuin init zsh --disable-ai"
fi
