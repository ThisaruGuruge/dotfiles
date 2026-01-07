# ============================================================================
# Key Bindings
# ============================================================================
# Custom keybindings for WezTerm and general shell navigation

# Force emacs-style line editing (prevents accidental vim mode)
# This fixes the issue where Cmd/Option+arrows can trigger vim mode
bindkey -e

# History search with up/down arrows
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward

# Word navigation (Option+Left/Right sends Alt+b/Alt+f from WezTerm)
bindkey '^[b' backward-word     # Option+Left (Alt+b)
bindkey '^[f' forward-word      # Option+Right (Alt+f)

# Word deletion (Option+Backspace/Delete send Ctrl+w/Alt+d from WezTerm)
bindkey '^W' backward-kill-word # Option+Backspace (Ctrl+w)
bindkey '^[d' kill-word         # Option+Delete (Alt+d)

# Line navigation (CMD+Left/Right send Ctrl+a/Ctrl+e from WezTerm)
bindkey '^A' beginning-of-line  # CMD+Left (Ctrl+a)
bindkey '^E' end-of-line        # CMD+Right (Ctrl+e)

# Line deletion (CMD+Backspace/Delete send Ctrl+u/Ctrl+k from WezTerm)
bindkey '^U' backward-kill-line # CMD+Backspace (Ctrl+u)
bindkey '^K' kill-line          # CMD+Delete (Ctrl+k)
