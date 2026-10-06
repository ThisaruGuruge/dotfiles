#!/bin/sh
# Claude Code status line — enterprise account (Catppuccin Mocha)
# Segments: ● WORK · vim mode · dir · git branch+counts · model · cost · tokens
# Context bar, rate limits and per-turn stats live in the statusbar mod (claude-mods/statusbar).

input=$(cat)

# ── Directory ────────────────────────────────────────────────────────────────
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
[ -z "$cwd" ] && cwd=$(pwd)
dir_name=$(basename "$cwd")
[ "$cwd" = "$HOME" ] && dir_name="~"

# ── Git branch + status counts ───────────────────────────────────────────────
git_branch=""
if git_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null); then
    git_branch="$git_out"
elif git_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" rev-parse --short HEAD 2>/dev/null); then
    git_branch="@$git_out"
fi

git_staged=0
git_unstaged=0
git_untracked=0
if [ -n "$git_branch" ]; then
    if git_status_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" status --porcelain 2>/dev/null) && [ -n "$git_status_out" ]; then
        git_staged=$(printf '%s\n' "$git_status_out" | awk '/^[MADRC]/{n++} END{print n+0}')
        git_unstaged=$(printf '%s\n' "$git_status_out" | awk '/^.[MD]/{n++} END{print n+0}')
        git_untracked=$(printf '%s\n' "$git_status_out" | awk '/^\?\?/{n++} END{print n+0}')
    fi
fi

# ── Other fields ─────────────────────────────────────────────────────────────
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
cost=$(echo "$input" | jq -r '.session.cost_usd // empty')
tokens_used=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
tokens_max=$(echo "$input" | jq -r '.context_window.context_window_size // empty')

# ── Colors (Catppuccin Mocha palette, ANSI true-color) ───────────────────────
RESET='\033[0m'
DIR_BG='\033[48;2;49;50;68m'
DIR_FG='\033[38;2;205;214;244m'
GIT_FG='\033[38;2;166;227;161m'
MODEL_FG='\033[38;2;137;220;235m'
GREEN_FG='\033[38;2;166;227;161m'
YELLOW_FG='\033[38;2;249;226;175m'
DIM='\033[2m'
TOKENS_FG='\033[38;2;147;153;178m'
COST_FG='\033[38;2;245;194;231m'
BLUE_FG='\033[38;2;137;180;250m'
ACCOUNT_FG='\033[38;2;250;179;135m'

# ── Assemble output ───────────────────────────────────────────────────────────

# Account indicator
printf '%b● WORK%b' "$ACCOUNT_FG" "$RESET"

# Vim mode segment
if [ -n "$vim_mode" ]; then
    case "$vim_mode" in
        NORMAL)
            VIM_FG="$BLUE_FG"
            vim_label="NORMAL"
            ;;
        INSERT)
            VIM_FG="$GREEN_FG"
            vim_label="INSERT"
            ;;
        "VISUAL LINE")
            VIM_FG="$YELLOW_FG"
            vim_label="V-LINE"
            ;;
        VISUAL)
            VIM_FG="$YELLOW_FG"
            vim_label="VISUAL"
            ;;
        *)
            VIM_FG="$TOKENS_FG"
            vim_label="$vim_mode"
            ;;
    esac
    printf "  ${VIM_FG}%s${RESET}" "$vim_label"
fi

# Directory segment
printf "  ${DIR_BG}${DIR_FG} %s ${RESET}" "$dir_name"

# Git segment: branch + staged/unstaged/untracked counts
if [ -n "$git_branch" ]; then
    printf " ${GIT_FG} %s${RESET}" "$git_branch"
    [ "$git_staged" -gt 0 ] && printf " ${GREEN_FG}+%d${RESET}" "$git_staged"
    [ "$git_unstaged" -gt 0 ] && printf " ${YELLOW_FG}~%d${RESET}" "$git_unstaged"
    [ "$git_untracked" -gt 0 ] && printf " ${TOKENS_FG}?%d${RESET}" "$git_untracked"
fi

# Model segment
if [ -n "$model" ]; then
    printf "  ${DIM}${MODEL_FG}%s${RESET}" "$model"
fi

# Session cost: always visible (company spend)
printf "  ${COST_FG}%s${RESET}" "$(printf '$%.2f' "${cost:-0}")"

# Absolute token count
if [ -n "$tokens_used" ] && [ -n "$tokens_max" ]; then
    printf "  ${TOKENS_FG}%dk/%dk${RESET}" "$((tokens_used / 1000))" "$((tokens_max / 1000))"
fi

printf "\n"
