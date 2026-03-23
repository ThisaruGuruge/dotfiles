# Default editor
export EDITOR="nvim"
export VISUAL="$EDITOR"

[ -f "$HOME/.rover/env" ] && source "$HOME/.rover/env"
[ -d "$HOME/Setup/flutter/bin" ] && export PATH="$HOME/Setup/flutter/bin:$PATH"

# NVM - make node/npm/npx available in non-interactive shells (e.g. Claude Code agents)
# Resolves the nvm default alias to the correct installed version path
export NVM_DIR="$HOME/.nvm"
if [ -f "$NVM_DIR/alias/default" ] && [ -d "$NVM_DIR/versions/node" ]; then
    _nvm_ver=$(cat "$NVM_DIR/alias/default")
    # Resolve one level of alias indirection (e.g., "lts/*" -> "22.x.x")
    [ -f "$NVM_DIR/alias/$_nvm_ver" ] && _nvm_ver=$(cat "$NVM_DIR/alias/$_nvm_ver")
    # Find the matching installed version using semantic version sort
    _nvm_node=$(ls -d "$NVM_DIR/versions/node/v${_nvm_ver}"* 2>/dev/null | sort -V | tail -1)
    [ -d "$_nvm_node/bin" ] && export PATH="$_nvm_node/bin:$PATH"
    unset _nvm_ver _nvm_node
fi
