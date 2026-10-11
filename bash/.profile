[ -f "$HOME/.rover/env" ] && source "$HOME/.rover/env"
# Guarded (and an if-block so a missing file leaves a zero exit status): an
# unguarded `. missing` aborted every non-interactive login zsh/bash.
if [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
fi
