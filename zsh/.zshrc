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
  eval "$(oh-my-posh init zsh --config $HOME/.config/ohmyposh/zen.json)"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# ZSH Plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab

# Add in snippets
zinit snippet OMZP::gradle
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

# Shell integrations
eval "$(fzf --zsh)"
eval "$(zoxide init --cmd cd zsh)"

# direnv integration (load project-specific environments)
if command -v direnv >/dev/null 2>&1; then
    eval "$(direnv hook zsh)"
fi

# atuin integration (enhanced shell history with sync and search)
# Note: Disabled Ctrl+R override to avoid conflicts with Warp's native history
if command -v atuin >/dev/null 2>&1; then
    eval "$(atuin init zsh --disable-up-arrow --disable-ctrl-r)"

    # Bind Ctrl+Alt+R to Atuin search (avoid Warp conflicts)
    bindkey '^[^R' _atuin_search_widget
fi

# source the personal configs
source "$HOME/.aliases.sh"
source "$HOME/.functions.sh"
source "$HOME/.paths.sh"
# source "$HOME/.variables.sh"  # File doesn't exist
source "$HOME/.env"

# Docker settings
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Ripgrep configuration
export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"

# Homebrew settings
HOMEBREW_AUTO_UPDATE_SECS=86400
eval "$(rbenv init - zsh)"
export PATH="/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.0.0/bin:$PATH"

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
if [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]]; then
    # Load SDKMAN quietly to avoid function errors during startup
    source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
fi
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="/Users/thisaru/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

source "$HOME/.local/bin/env"
