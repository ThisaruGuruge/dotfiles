#!/bin/bash

# Common Commands

# Smart clear: clears terminal while preserving scrollback history
c() {
    yes "" 2>/dev/null | head -n ${LINES:-50}
    printf '\x0c'
}
alias cls="clear;ls"
alias mk="mkdir -p "
alias cp="cp -riv"
alias mv="mv -iv"
alias rm="rm -r"
alias qfind="find . -name "

alias ag='ag --silent --hidden'
alias todo='todo.sh'

alias ls='eza --icons --git'
alias ll='eza -l --icons --git --header --group'
alias la='eza -la --icons --git --header --group'
alias lt='eza --tree --level=2 --icons --git'
alias ls_x='eza -l --sort=extension --icons --git'
alias ls_k='eza -l --sort=size --icons --git'
alias ls_t='eza -l --sort=modified --icons --git'
alias ls_old='eza -l --sort=oldest --icons --git'

# Fallback to traditional ls if eza not available
if ! command -v eza &>/dev/null; then
    alias ls='ls --color=auto'
    alias ll='ls -lah'
    alias la='ls -la'
fi

# Suffix Aliases for File Types
alias -s md='bat'
alias -s json='jless'
alias -s yaml='jless'
alias -s yml='jless'

alias -s py="\$EDITOR"
alias -s sh="\$EDITOR"
alias -s bash="\$EDITOR"
alias -s zsh="\$EDITOR"
alias -s bal="\$EDITOR"

alias -s conf="\$EDITOR"
alias -s config="\$EDITOR"
alias -s ini="\$EDITOR"

alias showFiles='defaults write com.apple.finder AppleShowAllFiles YES; killall Finder /System/Library/CoreServices/Finder.app'
alias hideFiles='defaults write com.apple.finder AppleShowAllFiles NO; killall Finder /System/Library/CoreServices/Finder.app'

# Switch Java
alias use_java_17="sdk default java 17.0.11-tem"
alias use_java_21="sdk default java 21.0.5-tem"

# Mac manipulation
alias dock_add_space='defaults write com.apple.dock persistent-apps -array-add "{\"tile-type\"=\"spacer-tile\";}"; killall Dock'

# Add sudo as an alias so we can use aliases with sudo :D
alias sudo='sudo '

# Shell Configuration Management
alias reload="source ~/.zshrc"

# Edit shell configuration files
alias edit-zsh="nvim ~/.zshrc"
alias edit-aliases="nvim ~/.aliases.sh"
alias edit-functions="nvim ~/.functions.sh"
alias edit-paths="nvim ~/.paths.sh"

# Edit other configuration files
alias edit-git="nvim ~/.gitconfig"
alias edit-wezterm="nvim ~/.config/wezterm/wezterm.lua"
alias edit-nvim="nvim ~/.config/nvim/init.lua"
alias edit-vim="nvim ~/.vimrc"
alias edit-starship="nvim ~/.config/starship.toml"
alias edit-tmux="nvim ~/.tmux.conf"
alias edit-lazygit="nvim ~/.config/lazygit/config.yml"
alias edit-ripgrep="nvim ~/.config/ripgrep/config"

# Navigation
alias .="pwd"
alias ..="cd ../"
alias ...="cd ../../"
alias ....="cd ../../../"
alias .....="cd ../../../../"
alias ......="cd ../../../../../"
alias remove_empty_dirs="find . -type d | tail -r | xargs rmdir 2>/dev/null"

# Directory stack navigation
alias ds='dirs -v | head -10'
alias 1='cd -1'
alias 2='cd -2'
alias 3='cd -3'
alias 4='cd -4'
alias 5='cd -5'
alias 6='cd -6'
alias 7='cd -7'
alias 8='cd -8'
alias 9='cd -9'

# Editors
alias vi="nvim"
alias vim="nvim"
alias v="nvim"

# Devlopment
alias editHosts='sudo nvim /etc/hosts'
alias cleanupDS="find . -type f -name '*.DS_Store' -ls -delete"

# Gradle wrapper aliases
alias gw='./gradlew --max-workers=6'
alias gwcb='./gradlew clean build'
alias gwc='./gradlew clean'
alias gwt='./gradlew test'
alias gwb='./gradlew build'

# Python server
alias start_file_server='python -m SimpleHTTPServer 8000'

# Python3
alias p3='python3'

# GIT - Enhanced with modern tools
alias gits='git status'
alias gl='git pull'
alias glo='git pull origin'
alias glt='git pull thisaru'
alias gp='git push'
alias gpo='git push origin'
alias gpt='git push thisaru'
alias gb='git branch'
alias gbd='git branch -d'
alias gco='git checkout'
alias gcp='git cherry-pick'
alias ga='git add'
alias gaa='git add --all'
alias gitd='git diff'
alias gra='git remote add'
alias gitm='git commit -m '
alias gitcan="git commit --amend --no-edit"
alias git_clean_all='git clean -df; git checkout -- .'
alias gc='git clone'
alias gf='git fetch'
alias grh='git reset'
alias gr_soft='git reset --soft'
alias gr_hard='git reset --hard'

# Modern Git tools
alias lg='lazygit'
alias glog='git log --graph --pretty=format:"%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset" --abbrev-commit'
alias gunstage='git unstage'
alias gundo='git undo'
alias gamend='git amend'
alias gcleanup='git cleanup'

# Modern file viewing and search tools
if command -v bat &>/dev/null; then
    alias v='bat'
fi

if command -v rg &>/dev/null; then
    alias g='rg'
fi

# Docker shortcuts
alias dps='docker ps'
alias dpsa='docker ps -a'
alias dimg='docker images'
alias dex='docker exec -it'
alias dlog='docker logs'
alias dlogf='docker logs -f'
alias dstop='docker stop'
alias drm='docker rm'
alias drmi='docker rmi'
alias dprune='docker system prune -f'

# Network utilities
alias myip='curl -s ifconfig.me'
alias localip="ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1'"
alias ping='ping -c 5'

# Process management
alias psg='ps aux | grep'
alias top='htop'

# Modern alternatives
if command -v fd &>/dev/null; then
    alias f='fd'
fi

if command -v dust &>/dev/null; then
    alias d='dust'
fi

# Quick edit configs
alias edit_zsh='nvim ~/.zshrc'
alias edit_aliases='nvim ~/.aliases.sh'
alias edit_functions='nvim ~/.functions.sh'
alias edit_git='nvim ~/.gitconfig'
alias edit_tmux='nvim ~/.tmux.conf'

# Documentation system
alias help='alias_help'
alias docs='alias_docs'
alias aliases='alias_categories'

# Tmux shortcuts
alias t='tmux'
alias ta='tmux attach'
alias tat='tmux attach -t'
alias tn='tmux new'
alias tnt='tmux new -t'
alias tl='tmux list-sessions'
alias tk='tmux kill-session'
alias tkt='tmux kill-session -t'

# Ballerina
alias b='bal'
alias bc='bal clean'
alias bb='bal build'
alias br='bal run'
alias bv='bal -v'
alias bt='bal test'
alias btest='bal test --code-coverage'
alias btestv='bal test --code-coverage --verbose'
alias bro='bal run --offline'

# Ballerina-specific search aliases
alias grepbal='rg --type ballerina'
alias searchbal='rg --type bal'

# Atuin shell history aliases
if command -v atuin >/dev/null 2>&1; then
    alias hs='atuin search'
    alias hstats='atuin stats'
    alias hsync='atuin sync'
    alias hup='atuin up'
    alias hdown='atuin down'
fi

# Dotfiles testing
alias test-zsh='$HOME/dotfiles/bin/test-zsh-config'

# Package Management
alias brew-sync='brew bundle dump --force --describe --file=$HOME/dotfiles/Brewfile'
alias brew-sync-optional='brew bundle dump --force --describe --file=$HOME/dotfiles/Brewfile.optional'
alias brew-check='brew bundle check --file=$HOME/dotfiles/Brewfile'
alias brew-check-optional='brew bundle check --file=$HOME/dotfiles/Brewfile.optional'
