#!/bin/sh
# Claude Code status line — enterprise account (Catppuccin Mocha)
# Segments: ● E · dir · git branch · model · cost (always) · context bar · tokens · rate limits

input=$(cat)

# ── Directory ────────────────────────────────────────────────────────────────
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
[ -z "$cwd" ] && cwd=$(pwd)
dir_name=$(basename "$cwd")
home="$HOME"
[ "$cwd" = "$home" ] && dir_name="~"

# ── Git branch ───────────────────────────────────────────────────────────────
git_branch=""
if git_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null); then
    git_branch="$git_out"
elif git_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" rev-parse --short HEAD 2>/dev/null); then
    git_branch="@$git_out"
fi

# ── Model ────────────────────────────────────────────────────────────────────
model=$(echo "$input" | jq -r '.model.display_name // empty')

# ── Session cost ─────────────────────────────────────────────────────────────
cost=$(echo "$input" | jq -r '.session.cost_usd // empty')

# ── Context usage ────────────────────────────────────────────────────────────
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# ── Absolute token count ──────────────────────────────────────────────────────
tokens_used=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
tokens_max=$(echo "$input" | jq -r '.context_window.context_window_size // empty')

# ── Rate limits ───────────────────────────────────────────────────────────────
rate_5h=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
rate_7d=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')

# ── Colors (Catppuccin Mocha palette, ANSI true-color) ───────────────────────
RESET='\033[0m'
DIR_BG='\033[48;2;49;50;68m'
DIR_FG='\033[38;2;205;214;244m'
GIT_FG='\033[38;2;166;227;161m'
MODEL_FG='\033[38;2;137;220;235m'
COST_FG='\033[38;2;250;179;135m'
GREEN_FG='\033[38;2;166;227;161m'
YELLOW_FG='\033[38;2;249;226;175m'
RED_FG='\033[38;2;243;139;168m'
DIM='\033[2m'
ENTERPRISE_FG='\033[38;2;203;166;247m'
TOKENS_FG='\033[38;2;147;153;178m'

# ── Assemble output ───────────────────────────────────────────────────────────

# Account indicator
printf "${ENTERPRISE_FG}● Work${RESET}"

# Directory segment
printf "  ${DIR_BG}${DIR_FG} %s ${RESET}" "$dir_name"

# Git segment
if [ -n "$git_branch" ]; then
    printf " ${GIT_FG} %s${RESET}" "$git_branch"
fi

# Model segment
if [ -n "$model" ]; then
    printf "  ${DIM}${MODEL_FG}%s${RESET}" "$model"
fi

# Cost — always visible (company spend)
cost_val="${cost:-0}"
cost_fmt=$(printf '$%.2f' "$cost_val")
printf "  ${COST_FG}%s${RESET}" "$cost_fmt"

# Context bar segment
if [ -n "$used_pct" ]; then
    pct_int=$(printf '%.0f' "$used_pct")
    filled=$((pct_int / 10))
    empty=$((10 - filled))

    bar=""
    i=0
    while [ $i -lt $filled ]; do
        bar="${bar}▓"
        i=$((i + 1))
    done
    i=0
    while [ $i -lt $empty ]; do
        bar="${bar}░"
        i=$((i + 1))
    done

    if [ "$pct_int" -lt 50 ]; then
        CTX_COLOR="$GREEN_FG"
    elif [ "$pct_int" -lt 80 ]; then
        CTX_COLOR="$YELLOW_FG"
    else
        CTX_COLOR="$RED_FG"
    fi

    printf "  ${CTX_COLOR}%s %d%%${RESET}" "$bar" "$pct_int"
fi

# Absolute token count
if [ -n "$tokens_used" ] && [ -n "$tokens_max" ]; then
    used_k=$((tokens_used / 1000))
    max_k=$((tokens_max / 1000))
    printf "  ${TOKENS_FG}%dk/%dk${RESET}" "$used_k" "$max_k"
fi

# Rate limits — show remaining (↓) so green=lots left, red=almost gone
# _rate_color takes used_pct; green<50 used = 50+% remaining = good
_rate_color() {
    pct=$(printf '%.0f' "$1")
    if [ "$pct" -lt 50 ]; then
        printf '%s' "$GREEN_FG"
    elif [ "$pct" -lt 80 ]; then
        printf '%s' "$YELLOW_FG"
    else
        printf '%s' "$RED_FG"
    fi
}
if [ -n "$rate_5h" ]; then
    used_int=$(printf '%.0f' "$rate_5h")
    remaining=$((100 - used_int))
    col=$(_rate_color "$rate_5h")
    printf "  ${col}5h↓%d%%${RESET}" "$remaining"
fi
if [ -n "$rate_7d" ]; then
    used_int=$(printf '%.0f' "$rate_7d")
    remaining=$((100 - used_int))
    col=$(_rate_color "$rate_7d")
    printf "  ${col}7d↓%d%%${RESET}" "$remaining"
fi

printf "\n"
