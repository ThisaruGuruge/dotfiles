# Common Commands

alias c="clear"
alias cls="clear;ls"
alias mk="mkdir -p "
alias cp="cp -riv"
alias mv="mv -iv"
alias rm="rm -r"
alias qfind="find . -name "

alias ag='ag --silent --hidden'

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
# alias sudo='sudo '

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
alias graphql_repo="cd /Users/thisaru/Projects/Ballerina/module-ballerina-graphql"
alias ballerina_repos="cd /Users/thisaru/Projects/Ballerina"

# Editors
alias v="vim"

# Devlopment
alias editHosts='sudo vim /etc/hosts'
alias cleanupDS="find . -type f -name '*.DS_Store' -ls -delete"

# Build
alias clean_npm='git clean -fxd'

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
alias git_pom='git push origin master'
alias gita='git add '
alias gitd='git diff'
alias gitm='git commit -m '
alias git_clean_all='git clean -df; git checkout -- .'
alias gacp='python3 /Users/thisaru/Projects/Scripts/git/commit_and_push_all.py '

# Ballerina
alias b='bal'
alias bc='bal clean'
alias bb='bal build'
alias br='bal run'
alias bv='bal -v'
alias bt='bal test'
alias bro='bal run --offline'
