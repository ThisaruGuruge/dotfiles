#!/bin/bash

# Common Commands

alias c="clear"
alias cls="clear;ls"
alias mk="mkdir -p "
alias cp="cp -riv"
alias mv="mv -iv"
alias rm="rm -r"
alias qfind="find . -name "

alias ag='ag --silent --hidden'
alias todo='todo.sh'

# Modern ls replacement with eza - Enhanced file listing with icons and git status
# Examples:
#   ls              # Basic listing with icons and git status
#   ll              # Detailed listing with headers and file info
#   la              # Show all files including hidden ones
#   lt              # Tree view (2 levels deep)
#   ls_x            # Sort by file extension
#   ls_k            # Sort by file size (largest last)
#   ls_t            # Sort by modification time (newest last)
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

alias showFiles='defaults write com.apple.finder AppleShowAllFiles YES; killall Finder /System/Library/CoreServices/Finder.app'
alias hideFiles='defaults write com.apple.finder AppleShowAllFiles NO; killall Finder /System/Library/CoreServices/Finder.app'

# Switch Java
alias use_java_17="sdk default java 17.0.11-tem"
alias use_java_21="sdk default java 21.0.5-tem"

# Mac manipulation
alias dock_add_space='defaults write com.apple.dock persistent-apps -array-add "{\"tile-type\"=\"spacer-tile\";}"; killall Dock'

# Add sudo as an alias so we can use aliases with sudo :D
alias sudo='sudo '

# Bash Customization
alias my_soc="source ~/.zshrc"
alias my_pro="vim ~/.zshrc"
alias my_ali="vim ~/.aliases.sh"
alias my_func="vim ~/.functions.sh"

alias d='dirs -v | head -10'

# Navigation
alias .="pwd"
alias ..="cd ../"
alias ...="cd ../../"
alias ....="cd ../../../"
alias .....="cd ../../../../"
alias ......="cd ../../../../../"
alias remove_empty_dirs="find . -type d | tail -r | xargs rmdir 2>/dev/null"

# Editors
alias v="vim"

# Devlopment
alias editHosts='sudo vim /etc/hosts'
alias cleanupDS="find . -type f -name '*.DS_Store' -ls -delete"

# Gradle wrapper aliases - Use ./gradlew for project builds
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

# Modern Git tools - Enhanced git workflow with visual interfaces
# Examples:
#   lg              # Open lazygit TUI for interactive git operations
#   glog            # Beautiful git log with graph and colors
#   gunstage        # Unstage files from git index
#   gundo           # Undo last commit but keep changes
#   gamend          # Amend last commit without editing message
#   gcleanup        # Remove merged branches automatically
alias lg='lazygit'
alias glog='git lg'
alias gunstage='git unstage'
alias gundo='git undo'
alias gamend='git amend'
alias gcleanup='git cleanup'

# Enhanced file viewing - Syntax highlighting and better output
# Examples:
#   cat file.js     # View JavaScript file with syntax highlighting
#   less README.md  # Page through markdown with highlighting
#   grep "TODO"     # Fast search with ripgrep (much faster than traditional grep)
alias cat='bat'
alias less='bat'
alias grep='rg'

# Fallback to traditional tools if modern ones not available
if ! command -v bat &>/dev/null; then
    alias cat='cat'
    alias less='less'
fi

if ! command -v rg &>/dev/null; then
    alias grep='grep --color=auto'
fi

# Docker shortcuts - Container and image management
# Examples:
#   dps             # Show running containers
#   dpsa            # Show all containers (including stopped)
#   dex mycontainer # Execute interactive shell in container
#   dlog mycontainer# View container logs
#   dlogf mycontainer# Follow container logs in real-time
#   dprune          # Clean up unused containers, networks, images
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

# Network utilities - Quick network information and testing
# Examples:
#   myip            # Get your public IP address
#   localip         # Get your local network IP
#   ping google.com # Ping with 5 packets limit
alias myip='curl -s ifconfig.me'
alias localip="ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1'"
alias ping='ping -c 5'

# Process management - Enhanced process viewing and searching
# Examples:
#   psg node        # Find all processes containing "node"
#   top             # Interactive process viewer (htop with colors and tree view)
alias psg='ps aux | grep'
alias top='htop'

# Modern alternatives - Faster and more feature-rich replacements
# Examples:
#   find . -name "*.js"    # Fast file search with fd (much faster than traditional find)
#   du -h                  # Disk usage with visual tree (dust)
#   df -h                  # Disk free space with colors (duf)
alias find='fd'
alias du='dust'
alias df='duf'

# Quick edit configs
alias edit_zsh='vim ~/.zshrc'
alias edit_aliases='vim ~/.aliases.sh'
alias edit_functions='vim ~/.functions.sh'
alias edit_git='vim ~/.gitconfig'
alias edit_tmux='vim ~/.tmux.conf'

# Documentation system - Quick access to alias help
# Examples:
#   help                # Show documentation system usage
#   help git            # Show all git aliases with examples
#   help ll             # Show file listing alias help
#   docs                # Interactive alias browser
#   aliases             # Show aliases organized by category
alias help='alias_help'
alias docs='alias_docs'
alias aliases='alias_categories'

# Tmux shortcuts - Terminal multiplexer session management
# Examples:
#   t               # Start new tmux session
#   ta              # Attach to last session
#   tat work        # Attach to session named "work"
#   tn              # Create new session
#   tnt project     # Create new session named "project"
#   tl              # List all sessions
#   tk              # Kill current session
#   tkt work        # Kill session named "work"
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
alias bro='bal run --offline'

# Ballerina-specific search aliases
alias grepbal='rg --type ballerina'
alias searchbal='rg --type bal'

# Atuin shell history aliases - Enhanced command history with sync and search
# Examples:
#   hs              # Interactive history search
#   hstats          # Show command statistics
#   hsync           # Sync history to atuin server (if configured)
if command -v atuin >/dev/null 2>&1; then
    alias hs='atuin search'
    alias hstats='atuin stats'
    alias hsync='atuin sync'
    alias hup='atuin up'
    alias hdown='atuin down'
fi

# Dotfiles testing
alias test-zsh='$HOME/dotfiles/bin/test-zsh-config'
