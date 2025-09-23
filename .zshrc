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
zinit snippet OMZP::command-not-found

# command not found config
HB_CNF_HANDLER="$(brew --repository)/Library/Taps/homebrew/homebrew-command-not-found/handler.sh"
if [ -f "$HB_CNF_HANDLER" ]; then
source "$HB_CNF_HANDLER";
fi

# Load completions
autoload -Uz compinit && compinit

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

# source the personal configs
source /Users/thisaru/.aliases.sh
source /Users/thisaru/.functions.sh
source /Users/thisaru/.paths.sh
# source /Users/thisaru/.variables.sh
source /Users/thisaru/.env

# Docker settings
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Homebrew settings
HOMEBREW_AUTO_UPDATE_SECS=86400
eval "$(rbenv init - zsh)"
export PATH="/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.0.0/bin:$PATH"

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="/Users/thisaru/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)

source "$HOME/.local/bin/env"
