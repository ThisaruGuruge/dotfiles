#!/bin/zsh

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
alias rm="rm -rI"
alias qfind="find . -name "

alias todo='todo.sh'

if (( $+commands[eza] )); then
    alias ls='eza --icons --git'
    alias ll='eza -l --icons --git --header --no-user'
    alias la='eza -la --icons --git --header --group'
    alias lt='eza --tree --level=2 --icons --git'
    alias ls-ext='eza -l --sort=extension --icons --git'
    alias ls-size='eza -l --sort=size --icons --git'
    alias ls-time='eza -l --sort=modified --icons --git'
    alias ls-old='eza -l --sort=oldest --icons --git'
    alias tree='eza --tree --icons --git'
else
    alias ls='ls --color=auto'
    alias ll='ls -lah'
    alias la='ls -la'
fi

# Suffix Aliases for File Types
alias -s md='glow -p'
alias -s markdown='glow -p'
alias -s mdx='glow -p'
alias -s json='jless'
alias -s yaml='jless'
alias -s yml='jless'

alias -s py="\$EDITOR"
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
alias edit-functions="nvim ~/.functions.d/"
alias edit-paths="nvim ~/.paths.sh"

# Edit other configuration files
alias edit-git="nvim ~/.config/git/config"
alias edit-wezterm="nvim ~/.config/wezterm/wezterm.lua"
alias edit-nvim="nvim ~/.config/nvim/init.lua"
alias edit-vim="nvim ~/.vimrc"
alias edit-p10k="nvim ~/.p10k.zsh"
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
alias vim="nvim"
alias n="nvim"

# Devlopment
alias editHosts='sudo nvim /etc/hosts'
alias cleanupDS="find . -type f -name '*.DS_Store' -ls -delete"

# Gradle aliases (gw = GNG: finds gradlew anywhere up the directory tree)
alias gwb='gw build'
alias gwc='gw clean'
alias gwt='gw test'
alias gwcb='gw clean build'

# Python server
alias start_file_server='python3 -m http.server 8000'

# Python3
alias p3='python3'

# GIT - Standardized g* prefix convention

# Core
# gs is a function in .functions.d/04-git.zsh
alias gd='git diff'
alias gds='git diff --staged'
alias gm='git commit -m'
alias gci='git commit'
alias gca='git commit --amend --no-edit'
alias ga='git add'
alias gaa='git add --all'

# Branches
alias gb='git branch'
alias gbd='git branch -d'
alias gco='git checkout'
alias gsw='git switch'
alias gswc='git switch -c'

# Remote
alias gl='git pull'
alias glo='git pull origin'
alias glt='git pull thisaru'
alias gp='git push'
alias gpo='git push origin'
alias gpt='git push thisaru'
alias gf='git fetch'
alias gra='git remote add'
alias gc='git clone'

# History & inspection
alias glog='git log --graph --pretty=custom --abbrev-commit'
alias glast='git show HEAD'
alias gbl='git blame'
alias gcp='git cherry-pick'

# Reset
alias gr='git reset'
alias grs='git reset --soft'

# Stash
alias gst='git stash'
alias gstp='git stash pop'
alias gstl='git stash list'

# Tools
alias lg='lazygit'
alias gunstage='git unstage'
alias gundo='git undo'
alias gcleanup='git cleanup'

# Dangerous commands (with confirmation)
function grh() {
    echo "\e[31mReset --hard to: ${1:-HEAD}\e[0m"
    echo "This will DISCARD all uncommitted changes."
    read -q "?Continue? [y/N] " && echo && git reset --hard "$@" || echo
}

function gcla() {
    echo "\e[31mThis will DELETE all untracked files and DISCARD all modifications.\e[0m"
    read -q "?Continue? [y/N] " && echo && git clean -df && git checkout -- . || echo
}

# Deprecated aliases (runtime warnings — use new g* names)
function gits() {
    echo "\e[33m[deprecated] use 'gs' instead of 'gits'\e[0m"
    git status "$@"
}

function gitd() {
    echo "\e[33m[deprecated] use 'gd' instead of 'gitd'\e[0m"
    git diff "$@"
}

function gitm() {
    echo "\e[33m[deprecated] use 'gm' instead of 'gitm'\e[0m"
    git commit -m "$@"
}

function gitcan() {
    echo "\e[33m[deprecated] use 'gca' instead of 'gitcan'\e[0m"
    git commit --amend --no-edit "$@"
}

function gr_soft() {
    echo "\e[33m[deprecated] use 'grs' instead of 'gr_soft'\e[0m"
    git reset --soft "$@"
}

function gr_hard() {
    echo "\e[33m[deprecated] use 'grh' instead of 'gr_hard'\e[0m"
    grh "$@"
}

function git_clean_all() {
    echo "\e[33m[deprecated] use 'gcla' instead of 'git_clean_all'\e[0m"
    gcla "$@"
}

# Modern file viewing and search tools
if (( $+commands[bat] )); then
    v() {
        if (( $+commands[glow] )); then
            case "${1##*.}" in
                md|markdown|mdx) glow -p "$@"; return ;;
            esac
        fi
        bat "$@"
    }
fi

if (( $+commands[glow] )); then
    alias md='glow -p'
    # View README in current directory
    readme() {
        local file
        file=$(find . -maxdepth 1 -iname 'readme*' -type f 2>/dev/null | head -1)
        if [[ -n "$file" ]]; then
            glow -p "$file"
        else
            echo "No README found in current directory"
            return 1
        fi
    }
    # Browse markdown files with fzf preview
    mdp() {
        if ! command -v fzf &>/dev/null; then
            echo "fzf required for mdp"
            return 1
        fi
        local file
        file=$(fd -e md -e markdown -e mdx 2>/dev/null | fzf --preview 'glow -s dark {}' --preview-window=right:60%)
        [[ -n "$file" ]] && glow -p "$file"
    }
fi

if (( $+commands[rg] )); then
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
alias lzd='lazydocker'

# Network utilities
alias myip='curl -s ifconfig.me'
alias localip="ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1'"
alias ping='ping -c 5'

# Process management
alias psg='ps aux | grep'
alias top='htop'

# Modern alternatives
if (( $+commands[fd] )); then
    alias f='fd'                            # regex search
    alias fdg='fd -g'                       # glob search (e.g. fdg "*.json")
    alias fdh='fd --hidden'                 # include hidden files
    alias fda='fd --hidden --no-ignore'     # include hidden + gitignored files
fi

if (( $+commands[rg] )); then
    alias rgh='rg --hidden'                 # search including hidden files
    alias rga='rg --hidden --no-ignore'     # search everything (no filters)
fi

if (( $+commands[dust] )); then
    alias d='dust'
fi


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

# Brew update all
alias brew_update='brew update && brew upgrade && brew cleanup --prune=all'

# Atuin shell history aliases
if (( $+commands[atuin] )); then
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

# Claude Code account switching
alias ccp='CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude'
alias cce='CLAUDE_CONFIG_DIR="$HOME/.claude-enterprise" claude'
alias ccpr='CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude --resume'
alias ccer='CLAUDE_CONFIG_DIR="$HOME/.claude-enterprise" claude --resume'
alias ccpc='CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude --continue'
alias ccec='CLAUDE_CONFIG_DIR="$HOME/.claude-enterprise" claude --continue'
