emulate sh
[ -f ~/.profile ] && source ~/.profile
emulate zsh

# Homebrew environment (hardcoded for performance - no eval needed)
export HOMEBREW_PREFIX="/opt/homebrew"
export HOMEBREW_CELLAR="/opt/homebrew/Cellar"
export HOMEBREW_REPOSITORY="/opt/homebrew"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}"
export MANPATH="/opt/homebrew/share/man${MANPATH+:$MANPATH}:"
export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}"

# Added by Toolbox App
export PATH="$PATH:/usr/local/bin"
