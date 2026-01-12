#!/bin/zsh
# ============================================================================
# Modular ZSH Configuration
# ============================================================================
# Main configuration file that sources modular components from .zshrc.d/
#
# Structure:
#   01-plugins.zsh         - Zinit plugin manager and ZSH plugins
#   02-completion.zsh      - Completion system and tool integrations
#   03-keybindings.zsh     - Custom keybindings for navigation
#   04-history.zsh         - History and directory navigation settings
#   05-shell-integrations.zsh - Modern CLI tools (fzf, zoxide, atuin, direnv)
#   06-environment.zsh     - Environment variables and personal configs

# ============================================================================
# IDE Context Detection
# ============================================================================

_is_ide_context() {
  # VS Code Ballerina extension env probes
  if [[ -n "$ZSH_EXECUTION_STRING" ]] && \
     [[ "$ZSH_EXECUTION_STRING" == *"source ~/.zshrc"* ]] && \
     [[ "$ZSH_EXECUTION_STRING" == *"env"* ]] && \
     [[ ! -t 1 ]]; then
    return 0
  fi

  # VS Code integrated terminal
  [[ "$TERM_PROGRAM" == "vscode" ]] && return 0

  # VS Code shell integration
  [[ -n "$VSCODE_INJECTION" ]] && return 0

  # Other IDEs (IntelliJ, etc.)
  [[ -n "$INTELLIJ_ENVIRONMENT_READER" ]] && return 0

  return 1
}

if _is_ide_context; then
  export DOTFILES_FAST_ENV=1
  [ -f "$HOME/.paths.sh" ] && source "$HOME/.paths.sh"
  [ -f "$HOME/.env" ] && source "$HOME/.env"
  unset DOTFILES_FAST_ENV
  return 0 2>/dev/null || exit 0
fi

# ============================================================================
# Core Initialization
# ============================================================================

if [ -x "/opt/homebrew/bin/brew" ]; then
    # Check if cache exists and is valid (less than 24 hours old)
    # (#qNmh-24) is a zsh glob qualifier for "modified less than 24 hours ago"
    setopt extendedglob
    if [[ -r "${HOME}/.cache/zsh/brew_shellenv.zsh"(#qNmh-24) ]]; then
        source "${HOME}/.cache/zsh/brew_shellenv.zsh"
    else
        mkdir -p "${HOME}/.cache/zsh"
        /opt/homebrew/bin/brew shellenv > "${HOME}/.cache/zsh/brew_shellenv.zsh"
        source "${HOME}/.cache/zsh/brew_shellenv.zsh"
    fi
fi

if command -v starship >/dev/null 2>&1; then
  export STARSHIP_CONFIG="$HOME/.config/starship.toml"
  eval "$(starship init zsh)"
fi

# ============================================================================
# Load Modular Configuration
# ============================================================================

ZSHRC_DIR="${${(%):-%x}:A:h}"

fpath=("$ZSHRC_DIR/completions" $fpath)

for config_file in "$ZSHRC_DIR"/.zshrc.d/*.zsh(N); do
    source "$config_file"
done

# ============================================================================
# Terminal-Specific Enhancements
# ============================================================================

# Warp-style bottom prompt - push prompt to bottom on new shell
if [[ -o interactive ]] && [[ -t 1 ]]; then
    # Calculate lines needed (terminal height - 1 for the prompt itself)
    local lines_to_bottom=$((LINES - 1))
    # Output newlines to push prompt to bottom
    yes "" 2>/dev/null | head -n "$lines_to_bottom"
fi

### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)
export PATH="$HOME/.rd/bin:$PATH"
### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)
