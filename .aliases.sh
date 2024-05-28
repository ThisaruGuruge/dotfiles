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

alias ls='ls --color'
alias ls_x='ls -lXB'         #  Sort by extension.
alias ls_k='ls -lSr'         #  Sort by size, biggest last.
alias ls_t='ls -ltr'         #  Sort by date, most recent last.
alias ls_c='ls -ltcr'        #  Sort by/show change time,most recent last.
alias ls_u='ls -ltur'        #  Sort by/show access time,most recent last.
alias ll='ls -lah '

alias showFiles='defaults write com.apple.finder AppleShowAllFiles YES; killall Finder /System/Library/CoreServices/Finder.app'
alias hideFiles='defaults write com.apple.finder AppleShowAllFiles NO; killall Finder /System/Library/CoreServices/Finder.app'


# Switch Java
alias switchJava='f(){ export JAVA_HOME=`/usr/libexec/java_home -v $1` };f'

# Mac manipulation
alias dock_add_space="defaults write com.apple.dock persistent-apps -array-add '{"tile-type"="spacer-tile";}'; killall Dock"

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

# Gradle
alias gw='gw --max-workers=6'
alias gwcb='gw clean build'
alias gwc='gw clean'
alias gwt='gw test'
alias gwb='gw build'

# Python server
alias start_file_server='python -m SimpleHTTPServer 8000'

# Python3
alias p3='python3'

# GIT
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
alias gd='git diff'
alias grh='git reset'
alias gitm='git commit -m '
alias git_clean_all='git clean -df; git checkout -- .'

# Ballerina
alias b='bal'
alias bc='bal clean'
alias bb='bal build'
alias br='bal run'
alias bv='bal -v'
alias bt='bal test'
alias bro='bal run --offline'
