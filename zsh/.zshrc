#!/bin/zsh
# ============================================================================
# ZSH Configuration - Main Entry Point
# ============================================================================
# This file sources modular configs from .zshrc.d/ in order

# ============================================================================
# IDE Context Detection (Fast Path)
# ============================================================================
# Detect when IDEs probe for environment variables (e.g., VS Code Ballerina
# extension runs: zsh -i -c "source ~/.zshrc; env"). In these cases, skip
# heavy initialization and only source essential environment files.

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
# TMux Auto-Start (Conditional)
# ============================================================================
# Automatically attach to or create a tmux session when opening a terminal
# Conditions to skip:
#   - Already inside tmux
#   - Inside VS Code integrated terminal
#   - Inside IntelliJ/JetBrains terminal
#   - Non-interactive shell
#   - SSH session (let user decide on remote)
#   - No TTY attached (e.g., IDE env detection via "zsh -i -c env")

if command -v tmux &>/dev/null && \
   [[ -z "$TMUX" ]] && \
   [[ -z "$VSCODE_INJECTION" ]] && \
   [[ "$TERM_PROGRAM" != "vscode" ]] && \
   [[ -z "$INTELLIJ_ENVIRONMENT_READER" ]] && \
   [[ -z "$TERMINAL_EMULATOR" ]] && \
   [[ $- == *i* ]] && \
   [[ -z "$SSH_CONNECTION" ]] && \
   [[ -t 0 ]]; then
    # Use session groups: each terminal gets independent window selection
    # but shares windows with the 'main' group
    if tmux has-session -t main 2>/dev/null; then
        # Create a grouped session (shares windows, independent view)
        tmux new-session -t main
    else
        # First terminal: create the main session
        tmux new-session -s main
    fi
fi

# ============================================================================
# Source Modular Configs
# ============================================================================
# Files in .zshrc.d/ are sourced in alphabetical order (numbered for control)


for config_file in "$HOME/.zshrc.d/"*.zsh(N); do
    source "$config_file"
done

# ============================================================================
# Prompt Initialization (Starship)
# ============================================================================
# Initialize starship prompt at the end for proper integration

if command -v starship &>/dev/null; then
    eval "$(starship init zsh)"
fi
