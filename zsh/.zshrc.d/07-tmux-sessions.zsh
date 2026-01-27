# ============================================================================
# TMux Auto Project Sessions
# ============================================================================
# Automatically create/switch to project sessions when entering:
#   - Git repository roots (directories containing .git)
#   - Pre-configured directories listed in ~/.tmux-directories

# Only load if tmux is available
command -v tmux &>/dev/null || return

# Config file for pre-configured directories (one path per line)
TMUX_DIRECTORIES_FILE="${TMUX_DIRECTORIES_FILE:-$HOME/.tmux-directories}"

# Check if current directory should trigger a tmux session
function _is_tmux_project_directory() {
    # Check 1: Is this a git repo root?
    [[ -d ".git" ]] && return 0

    # Check 2: Is this in the pre-configured directories file?
    if [[ -f "$TMUX_DIRECTORIES_FILE" ]]; then
        local dir
        while IFS= read -r dir || [[ -n "$dir" ]]; do
            # Skip empty lines and comments
            [[ -z "$dir" || "$dir" == \#* ]] && continue
            # Expand ~ to home directory
            dir="${dir/#\~/$HOME}"
            # Check if current directory matches (exact match)
            [[ "$PWD" == "$dir" ]] && return 0
        done < "$TMUX_DIRECTORIES_FILE"
    fi

    return 1
}

# Function to auto-switch to project session on cd
function _tmux_auto_project_session() {
    # Only run if inside tmux
    [[ -z "$TMUX" ]] && return

    # Check if this directory should trigger a session
    _is_tmux_project_directory || return

    # Get project name from directory (sanitize for tmux session name)
    # Replace dots with dashes (tmux doesn't like dots in session names)
    local project_name=$(basename "$PWD" | tr '.' '-')
    local current_session=$(tmux display-message -p '#S')

    # Don't switch if already in a session for this project
    [[ "$current_session" == "$project_name" ]] && return

    # Switch to existing session or create new one
    if tmux has-session -t "=$project_name" 2>/dev/null; then
        tmux switch-client -t "=$project_name"
    else
        # Create new session for this project (detached), then switch
        tmux new-session -d -s "$project_name" -c "$PWD"
        tmux switch-client -t "$project_name"
    fi
}

# Register the hook to run after every directory change
autoload -U add-zsh-hook
add-zsh-hook chpwd _tmux_auto_project_session

# Also check on shell startup (in case terminal opens directly in a project)
_tmux_auto_project_session
