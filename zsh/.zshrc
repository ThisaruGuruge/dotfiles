#!/bin/zsh
# ============================================================================
# ZSH Configuration - Main Entry Point
# ============================================================================
# This file sources modular configs from .zshrc.d/ in order

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

if command -v tmux &>/dev/null && \
   [[ -z "$TMUX" ]] && \
   [[ -z "$VSCODE_INJECTION" ]] && \
   [[ "$TERM_PROGRAM" != "vscode" ]] && \
   [[ -z "$INTELLIJ_ENVIRONMENT_READER" ]] && \
   [[ -z "$TERMINAL_EMULATOR" ]] && \
   [[ $- == *i* ]] && \
   [[ -z "$SSH_CONNECTION" ]]; then
    # Try to attach to existing session named 'main', or create it
    tmux attach-session -t main 2>/dev/null || tmux new-session -s main
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
