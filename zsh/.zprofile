emulate sh
[ -f ~/.profile ] && source ~/.profile
emulate zsh

eval "$(/opt/homebrew/bin/brew shellenv)"


# Added by Toolbox App
export PATH="$PATH:/usr/local/bin"

eval export HOMEBREW_PREFIX="/opt/homebrew";
export HOMEBREW_CELLAR="/opt/homebrew/Cellar";
export HOMEBREW_REPOSITORY="/opt/homebrew";
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}";
export MANPATH="/opt/homebrew/share/man${MANPATH+:$MANPATH}:";
export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}";
