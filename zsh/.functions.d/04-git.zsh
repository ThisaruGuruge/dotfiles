#!/bin/zsh
# ============================================================================
# Git Functions
# ============================================================================
# Git helper utilities: gs(), git_ignore_local()

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

    # Parse porcelain v2 output
    local branch_head="" branch_upstream="" ahead=0 behind=0
    local -a staged_files modified_files untracked_files conflict_files
    local -a fields
    local xy idx wt fname

    while IFS= read -r line; do
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
                #     or: 2 XY sub mH mI mW hH hI xNN path\torigPath
                fields=("${(@s/ /)line}")
                xy="${fields[2]}"
                idx="${xy[1]}"
                wt="${xy[2]}"
                if [[ "$line" == "2 "* ]]; then
                    fname="${fields[10]}"
                    fname="${fname%%	*}"
                else
                    fname="${fields[9]}"
                fi
                [[ "$idx" != "." ]] && staged_files+=("${idx} ${fname}")
                [[ "$wt" != "." ]] && modified_files+=("${wt} ${fname}")
                ;;
            "u "*)
                fname="${line##* }"
                conflict_files+=("${fname}")
                ;;
            "? "*)
                untracked_files+=("${line#\? }")
                ;;
        esac
    done < <(git status --porcelain=v2 --branch 2>/dev/null)

    local stash_count
    stash_count=$(git stash list 2>/dev/null | wc -l | tr -d ' ')

    # ── Header: branch + remote ──
    printf "\n"
    printf "  ${blue}${bold} ${branch_head}${reset}"
    if [[ -n "$branch_upstream" ]]; then
        printf " ${subtext}←${reset} ${teal}${branch_upstream}${reset}"
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
        printf "  ${subtext}${dim} ${last_commit}${reset}\n"
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
            printf "  ${green}  ${st} ${name}${reset}\n"
        done
    fi

    if (( modified_n > 0 )); then
        printf "\n  ${peach}${bold} Modified${reset}\n"
        for f in "${modified_files[@]}"; do
            local st="${f%% *}"
            local name="${f#* }"
            printf "  ${peach}  ${st} ${name}${reset}\n"
        done
    fi

    if (( conflict_n > 0 )); then
        printf "\n  ${red}${bold} Conflicts${reset}\n"
        for f in "${conflict_files[@]}"; do
            printf "  ${red}   ${f}${reset}\n"
        done
    fi

    if (( untracked_n > 0 )); then
        printf "\n  ${mauve}${bold} Untracked${reset}\n"
        for f in "${untracked_files[@]}"; do
            printf "  ${mauve}  ${f}${reset}\n"
        done
    fi

    printf "\n"
}

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
