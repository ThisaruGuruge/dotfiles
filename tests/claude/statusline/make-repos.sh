#!/bin/bash
# Builds the git repos the claude-statusline golden cases run in, under $1 (an empty directory).
# Commits use fixed names and dates and no user/system git config, so their hashes are the same
# on every machine (the detached-HEAD case prints one).
set -eu

root=$1
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export GIT_AUTHOR_DATE='2026-01-01T00:00:00Z' GIT_COMMITTER_DATE='2026-01-01T00:00:00Z'

new_repo() {
    git init -q -b main "$1"
    printf 'one\n' >"$1/a.txt"
    printf 'two\n' >"$1/b.txt"
    printf 'three\n' >"$1/c.txt"
    git -C "$1" add .
    git -C "$1" commit -q -m init
}

home="$root/home"
mkdir -p "$home" "$root/plain dir"

# Clean, on main
new_repo "$home/repo-clean"

# A name with spaces, clean
new_repo "$home/my project"

# Staged (add, modify, rename), unstaged (modify, delete), both, and untracked
new_repo "$home/repo-dirty"
(
    cd "$home/repo-dirty"
    printf 'new\n' >added.txt
    git add added.txt
    printf 'one more\n' >>a.txt
    git add a.txt
    printf 'one again\n' >>a.txt
    printf 'two more\n' >>b.txt
    rm c.txt
    printf 'u1\n' >untracked-1.txt
    printf 'u2\n' >untracked-2.txt
    git mv b.txt b-renamed.txt 2>/dev/null || true
)

# Detached HEAD
new_repo "$home/repo-detached"
git -C "$home/repo-detached" checkout -q --detach HEAD

# An unborn branch: no commits yet
git init -q -b trunk "$home/repo-unborn"

# A merge conflict (unmerged entries)
new_repo "$home/repo-conflict"
(
    cd "$home/repo-conflict"
    git checkout -q -b other
    printf 'theirs\n' >a.txt
    git commit -q -am theirs
    git checkout -q main
    printf 'ours\n' >a.txt
    git commit -q -am ours
    git merge -q other >/dev/null 2>&1 || true
)
