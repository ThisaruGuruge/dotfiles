emulate sh
[ -f ~/.profile ] && source ~/.profile
emulate zsh

# Homebrew environment (static exports for performance - no `brew shellenv`
# eval). Apple Silicon installs to /opt/homebrew, Intel to /usr/local; the
# rest of the config uses $HOMEBREW_PREFIX.
if [[ -x /opt/homebrew/bin/brew ]]; then
    export HOMEBREW_PREFIX="/opt/homebrew"
    export HOMEBREW_REPOSITORY="/opt/homebrew"
elif [[ -x /usr/local/bin/brew ]]; then
    export HOMEBREW_PREFIX="/usr/local"
    export HOMEBREW_REPOSITORY="/usr/local/Homebrew"
fi
if [[ -n "$HOMEBREW_PREFIX" ]]; then
    export HOMEBREW_CELLAR="$HOMEBREW_PREFIX/Cellar"
    export PATH="$HOMEBREW_PREFIX/bin:$HOMEBREW_PREFIX/sbin${PATH+:$PATH}"
    export MANPATH="$HOMEBREW_PREFIX/share/man${MANPATH+:$MANPATH}:"
    export INFOPATH="$HOMEBREW_PREFIX/share/info:${INFOPATH:-}"
fi

# XDG paths are exported from .zshenv.

# Added by Toolbox App
export PATH="$PATH:/usr/local/bin"

# Login shells: /etc/zprofile (path_helper) and the Homebrew PATH above push
# Homebrew's node in front of the nvm default that .zshenv already put first.
# Move the nvm default's bin back to the front.
if [[ -n "$NVM_DEFAULT_BIN" && -d "$NVM_DEFAULT_BIN" ]]; then
    path=("$NVM_DEFAULT_BIN" $path)
fi
