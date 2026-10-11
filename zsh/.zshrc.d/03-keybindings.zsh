# ============================================================================
# Key Bindings
# ============================================================================
# Custom keybindings for Ghostty and general shell navigation

# Force emacs-style line editing (prevents accidental vim mode)
# This fixes the issue where Cmd/Option+arrows can trigger vim mode
bindkey -e

# History search with up/down arrows
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward

# Word navigation (Ghostty sends Option+Left/Right as ESC b / ESC f via explicit keybinds)
bindkey '^[b' backward-word     # Option+Left (Alt+b)
bindkey '^[f' forward-word      # Option+Right (Alt+f)

# Word deletion (Option+Backspace/Delete send Ctrl+w/Alt+d from Ghostty)
bindkey '^W' backward-kill-word # Option+Backspace (Ctrl+w)
bindkey '^[d' kill-word         # Option+Delete (Alt+d)

# Line navigation (Cmd+Left/Right are sent by Ghostty as Home/End, ESC [ H / ESC [ F,
# not Ctrl+a/Ctrl+e: a raw Ctrl+a would be eaten as the tmux prefix).
# Ctrl+a / Ctrl+e still work from the keyboard outside tmux's prefix handling.
bindkey '^A' beginning-of-line  # Ctrl+a
bindkey '^E' end-of-line        # Ctrl+e

# Line deletion
# Cmd+Backspace sends Ctrl+u. Cmd+Delete sends ESC k (Alt+k) rather than Ctrl+k,
# because tmux's root Ctrl+k (pane navigation) would swallow it before zsh sees it.
bindkey '^U' backward-kill-line # Cmd+Backspace (Ctrl+u)
bindkey '^[k' kill-line         # Cmd+Delete (Alt+k, from Ghostty)
bindkey '^K' kill-line          # Ctrl+k on the keyboard (outside tmux panes)
