#!/bin/sh
# Claude Code status line — mirrors Powerlevel10k p10k theme (Catppuccin Mocha)
# Segments: ● P · dir · git branch+counts · model · cost · context bar · tokens · rate limits

input=$(cat)

# ── Autocompact threshold (must match autocompact_percentage_override in settings.json) ──
AUTOCOMPACT_PCT=75

# ── Directory ────────────────────────────────────────────────────────────────
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
[ -z "$cwd" ] && cwd=$(pwd)
home="$HOME"
dir_name=$(basename "$cwd")
[ "$cwd" = "$home" ] && dir_name="~"

# ── Git branch ───────────────────────────────────────────────────────────────
git_branch=""
if git_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null); then
    git_branch="$git_out"
elif git_out=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" rev-parse --short HEAD 2>/dev/null); then
    git_branch="@$git_out"
fi

# ── Git status counts ─────────────────────────────────────────────────────────
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

# ── Vim mode ─────────────────────────────────────────────────────────────────
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')

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
rate_5h_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
rate_7d_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

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
PERSONAL_FG='\033[38;2;137;180;250m'
TOKENS_FG='\033[38;2;147;153;178m'
BLUE_FG='\033[38;2;137;180;250m'

# ── Helper functions ──────────────────────────────────────────────────────────

# Color for rate limit bars: green=lots left, yellow=getting scarce, red=almost gone
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

# 10-block bar: fills left-to-right as quota is consumed
_rate_bar() {
    used_int=$(printf '%.0f' "$1")
    filled=$((used_int * 10 / 100))
    [ $filled -gt 10 ] && filled=10
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
    printf '%s' "$bar"
}

# Parse reset_at (ISO 8601 string or Unix int) → Unix timestamp
_parse_reset_ts() {
    val="$1"
    case "$val" in
        *[!0-9]*) date -j -f "%Y-%m-%dT%H:%M:%SZ" "$val" +%s 2>/dev/null ;;
        *) printf '%s' "$val" ;;
    esac
}

# Format seconds-until-reset as "in Xh Ym" or "in Xd Yh"
_format_eta() {
    reset_ts="$1"
    now=$(date +%s)
    diff=$((reset_ts - now))
    [ $diff -le 0 ] && printf 'now' && return
    hours=$((diff / 3600))
    mins=$(((diff % 3600) / 60))
    if [ $hours -ge 24 ]; then
        days=$((hours / 24))
        hrs=$((hours % 24))
        printf 'in %dd%dh' "$days" "$hrs"
    elif [ $hours -gt 0 ]; then
        printf 'in %dh%dm' "$hours" "$mins"
    else
        printf 'in %dm' "$mins"
    fi
}

# ── Assemble output ───────────────────────────────────────────────────────────

# Account indicator
printf '%b● PERSONAL%b' "$PERSONAL_FG" "$RESET"

# Vim mode segment
if [ -n "$vim_mode" ]; then
    case "$vim_mode" in
        NORMAL) VIM_FG="$BLUE_FG"; vim_label="NORMAL" ;;
        INSERT) VIM_FG="$GREEN_FG"; vim_label="INSERT" ;;
        "VISUAL LINE") VIM_FG="$YELLOW_FG"; vim_label="V-LINE" ;;
        VISUAL) VIM_FG="$YELLOW_FG"; vim_label="VISUAL" ;;
        *) VIM_FG="$TOKENS_FG"; vim_label="$vim_mode" ;;
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

# Session cost (hidden until non-zero)
if [ -n "$cost" ] && [ "$cost" != "0" ] && [ "$cost" != "0.0" ]; then
    cost_fmt=$(printf '$%.2f' "$cost")
    printf "  ${COST_FG}%s${RESET}" "$cost_fmt"
fi

# Context bar: 15 blocks with autocompact threshold marker (│)
if [ -n "$used_pct" ]; then
    pct_int=$(printf '%.0f' "$used_pct")
    filled=$((pct_int * 15 / 100))
    thresh_pos=$((AUTOCOMPACT_PCT * 15 / 100))

    bar=""
    i=0
    while [ $i -lt 15 ]; do
        [ $i -eq $thresh_pos ] && bar="${bar}│"
        if [ $i -lt $filled ]; then
            bar="${bar}▓"
        else
            bar="${bar}░"
        fi
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

# Rate limits — bar + remaining % + reset ETA when available
if [ -n "$rate_5h" ]; then
    used_int=$(printf '%.0f' "$rate_5h")
    remaining=$((100 - used_int))
    col=$(_rate_color "$rate_5h")
    bar=$(_rate_bar "$rate_5h")
    printf "  ${col}5h %s %d%%${RESET}" "$bar" "$remaining"
    if [ -n "$rate_5h_reset" ]; then
        reset_ts=$(_parse_reset_ts "$rate_5h_reset")
        if [ -n "$reset_ts" ]; then
            printf " ${TOKENS_FG}%s${RESET}" "$(_format_eta "$reset_ts")"
        fi
    fi
fi
if [ -n "$rate_7d" ]; then
    used_int=$(printf '%.0f' "$rate_7d")
    remaining=$((100 - used_int))
    col=$(_rate_color "$rate_7d")
    bar=$(_rate_bar "$rate_7d")
    printf "  ${col}7d %s %d%%${RESET}" "$bar" "$remaining"
    if [ -n "$rate_7d_reset" ]; then
        reset_ts=$(_parse_reset_ts "$rate_7d_reset")
        if [ -n "$reset_ts" ]; then
            printf " ${TOKENS_FG}%s${RESET}" "$(_format_eta "$reset_ts")"
        fi
    fi
fi

printf "\n"
