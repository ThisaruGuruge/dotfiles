# Default editor
export EDITOR="nvim"
export VISUAL="$EDITOR"

[ -f "$HOME/.rover/env" ] && source "$HOME/.rover/env"
[ -d "$HOME/Setup/flutter/bin" ] && export PATH="$HOME/Setup/flutter/bin:$PATH"
