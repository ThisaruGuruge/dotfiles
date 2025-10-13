#!/bin/zsh

eval "$(/opt/homebrew/bin/brew shellenv)"

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
   mkdir -p "$(dirname "$ZINIT_HOME")"
   git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Initialize Starship prompt (fast, modern, written in Rust)
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# ZSH Plugins - Essential plugins load immediately, others use turbo mode

# Load completions immediately (needed for tab completion)
zinit light zsh-users/zsh-completions

# Load fzf-tab immediately (needed for enhanced tab completion)
zinit light Aloxaf/fzf-tab

# Load syntax highlighting with turbo mode (visual, can be delayed)
zinit ice wait"1" lucid
zinit light zsh-users/zsh-syntax-highlighting

# Load autosuggestions with turbo mode (helpful but not critical)
zinit ice wait"1" lucid
zinit light zsh-users/zsh-autosuggestions

# Add in snippets with turbo mode (utility functions, can be delayed)
zinit ice wait"2" lucid
zinit snippet OMZP::sudo
# Homebrew command-not-found integration (updated)
if ! command -v brew >/dev/null; then return; fi

homebrew_command_not_found_handle() {
  local cmd="$1"

  if [[ -n "${ZSH_VERSION}" ]]
  then
    autoload is-at-least
  fi

  # do not run when inside Midnight Commander or within a Pipe, except if CI
  if test -z "${HOMEBREW_COMMAND_NOT_FOUND_CI}" && test -n "${MC_SID}" -o ! -t 1
  then
    [[ -n "${ZSH_VERSION}" ]] && is-at-least "5.2" "${ZSH_VERSION}" &&
      echo "zsh: command not found: ${cmd}" >&2
    return 127
  fi

  if [[ "${cmd}" != "-h" ]] && [[ "${cmd}" != "--help" ]] && [[ "${cmd}" != "--usage" ]] && [[ "${cmd}" != "-?" ]]
  then
    local txt
    txt="$(brew which-formula --skip-update --explain "${cmd}" 2>/dev/null)"
  fi

  if [[ -z "${txt}" ]]
  then
    [[ -n "${ZSH_VERSION}" ]] && is-at-least "5.2" "${ZSH_VERSION}" &&
      echo "zsh: command not found: ${cmd}" >&2
  else
    echo "${txt}"
  fi

  return 127
}

if [[ -n "${ZSH_VERSION}" ]]
then
  command_not_found_handler() {
    homebrew_command_not_found_handle "$*"
    return $?
  }
fi

# Add Homebrew completions to fpath and exclude broken paths
if type brew &>/dev/null; then
  FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"
fi

# Optimized completion system - regenerate dump only once per day
# This reduces startup time from ~360ms to ~50ms
autoload -Uz compinit
if [[ -n ${ZDOTDIR}/.zcompdump(#qNmh-20) ]]; then
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

# SDKMAN initialization - kept simple for reliability
export SDKMAN_DIR="$HOME/.sdkman"
if [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
    # Source SDKMAN directly (caching doesn't work well with SDKMAN's complexity)
    setopt localoptions nolocaltraps
    source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
fi

# keybindings
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward

# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
export SAVEHIST=$HISTSIZE
export HISTDUP=erase
setopt appendhistory # Append history to the history file
setopt sharehistory # Share history between all sessions
setopt hist_ignore_space # Ignore leading spaces when saving history
setopt hist_ignore_all_dups # Delete old recorded entry if new entry is a duplicate
setopt hist_save_no_dups # Do not save duplicates in history
setopt hist_ignore_dups # Do not save duplicates in history
setopt hist_find_no_dups # Do not display duplicates in history search
setopt correct # Enable auto correction
setopt no_correct_all # Don't correct arguments, only commands

# Disable autocorrect for specific commands
CORRECT_IGNORE_FILE=".*"

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
zstyle ':fzf-tab:*' accept-line enter

# Bash style jumps
autoload -U select-word-style
select-word-style bash

# Shell integrations with caching for faster startup

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
        # Generate and cache
        eval "$init_cmd" | tee "$cache_file" | source /dev/stdin
    fi
}

# Initialize fzf with caching
if command -v fzf >/dev/null 2>&1; then
    _cache_tool_init "fzf" "fzf --zsh"
fi

# Initialize zoxide with caching
if command -v zoxide >/dev/null 2>&1; then
    _cache_tool_init "zoxide" "zoxide init --cmd cd zsh"
else
    # Keep builtin cd if zoxide not available
    cd() { builtin cd "$@" || return; }
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

# source the personal configs
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

# Ripgrep configuration
export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"

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
export PATH="${HOME}/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

# Source local environment if it exists
if [ -d "$HOME/.local/bin" ] && [ -f "$HOME/.local/bin/env" ]; then
    source "$HOME/.local/bin/env"
fi

# Force command hash rebuild at the end (fixes Warp terminal command discovery)
rehash
