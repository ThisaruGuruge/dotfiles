# ============================================================================
# History and Directory Navigation
# ============================================================================
# Configure shell history and directory stack behavior

# History configuration
HISTSIZE=5000
HISTFILE=~/.zsh_history
export SAVEHIST=$HISTSIZE
export HISTDUP=erase
setopt appendhistory # Append history to the history file
setopt sharehistory # Share history between all sessions
setopt hist_ignore_space # Ignore leading spaces when saving history
setopt hist_ignore_all_dups # Delete old recorded entry if new entry is a duplicate
setopt hist_save_no_dups # Do not save duplicates in history
setopt hist_ignore_dups # Do not save duplicates in history
setopt hist_find_no_dups # Do not display duplicates in history search
setopt correct # Enable auto correction
setopt no_correct_all # Don't correct arguments, only commands

# Disable autocorrect for specific commands
CORRECT_IGNORE_FILE=".*"

# Directory navigation - AUTO_CD and directory stack
setopt AUTO_CD              # Type directory name to cd into it (no 'cd' needed)
setopt AUTO_PUSHD           # Automatically push directories to stack when cd'ing
setopt PUSHD_IGNORE_DUPS    # Don't push duplicate directories onto stack
setopt PUSHD_SILENT         # Don't print directory stack after pushd/popd
setopt PUSHD_MINUS          # Swap meaning of +/- for directory stack navigation
