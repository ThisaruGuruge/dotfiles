#!/bin/zsh
# ============================================================================
# Git Functions
# ============================================================================
# Git helper utilities: gs(), git_ignore_local(), prs(), prw()

# Catppuccin Mocha palette (truecolor)
_gs_color() {
    printf '\033[38;2;%s;%s;%sm' "$1" "$2" "$3"
}

gs() {
    # Check if we're in a git repo
    if ! git rev-parse --is-inside-work-tree &>/dev/null; then
        echo "Not a git repository."
        return 1
    fi

    # Colors (Catppuccin Mocha)
    local green=$(_gs_color 166 227 161)    # staged
    local peach=$(_gs_color 250 179 135)    # modified
    local mauve=$(_gs_color 203 166 247)    # untracked
    local blue=$(_gs_color 137 180 250)     # branch
    local teal=$(_gs_color 148 226 213)     # remote
    local yellow=$(_gs_color 249 226 175)   # ahead/behind
    local red=$(_gs_color 243 139 168)      # conflicts
    local lavender=$(_gs_color 180 190 254) # stash
    local subtext=$(_gs_color 166 173 200)  # dim text
    local text=$(_gs_color 205 214 244)     # normal text
    local reset=$'\033[0m'
    local bold=$'\033[1m'
    local dim=$'\033[2m'

    # Parse porcelain v2 output. -z gives NUL-terminated records with paths
    # verbatim (no quoting), so names with spaces survive; a rename ("2 ...")
    # is followed by one extra record holding the old path, which we skip.
    local branch_head="" branch_upstream="" ahead=0 behind=0
    local -a staged_files modified_files untracked_files conflict_files
    local -a fields
    local xy idx wt fname line
    local skip_next=false

    while IFS= read -r -d '' line; do
        if [[ "$skip_next" == true ]]; then
            skip_next=false
            continue
        fi
        case "$line" in
            "# branch.head "*)
                branch_head="${line#\# branch.head }"
                ;;
            "# branch.upstream "*)
                branch_upstream="${line#\# branch.upstream }"
                ;;
            "# branch.ab "*)
                ahead="${line#\# branch.ab }"
                behind="${ahead#* }"
                ahead="${ahead%% *}"
                ahead="${ahead#+}"
                behind="${behind#-}"
                ;;
            "1 "*|"2 "*)
                # Format: 1 XY sub mH mI mW hH hI path
                #     or: 2 XY sub mH mI mW hH hI xNN path  (old path in the next record)
                # The path is everything after the fixed fields, spaces included.
                fields=("${(@s/ /)line}")
                xy="${fields[2]}"
                idx="${xy[1]}"
                wt="${xy[2]}"
                if [[ "$line" == "2 "* ]]; then
                    fname="${(j: :)fields[10,-1]}"
                    skip_next=true
                else
                    fname="${(j: :)fields[9,-1]}"
                fi
                [[ "$idx" != "." ]] && staged_files+=("${idx} ${fname}")
                [[ "$wt" != "." ]] && modified_files+=("${wt} ${fname}")
                ;;
            "u "*)
                # Format: u XY sub m1 m2 m3 mW h1 h2 h3 path
                fields=("${(@s/ /)line}")
                conflict_files+=("${(j: :)fields[11,-1]}")
                ;;
            "? "*)
                untracked_files+=("${line#\? }")
                ;;
        esac
    done < <(git status --porcelain=v2 -z --branch 2>/dev/null)

    local stash_count
    stash_count=$(git stash list 2>/dev/null | wc -l | tr -d ' ')

    # ── Header: branch + remote ──
    printf "\n"
    # Branch names, commit subjects and paths are untrusted: they go through
    # %s (a "%" in a subject is not a printf directive) with control
    # characters blanked so they cannot inject escape sequences.
    printf '  %s%s %s%s' "$blue" "$bold" "${branch_head//[[:cntrl:]]/?}" "$reset"
    if [[ -n "$branch_upstream" ]]; then
        printf ' %s←%s %s%s%s' "$subtext" "$reset" "$teal" "${branch_upstream//[[:cntrl:]]/?}" "$reset"
    fi

    # Ahead/behind
    if (( ahead > 0 || behind > 0 )); then
        printf "  "
        (( ahead > 0 )) && printf "${yellow}↑${ahead}${reset} "
        (( behind > 0 )) && printf "${yellow}↓${behind}${reset}"
    fi

    # Stash
    if (( stash_count > 0 )); then
        printf "  ${lavender} ${stash_count}${reset}"
    fi
    printf "\n"

    # ── Last commit ──
    local last_commit
    last_commit=$(git log -1 --format="%ar · %s" 2>/dev/null)
    if [[ -n "$last_commit" ]]; then
        printf '  %s%s %s%s\n' "$subtext" "$dim" "${last_commit//[[:cntrl:]]/?}" "$reset"
    fi

    # ── Summary line ──
    local staged_n=${#staged_files[@]}
    local modified_n=${#modified_files[@]}
    local untracked_n=${#untracked_files[@]}
    local conflict_n=${#conflict_files[@]}
    local total=$(( staged_n + modified_n + untracked_n + conflict_n ))

    printf "\n"
    if (( total == 0 )); then
        printf "  ${green}${bold} Nothing to commit, working tree clean${reset}\n"
    else
        local -a summary_parts
        (( staged_n > 0 ))    && summary_parts+=("${green}${bold}✓ ${staged_n} staged${reset}")
        (( modified_n > 0 ))  && summary_parts+=("${peach}${bold}● ${modified_n} modified${reset}")
        (( untracked_n > 0 )) && summary_parts+=("${mauve}${bold}? ${untracked_n} untracked${reset}")
        (( conflict_n > 0 ))  && summary_parts+=("${red}${bold} ${conflict_n} conflicts${reset}")
        printf "  %s\n" "${(j:   :)summary_parts}"
    fi

    # ── File lists ──
    if (( staged_n > 0 )); then
        printf "\n  ${green}${bold} Staged${reset}\n"
        for f in "${staged_files[@]}"; do
            local st="${f%% *}"
            local name="${f#* }"
            printf '  %s  %s %s%s\n' "$green" "$st" "${name//[[:cntrl:]]/?}" "$reset"
        done
    fi

    if (( modified_n > 0 )); then
        printf "\n  ${peach}${bold} Modified${reset}\n"
        for f in "${modified_files[@]}"; do
            local st="${f%% *}"
            local name="${f#* }"
            printf '  %s  %s %s%s\n' "$peach" "$st" "${name//[[:cntrl:]]/?}" "$reset"
        done
    fi

    if (( conflict_n > 0 )); then
        printf "\n  ${red}${bold} Conflicts${reset}\n"
        for f in "${conflict_files[@]}"; do
            printf '  %s   %s%s\n' "$red" "${f//[[:cntrl:]]/?}" "$reset"
        done
    fi

    if (( untracked_n > 0 )); then
        printf "\n  ${mauve}${bold} Untracked${reset}\n"
        for f in "${untracked_files[@]}"; do
            printf '  %s  %s%s\n' "$mauve" "${f//[[:cntrl:]]/?}" "$reset"
        done
    fi

    printf "\n"
}

git_ignore_local() {
    if [ -z "$1" ]; then
        echo "Usage: git_ignore_local <file>"
        return 1
    fi

    # --git-path resolves info/exclude correctly in linked worktrees and
    # submodules, where .git is a file and the exclude file lives elsewhere.
    local exclude
    if ! exclude=$(git rev-parse --git-path info/exclude 2>/dev/null) || [ -z "$exclude" ]; then
        echo "Not inside a Git repository."
        return 1
    fi
    exclude="${exclude:A}"

    if [ -f "$exclude" ] && grep -qxF -- "$1" "$exclude"; then
        echo "'$1' is already in $exclude"
        return 0
    fi

    mkdir -p "${exclude:h}" || return 1
    # Keep the new entry on its own line if the file lacks a trailing newline.
    if [ -s "$exclude" ] && [ -n "$(tail -c1 "$exclude")" ]; then
        printf '\n' >>"$exclude" || return 1
    fi
    if ! printf '%s\n' "$1" >>"$exclude"; then
        echo "Could not write to $exclude"
        return 1
    fi
    echo "Added '$1' to $exclude"
}

# ============================================================================
# GitHub PR helpers: prs(), prw()
# ============================================================================

# Browse the repo's pull requests with fzf (needs gh, jq and fzf).
#   enter   check the PR out          ctrl-o  open it in the browser
#   ctrl-d  full diff through delta   (the preview pane shows `gh pr view`)
# Extra arguments go to `gh pr list`, e.g. `prs --author @me`, `prs --state all`.
# PR titles and branch names are untrusted text: control characters (including
# ESC) are replaced with spaces before they reach the terminal, and fzf is not
# given --ansi, so a title cannot inject escape sequences into the list.
prs() {
    if ! command -v gh >/dev/null 2>&1 || ! command -v fzf >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
        echo "prs needs gh, fzf and jq (brew install gh fzf jq)"
        return 1
    fi

    local differ="${PAGER:-less}"
    command -v delta >/dev/null 2>&1 && differ="delta --paging=always"

    local json list
    if ! json=$(gh pr list --limit 100 "$@" --json number,title,headRefName,author,isDraft,reviewDecision); then
        return 1
    fi
    if ! list=$(printf '%s' "$json" | jq -r 'def clean: gsub("[[:cntrl:]]"; " ");
        .[] | [(.number|tostring), (if .isDraft then "[draft] " else "" end) + (.title|clean), (.headRefName|clean), (.author.login|clean), (.reviewDecision // "")] | @tsv'); then
        echo "prs: could not parse the output of gh pr list"
        return 1
    fi
    if [[ -z "$list" ]]; then
        echo "No pull requests found."
        return 0
    fi

    local pick
    pick=$(printf '%s\n' "$list" | fzf --delimiter=$'\t' --with-nth=1,2,3,4,5 --tabstop=2 \
        --header $'enter: checkout   ctrl-o: browser   ctrl-d: diff' \
        --preview 'gh pr view {1}' --preview-window 'right,60%,wrap' \
        --bind 'ctrl-o:execute-silent(gh pr view {1} --web)' \
        --bind "ctrl-d:execute(gh pr diff {1} | $differ)") || return 0

    [[ -z "$pick" ]] && return 0
    gh pr checkout "${pick%%$'\t'*}"
}

# Watch a PR's checks until they finish, then post a macOS notification with
# the result. `prw` uses the current branch's PR; `prw 123` or `prw <url>`
# picks one. Extra flags go to `gh pr checks` (e.g. `prw --fail-fast`).
# The exit status mirrors `gh pr checks` (0 passed, 8 pending, other = failed
# or not determinable); the message says which: failed, cancelled, still
# pending, or "no result" when gh reports no checks or cannot be reached.
prw() {
    if ! command -v gh >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
        echo "prw needs gh and jq (brew install gh jq)"
        return 1
    fi

    local target=""
    if [[ -n "$1" && "$1" != -* ]]; then
        target="$1"
        shift
    fi

    local title
    title=$(gh pr view ${target:+"$target"} --json number,title | jq -r 'def clean: gsub("[[:cntrl:]]"; " "); "#\(.number) \(.title|clean)"') || return 1
    [[ -z "$title" ]] && return 1

    gh pr checks ${target:+"$target"} --watch "$@"
    local rc=$?

    # Anything but 0/8 is ambiguous (failed checks, no checks reported, auth or
    # network trouble), so ask gh for the final buckets of the checks.
    local result buckets
    case $rc in
        0) result="All checks passed" ;;
        8) result="Checks still pending" ;;
        *)
            local scope=() prev=""
            local arg
            for arg in "$@"; do
                case "$arg" in
                    --required | -R?* | --repo=*) scope+=("$arg") ;;
                    *) [[ "$prev" == -R || "$prev" == --repo ]] && scope+=("$prev" "$arg") ;;
                esac
                prev="$arg"
            done
            if buckets=$(gh pr checks ${target:+"$target"} "${scope[@]}" --json bucket 2>/dev/null | jq -r '[.[].bucket] | unique | join(" ")' 2>/dev/null) && [[ -n "$buckets" ]]; then
                case " $buckets " in
                    *" fail "*) result="Checks failed" ;;
                    *" cancel "*) result="Checks cancelled" ;;
                    *" pending "*) result="Checks still pending" ;;
                    *) result="Checks finished ($buckets) but gh exited $rc" ;;
                esac
            else
                result="No check result (gh exited $rc: no checks reported, or gh could not be reached)"
            fi
            ;;
    esac

    printf '\a'
    printf '%s: %s\n' "$title" "$result"
    if command -v osascript >/dev/null 2>&1; then
        osascript -e 'on run argv' \
            -e 'display notification (item 1 of argv) with title (item 2 of argv)' \
            -e 'end run' -- "$title" "prw: $result" >/dev/null 2>&1
    fi
    return $rc
}
