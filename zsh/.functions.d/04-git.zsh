#!/bin/zsh
# ============================================================================
# Git Functions
# ============================================================================
# Git helper utilities: git_ignore_local()

git_ignore_local() {
    if [ -z "$1" ]; then
        echo "Usage: git_ignore_local <file>"
        return 1
    fi

    local repo_root
    repo_root=$(git rev-parse --show-toplevel 2>/dev/null)

    if [ -z "$repo_root" ]; then
        echo "Not inside a Git repository."
        return 1
    fi

    echo "$1" >>"$repo_root/.git/info/exclude"
    echo "Added '$1' to $repo_root/.git/info/exclude"
}
