#!/bin/zsh

eval "$(/opt/homebrew/bin/brew shellenv)"

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
   mkdir -p "$(dirname "$ZINIT_HOME")"
   git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Initialize oh-my-posh with caching except for Apple Terminal
if [ "$TERM_PROGRAM" != "Apple_Terminal" ] && command -v oh-my-posh >/dev/null 2>&1; then
  omp_cache_file="$HOME/.cache/zsh/omp_cache.zsh"
  omp_config_file="$HOME/.config/ohmyposh/zen.json"

  # Create cache directory if it doesn't exist
  [ ! -d "$HOME/.cache/zsh" ] && mkdir -p "$HOME/.cache/zsh"

  # Check if cache is valid (newer than config file)
  if [ -f "$omp_cache_file" ] && [ "$omp_cache_file" -nt "$omp_config_file" ]; then
    # Use cached version
    source "$omp_cache_file" 2>/dev/null
  else
    # Generate new cache
    oh-my-posh init zsh --config "$omp_config_file" > "$omp_cache_file" 2>/dev/null
    source "$omp_cache_file" 2>/dev/null
  fi
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

# Load completions with error suppression for missing files and function override
autoload -Uz compinit && compinit -i 2>/dev/null

# NVM - Optimized loading for faster startup
export NVM_DIR="$HOME/.nvm"
if [ -d "$NVM_DIR/versions/node" ]; then
    # Quickly add current/default node version to PATH without loading full NVM
    # This makes global npm packages (like claude) available immediately
    default_node_path="$NVM_DIR/versions/node/$(ls -t "$NVM_DIR/versions/node" 2>/dev/null | head -1)/bin"
    if [ -d "$default_node_path" ]; then
        export PATH="$default_node_path:$PATH"
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

# SDKMAN initialization (load after completion system)
export SDKMAN_DIR="$HOME/.sdkman"
if [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
    # Load SDKMAN with completion error suppression
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
zstyle ':fzf-tab:complete:cd:*' fzf-preview "ls --color \$realpath"
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview "ls --color \$realpath"

# Bash style jumps
autoload -U select-word-style
select-word-style bash

# Shell integrations with lazy loading for performance

# Lazy load fzf - initialize only when first used
if command -v fzf >/dev/null 2>&1; then
    _fzf_lazy_load() {
        # Load fzf more efficiently
        eval "$(fzf --zsh)"
        unset -f _fzf_lazy_load
        # Re-bind Ctrl-R and Ctrl-T immediately after loading
        bindkey '^R' fzf-history-widget
        bindkey '^T' fzf-file-widget
        bindkey '\ec' fzf-cd-widget
    }
    # Create lightweight placeholder functions
    fzf() { _fzf_lazy_load "$@"; fzf "$@"; }
    # Set up key bindings that trigger lazy loading
    bindkey '^R' '_fzf_lazy_load'
    bindkey '^T' '_fzf_lazy_load'
    bindkey '\ec' '_fzf_lazy_load'
else
    # Provide fallback if fzf not available
    fzf() { echo "fzf not installed"; return 1; }
fi

# Initialize zoxide immediately (lazy loading caused issues)
if command -v zoxide >/dev/null 2>&1; then
    eval "$(zoxide init --cmd cd zsh)"
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

# Lazy load atuin - initialize only when history search is used
if command -v atuin >/dev/null 2>&1; then
    _atuin_lazy_load() {
        eval "$(atuin init zsh --disable-up-arrow --disable-ctrl-r)"
        unset -f _atuin_lazy_load
        # Bind Ctrl+Alt+R to Atuin search (avoid Warp conflicts)
        bindkey '^[^R' _atuin_search_widget
        # Re-run atuin command if called directly
        if [[ $# -gt 0 ]]; then
            atuin "$@"
        fi
    }
    atuin() { _atuin_lazy_load atuin "$@"; }
    # Set up lazy loading for the keybinding
    bindkey '^[^R' '_atuin_lazy_load'
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
                    echo "$sops_output" > "$env_cache_file"
                    # Safely source only lines matching export KEY="VALUE" pattern
                    # This avoids arbitrary code execution from decrypted content
                    while IFS= read -r line; do
                        if [[ "$line" =~ ^export[[:space:]]+[A-Za-z_][A-Za-z0-9_]*= ]]; then
                            eval "$line"
                        fi
                    done <<< "$sops_output"
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

# Homebrew settings
export HOMEBREW_AUTO_UPDATE_SECS=86400

# Lazy load rbenv - initialize only when ruby command is used
if command -v rbenv >/dev/null 2>&1; then
    _rbenv_lazy_load() {
        eval "$(rbenv init - zsh)"
        unset -f _rbenv_lazy_load ruby gem bundle
        # Re-run the command that triggered loading
        if [[ $# -gt 0 ]]; then
            "$@"
        fi
    }
    ruby() { _rbenv_lazy_load ruby "$@"; }
    gem() { _rbenv_lazy_load gem "$@"; }
    bundle() { _rbenv_lazy_load bundle "$@"; }
fi

# Lazy load pyenv - initialize only when python command is used
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
if command -v pyenv >/dev/null 2>&1; then
    _pyenv_lazy_load() {
        eval "$(pyenv init -)"
        unset -f _pyenv_lazy_load python python3 pip pip3
        # Re-run the command that triggered loading
        if [[ $# -gt 0 ]]; then
            "$@"
        fi
    }
    python() { _pyenv_lazy_load python "$@"; }
    python3() { _pyenv_lazy_load python3 "$@"; }
    pip() { _pyenv_lazy_load pip "$@"; }
    pip3() { _pyenv_lazy_load pip3 "$@"; }
fi


### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="${HOME}/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

# Source local environment if it exists
if [ -d "$HOME/.local/bin" ] && [ -f "$HOME/.local/bin/env" ]; then
    source "$HOME/.local/bin/env"
fi

# Lazy load Google Cloud SDK - initialize only when gcloud commands are used
_gcloud_lazy_load() {
    unset -f gcloud gsutil bq

    # Load Google Cloud SDK path
    if [ -f "$HOME/Downloads/google-cloud-sdk/path.zsh.inc" ]; then
        source "$HOME/Downloads/google-cloud-sdk/path.zsh.inc"
    elif [ -f "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc" ]; then
        source "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc"
    elif [ -f "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc" ]; then
        source "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc"
    fi

    # Load Google Cloud SDK completions
    if [ -f "$HOME/Downloads/google-cloud-sdk/completion.zsh.inc" ]; then
        source "$HOME/Downloads/google-cloud-sdk/completion.zsh.inc"
    elif [ -f "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/completion.zsh.inc" ]; then
        source "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/completion.zsh.inc"
    elif [ -f "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/completion.zsh.inc" ]; then
        source "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/completion.zsh.inc"
    fi

    unset -f _gcloud_lazy_load
}

# Check if any Google Cloud SDK installation exists before creating placeholders
if [ -f "$HOME/Downloads/google-cloud-sdk/path.zsh.inc" ] || \
   [ -f "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc" ] || \
   [ -f "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc" ]; then
    gcloud() { _gcloud_lazy_load; gcloud "$@"; }
    gsutil() { _gcloud_lazy_load; gsutil "$@"; }
    bq() { _gcloud_lazy_load; bq "$@"; }
fi

# Force command hash rebuild at the end (fixes Warp terminal command discovery)
rehash
