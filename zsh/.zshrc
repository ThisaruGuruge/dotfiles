eval "$(/opt/homebrew/bin/brew shellenv)"

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
   mkdir -p "$(dirname $ZINIT_HOME)"
   git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Initialize oh-my-posh except for Apple Terminal
if [ "$TERM_PROGRAM" != "Apple_Terminal" ]; then
  # Use faster oh-my-posh initialization
  eval "$(oh-my-posh init zsh --config $HOME/.config/ohmyposh/zen.json --print)"
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
zinit snippet OMZP::gradle

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
  # Remove problematic old Intel Homebrew path
  FPATH="${FPATH//\/usr\/local\/share\/zsh\/site-functions:/}"
fi

# Load completions with error suppression for missing files
autoload -Uz compinit && compinit -i

# NVM configuration
export NVM_DIR="$HOME/.nvm"
  [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"  # This loads nvm
  [ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

zinit cdreplay -q

# keybindings
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward

# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory # Append history to the history file
setopt sharehistory # Share history between all sessions
setopt hist_ignore_space # Ignore leading spaces when saving history
setopt hist_ignore_all_dups # Delete old recorded entry if new entry is a duplicate
setopt hist_save_no_dups # Do not save duplicates in history
setopt hist_ignore_dups # Do not save duplicates in history
setopt hist_find_no_dups # Do not display duplicates in history search
setopt correct # Enable auto correction

# Completion styling
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

# Bash style jumps
autoload -U select-word-style
select-word-style bash

# Shell integrations with lazy loading for performance

# Lazy load fzf - initialize only when first used
if command -v fzf >/dev/null 2>&1; then
    _fzf_lazy_load() {
        # Load fzf more efficiently
        eval "$(fzf --zsh)"
        unset -f _fzf_lazy_load fzf
        # Re-bind Ctrl-R and Ctrl-T immediately after loading
        bindkey '^R' fzf-history-widget
        bindkey '^T' fzf-file-widget
        bindkey '\ec' fzf-cd-widget
        # Re-run the command that triggered loading
        if [[ $# -gt 0 ]]; then
            "$@"
        fi
    }
    # Create lightweight placeholder functions
    fzf() { _fzf_lazy_load; fzf "$@"; }
    # Set up key bindings that trigger lazy loading
    bindkey '^R' '_fzf_lazy_load'
    bindkey '^T' '_fzf_lazy_load'
    bindkey '\ec' '_fzf_lazy_load'
else
    # Provide fallback if fzf not available
    fzf() { echo "fzf not installed"; return 1; }
fi

# Lazy load zoxide - initialize only when cd is used
if command -v zoxide >/dev/null 2>&1; then
    _zoxide_lazy_load() {
        eval "$(zoxide init --cmd cd zsh)"
        unset -f _zoxide_lazy_load cd
        # Re-run the cd command that triggered loading
        cd "$@"
    }
    cd() { _zoxide_lazy_load "$@"; }
else
    # Keep builtin cd if zoxide not available
    cd() { builtin cd "$@"; }
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

# Load environment variables (supports both encrypted and plaintext .env)
if [ -f "$HOME/.env" ]; then
    # Check if file is encrypted (starts with #ENC)
    if head -1 "$HOME/.env" | grep -q "^#ENC\["; then
        # Encrypted - decrypt and source
        if command -v sops >/dev/null 2>&1; then
            if sops_output=$(sops -d "$HOME/.env" 2>/dev/null); then
                eval "$sops_output"
            else
                echo "Warning: Failed to decrypt $HOME/.env - check your SOPS/age configuration" >&2
            fi
        else
            echo "Warning: SOPS not available - cannot decrypt $HOME/.env" >&2
        fi
    else
        # Plaintext - source directly
        source "$HOME/.env"
    fi
fi

# Docker settings
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Ripgrep configuration
export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"

# Homebrew settings
HOMEBREW_AUTO_UPDATE_SECS=86400

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

# SDKMAN lazy loading - only load when Java commands are used
export SDKMAN_DIR="$HOME/.sdkman"
if [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
    # Lazy load SDKMAN - initialize only when sdk command is used
    _sdkman_lazy_load() {
        source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
        unset -f _sdkman_lazy_load sdk
        # Re-run the command that triggered loading
        if [[ $# -gt 0 ]]; then
            sdk "$@"
        fi
    }
    sdk() { _sdkman_lazy_load sdk "$@"; }
fi

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="$HOME/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

# Source local environment if it exists
[ -f "$HOME/.local/bin/env" ] && source "$HOME/.local/bin/env" || true
