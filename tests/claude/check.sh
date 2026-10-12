#!/bin/bash
# Checks for the Claude Code pieces outside the mods: the shared status line, the tmux state hook
# and the tracked settings. Prints one line per check, `PASS|name|detail`, `FAIL|name|detail` or
# `WARN|name|detail`, for bin/test-zsh-config to report; exits 1 when any check failed.
#
# Usage: tests/claude/check.sh [repo-root]   (default: the repo this file is in)
#
# Everything runs in a temporary directory with its own HOME, CLAUDE_CONFIG_DIR and git config,
# and a tmux server of its own: nothing touches the real ones.
set -u

repo=${1:-$(cd "$(dirname "$0")/../.." && pwd)}
work=$(mktemp -d "${TMPDIR:-/tmp}/dotfiles-claude-check.XXXXXX")
tmux_server="dotfiles-check-$$"
# shellcheck disable=SC2317,SC2329 # called by the EXIT trap
cleanup() {
    tmux -L "$tmux_server" kill-server >/dev/null 2>&1
    rm -rf "$work"
}
trap cleanup EXIT

failed=0
pass() { printf 'PASS|%s|%s\n' "$1" "${2:-}"; }
fail() {
    printf 'FAIL|%s|%s\n' "$1" "${2:-}"
    failed=1
}
warn() { printf 'WARN|%s|%s\n' "$1" "${2:-}"; }

statusline="$repo/bin/claude-statusline"
wrapper() { printf '%s\n' "$repo/claude/.claude-$1/statusline-command.sh"; }

# Runs an account's wrapper on stdin with a fixed width and no Remote Control bridge
run_statusline() {
    env -u CLAUDE_CODE_BRIDGE_SESSION_ID HOME="$work/fx/home" CLAUDE_CONFIG_DIR="$work/config" \
        GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
        CLAUDE_STATUSLINE="$statusline" CLAUDE_STATUSLINE_COLUMNS=0 bash "$(wrapper "$1")"
}

# ── Status line: golden output ──────────────────────────────────────────────
# Each cases/*.expected was produced by the two account scripts as they were before bin/claude-statusline
# (one jq call per field, three git calls) with the RC segment spliced in after the account: the
# shared script must print exactly the same.
if ! command -v jq >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1; then
    warn "Status line golden output" "jq and git are needed"
elif ! bash "$repo/tests/claude/statusline/make-repos.sh" "$work/fx" >/dev/null 2>&1; then
    fail "Status line golden output" "could not build the fixture repos"
else
    mkdir -p "$work/config"
    bad=""
    n=0
    for case_json in "$repo"/tests/claude/statusline/cases/*.json; do
        name=$(basename "$case_json" .json)
        account=${name#*-}
        account=${account%%-*}
        want=$(cat "${case_json%.json}.expected")
        got=$(cd "$work/fx/home/repo-clean" && sed "s|@ROOT@|$work/fx|g" "$case_json" | run_statusline "$account")
        n=$((n + 1))
        [ "$got" = "$want" ] || bad="$bad $name"
    done
    if [ -z "$bad" ]; then
        pass "Status line golden output" "$n cases, both accounts"
    else
        fail "Status line golden output" "differs:$bad"
    fi
fi

# The status line refreshes every 15 s: its git status must not count ahead/behind commits
if grep -q 'status --porcelain=v2 --branch --no-ahead-behind' "$statusline"; then
    pass "Status line git status skips ahead/behind counts"
else
    fail "Status line git status skips ahead/behind counts"
fi

# ── Status line: Remote Control indicator ───────────────────────────────────
rc_line() {
    # $1: content of sessions/<pid>.json, or - for no file. The file is named after the shell
    # that pipes into the wrapper, which is the status line's parent ($PPID), as Claude Code is.
    # shellcheck disable=SC2016 # expanded by the inner sh
    env -u CLAUDE_CODE_BRIDGE_SESSION_ID CLAUDE_CONFIG_DIR="$work/rc" GIT_CONFIG_GLOBAL=/dev/null \
        CLAUDE_STATUSLINE="$statusline" CLAUDE_STATUSLINE_COLUMNS=0 \
        sh -c 'rm -rf "$CLAUDE_CONFIG_DIR/sessions"
            mkdir -p "$CLAUDE_CONFIG_DIR/sessions"
            [ "$1" = - ] || printf "%s" "$1" >"$CLAUDE_CONFIG_DIR/sessions/$$.json"
            printf "%s" "{\"session_id\":\"fixture\"}" | bash "$2"
            :' _ "$1" "$(wrapper personal)"
}
rc_check() {
    # $1 name, $2 on|off, $3 the line
    case "$2:$3" in
        on:*"◉ RC"*) case "$3" in *"RC off"*) fail "$1" "shows RC off" ;; *) pass "$1" ;; esac ;;
        off:*"○ RC off"*) pass "$1" ;;
        *) fail "$1" "expected RC $2" ;;
    esac
}
if command -v jq >/dev/null 2>&1; then
    on_env=$(printf '%s' '{"session_id":"fixture"}' | env CLAUDE_CODE_BRIDGE_SESSION_ID=session_test \
        CLAUDE_CONFIG_DIR="$work/rc-none" CLAUDE_STATUSLINE="$statusline" CLAUDE_STATUSLINE_COLUMNS=0 \
        bash "$(wrapper enterprise)")
    rc_check "RC on from CLAUDE_CODE_BRIDGE_SESSION_ID" on "$on_env"
    rc_check "RC on from the session file's bridgeSessionId" on \
        "$(rc_line '{"pid":1,"sessionId":"fixture","bridgeSessionId":"session_fixture"}')"
    rc_check "RC off when the session file has no bridgeSessionId" off "$(rc_line '{"pid":1,"sessionId":"fixture"}')"
    rc_check "RC off when bridgeSessionId is null" off \
        "$(rc_line '{"pid":1,"sessionId":"fixture","bridgeSessionId":null}')"
    rc_check "RC off when there is no session file" off "$(rc_line -)"
fi

# ── Status line wrappers stay thin ──────────────────────────────────────────
for account in personal enterprise; do
    lines=$(grep -cv '^[[:space:]]*$' "$(wrapper "$account")")
    if [ "$lines" -le 3 ] && grep -q 'exec .*claude-statusline' "$(wrapper "$account")"; then
        pass "statusline-command.sh ($account) execs bin/claude-statusline"
    else
        fail "statusline-command.sh ($account) execs bin/claude-statusline" "$lines lines"
    fi
done

# ── tmux state hook ─────────────────────────────────────────────────────────
state="$repo/bin/claude-tmux-state"
out=$(env -u TMUX -u TMUX_PANE "$state" working </dev/null 2>&1)
rc=$?
if [ -z "$out" ] && [ "$rc" -eq 0 ]; then
    pass "claude-tmux-state is a silent no-op outside tmux"
else
    fail "claude-tmux-state is a silent no-op outside tmux" "rc=$rc output=$out"
fi
if command -v tmux >/dev/null 2>&1 && tmux -L "$tmux_server" -f /dev/null new-session -d -s t >/dev/null 2>&1; then
    sock=$(tmux -L "$tmux_server" display -p '#{socket_path}')
    pane=$(tmux -L "$tmux_server" display -p -t t '#{pane_id}')
    pid=$(tmux -L "$tmux_server" display -p '#{pid}')
    get() { tmux -L "$tmux_server" show-options -wqv -t "$pane" @claude_state; }
    seen=""
    for s in working waiting "done"; do
        out=$(printf '{}' | TMUX="$sock,$pid,0" TMUX_PANE="$pane" "$state" "$s" 2>&1)
        seen="$seen$(get)${out:+!}/"
    done
    TMUX="$sock,$pid,0" TMUX_PANE="$pane" "$state" clear </dev/null
    seen="$seen$(get)"
    if [ "$seen" = "working/waiting/done/" ]; then
        pass "claude-tmux-state sets and clears @claude_state"
    else
        fail "claude-tmux-state sets and clears @claude_state" "$seen"
    fi
    # resume (PostToolUse) only turns waiting back into working
    in_tmux() { TMUX="$sock,$pid,0" TMUX_PANE="$pane" "$@" </dev/null; }
    in_tmux "$state" "done"
    in_tmux "$state" resume
    seen="$(get)/"
    in_tmux "$state" waiting
    in_tmux "$state" resume
    seen="$seen$(get)"
    if [ "$seen" = "done/working" ]; then
        pass "claude-tmux-state resume turns only waiting into working"
    else
        fail "claude-tmux-state resume turns only waiting into working" "$seen"
    fi
    # A claude started under another claude (two `claude` processes above the hook; symlinks
    # named claude stand in for them) leaves the outer session's window alone
    mkdir -p "$work/fake" && ln -s /bin/sh "$work/fake/claude"
    in_tmux "$state" "done"
    # shellcheck disable=SC2016 # expanded by the inner shells
    in_tmux "$work/fake/claude" -c '"$1" -c "\"\$1\" working; :" _ "$2"; :' _ "$work/fake/claude" "$state"
    if [ "$(get)" = "done" ]; then
        pass "claude-tmux-state leaves the window alone for a nested claude"
    else
        fail "claude-tmux-state leaves the window alone for a nested claude" "$(get)"
    fi
else
    warn "claude-tmux-state sets and clears @claude_state" "tmux not available"
fi

# ── ccp per-project settings ────────────────────────────────────────────────
# ccp/ccpr/ccpc pass ~/.claude-personal/projects.d/<repo>.json with --settings, <repo> being the main
# checkout's name, also from a subdirectory or a linked worktree; nothing when the file is absent.
if command -v zsh >/dev/null 2>&1 && command -v git >/dev/null 2>&1; then
    # shellcheck disable=SC2016 # expanded by zsh
    got=$(env HOME="$work/ccp/home" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 zsh -f -c '
        w=$HOME:h
        mkdir -p $HOME/.claude-personal/projects.d $w/proj-a/sub $w/proj-b $w/plain
        print "{}" >$HOME/.claude-personal/projects.d/proj-a.json
        git init -q $w/proj-a && git -C $w/proj-a -c user.name=t -c user.email=t@t commit -q --allow-empty -m i
        git -C $w/proj-a worktree add -q $w/wt-x 2>/dev/null
        git init -q $w/proj-b
        source $1/zsh/.aliases.sh
        claude() { print -rn -- "[${CLAUDE_CONFIG_DIR:t} ${*//$HOME/~}]" }
        cd $w/proj-a/sub && ccp -p x
        cd $w/wt-x && ccpr
        cd $w/proj-b && ccpc
        cd $w/plain && ccp
    ' _ "$repo" 2>&1)
    # shellcheck disable=SC2088 # the fake claude prints $HOME as a literal ~
    s='~/.claude-personal/projects.d/proj-a.json'
    want="[.claude-personal --settings $s -p x][.claude-personal --settings $s --resume][.claude-personal --continue][.claude-personal ]"
    if [ "$got" = "$want" ]; then
        pass "ccp loads the repo's projects.d file (subdirectory, worktree, none)"
    else
        fail "ccp loads the repo's projects.d file (subdirectory, worktree, none)" "$got"
    fi
else
    warn "ccp loads the repo's projects.d file (subdirectory, worktree, none)" "zsh and git are needed"
fi

# ── Tracked settings ────────────────────────────────────────────────────────
for settings in "$repo"/claude/.claude-*/settings.json; do
    account=$(basename "$(dirname "$settings")")
    if ! jq -e . "$settings" >/dev/null 2>&1; then
        fail "$account/settings.json is valid JSON"
        continue
    fi
    hooks=$(jq -r '[.hooks | (.UserPromptSubmit, .Notification, .Stop, .StopFailure, .PostToolUse, .SessionEnd)
        | [.[]?.hooks[]?.command | select(test("claude-tmux-state"))] | length] | join(" ")' "$settings")
    if [ "$hooks" = "1 1 1 1 1 1" ]; then
        pass "$account/settings.json wires claude-tmux-state into 6 hooks"
    else
        fail "$account/settings.json wires claude-tmux-state into 6 hooks" "$hooks"
    fi
    if [ "$(jq -r '.statusLine.refreshInterval // empty' "$settings")" = 15 ]; then
        pass "$account/settings.json refreshes the status line every 15 s"
    else
        fail "$account/settings.json refreshes the status line every 15 s"
    fi
done

# Private project details belong in ~/.claude-personal/projects.d/<repo>.json, never in this public
# repo. The repo only carries a generic check: tracked settings may name paths under a home
# directory only inside dot-directories or ~/dotfiles (a project path like ~/<dir>/<project> is
# private). Names to look for (one extended regex per line; blank and # lines skipped) go,
# untracked, in ${XDG_CONFIG_HOME:-~/.config}/dotfiles/private-patterns.
tracked=("$repo"/claude/.claude-*/settings.json)
# shellcheck disable=SC2016 # $HOME is matched literally
leaks=$(grep -ohE '(~|\$HOME|/Users/[^/"]+|/home/[^/"]+)/[^"[:space:]:]*' "${tracked[@]}" |
    sed -E 's#^(~|\$HOME|/Users/[^/]+|/home/[^/]+)/##' | grep -vE '^(\.|dotfiles(/|$))' | sort -u | tr '\n' ' ')
extra="${XDG_CONFIG_HOME:-$HOME/.config}/dotfiles/private-patterns"
bad_pattern=""
if [ -f "$extra" ]; then
    n=0
    while IFS= read -r p || [ -n "$p" ]; do
        n=$((n + 1))
        trimmed=${p#"${p%%[![:space:]]*}"}
        case "$trimmed" in '' | '#'*) continue ;; esac
        hits=$(grep -lE -- "$p" "${tracked[@]}" 2>/dev/null)
        rc=$?
        # grep exits 2 on an invalid pattern: that is a broken check, not a clean result
        if [ "$rc" -gt 1 ]; then
            bad_pattern="$bad_pattern $n"
        elif [ -n "$hits" ]; then
            leaks="$leaks${hits//$'\n'/ } (pattern line $n) "
        fi
    done <"$extra"
fi
if [ -n "$bad_pattern" ]; then
    fail "Tracked Claude settings name no private projects" "invalid pattern on line(s)$bad_pattern of $extra"
elif [ -z "$leaks" ]; then
    pass "Tracked Claude settings name no private projects"
else
    fail "Tracked Claude settings name no private projects" "$leaks"
fi

exit "$failed"
