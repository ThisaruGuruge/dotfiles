#!/bin/sh
# Claude Code status line — personal account (Catppuccin Mocha)
# Segments: ● PERSONAL · vim mode · dir · git branch+counts · model · cost · tokens
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
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // .session.cost_usd // empty')
tokens_used=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
tokens_max=$(echo "$input" | jq -r '.context_window.context_window_size // empty')

# ── Colors (Catppuccin Mocha palette, ANSI true-color) ───────────────────────
ESC=$(printf '\033')
RESET="${ESC}[0m"
DIR_BG="${ESC}[48;2;49;50;68m"
DIR_FG="${ESC}[38;2;205;214;244m"
GIT_FG="${ESC}[38;2;166;227;161m"
MODEL_FG="${ESC}[38;2;137;220;235m"
GREEN_FG="${ESC}[38;2;166;227;161m"
YELLOW_FG="${ESC}[38;2;249;226;175m"
DIM="${ESC}[2m"
TOKENS_FG="${ESC}[38;2;147;153;178m"
COST_FG="${ESC}[38;2;245;194;231m"
BLUE_FG="${ESC}[38;2;137;180;250m"
ACCOUNT_FG="${ESC}[38;2;137;180;250m"

# ── Assemble output ───────────────────────────────────────────────────────────
# Each segment is added with its visible width, then the segments are spread across the
# terminal: the gap is whatever width is left over, kept between 3 and 8 columns.
SEP=$(printf '\037')
segs=""
count=0
total=0
add() {
    segs="${segs}${2}${SEP}"
    count=$((count + 1))
    total=$((total + $1))
}

# Account indicator
account_label="PERSONAL"
add $((${#account_label} + 2)) "${ACCOUNT_FG}● ${account_label}${RESET}"

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
    add ${#vim_label} "${VIM_FG}${vim_label}${RESET}"
fi

# Directory + git segment: branch and staged/unstaged/untracked counts
dir_seg="${DIR_BG}${DIR_FG} ${dir_name} ${RESET}"
dir_len=$((${#dir_name} + 2))
if [ -n "$git_branch" ]; then
    dir_seg="${dir_seg} ${GIT_FG}${git_branch}${RESET}"
    dir_len=$((dir_len + 1 + ${#git_branch}))
    if [ "$git_staged" -gt 0 ]; then
        dir_seg="${dir_seg} ${GREEN_FG}+${git_staged}${RESET}"
        dir_len=$((dir_len + 2 + ${#git_staged}))
    fi
    if [ "$git_unstaged" -gt 0 ]; then
        dir_seg="${dir_seg} ${YELLOW_FG}~${git_unstaged}${RESET}"
        dir_len=$((dir_len + 2 + ${#git_unstaged}))
    fi
    if [ "$git_untracked" -gt 0 ]; then
        dir_seg="${dir_seg} ${TOKENS_FG}?${git_untracked}${RESET}"
        dir_len=$((dir_len + 2 + ${#git_untracked}))
    fi
fi
add "$dir_len" "$dir_seg"

# Model segment
if [ -n "$model" ]; then
    add ${#model} "${DIM}${MODEL_FG}${model}${RESET}"
fi

# Session cost: hidden until non-zero
if [ -n "$cost" ] && [ "$cost" != "0" ] && [ "$cost" != "0.0" ]; then
    cost_text=$(printf '$%.2f' "$cost")
    add ${#cost_text} "${COST_FG}${cost_text}${RESET}"
fi

# Absolute token count
if [ -n "$tokens_used" ] && [ -n "$tokens_max" ]; then
    tokens_text="$((tokens_used / 1000))k/$((tokens_max / 1000))k"
    add ${#tokens_text} "${TOKENS_FG}${tokens_text}${RESET}"
fi

# Terminal width: stty needs a controlling terminal, which a status line may not have
cols=$({ stty size </dev/tty; } 2>/dev/null | cut -d' ' -f2)
case "$cols" in
    '' | *[!0-9]*) cols=${COLUMNS:-0} ;;
esac
case "$cols" in
    '' | *[!0-9]*) cols=0 ;;
esac
gap=5
if [ "$cols" -gt 0 ] && [ "$count" -gt 1 ]; then
    gap=$(((cols - 4 - total) / (count - 1)))
    [ "$gap" -lt 3 ] && gap=3
    [ "$gap" -gt 8 ] && gap=8
fi

# Two no-break spaces start the line (plain spaces get trimmed), then the segments
printf '\302\240\302\240'
n=0
OLD_IFS=$IFS
IFS=$SEP
for seg in $segs; do
    n=$((n + 1))
    [ "$n" -gt 1 ] && printf '%*s' "$gap" ''
    printf '%s' "$seg"
done
IFS=$OLD_IFS
printf '\n'
