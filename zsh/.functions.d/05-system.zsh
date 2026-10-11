#!/bin/zsh
# ============================================================================
# System Functions
# ============================================================================
# System utilities: checkPort(), dif(), da(), awake(), kill_by_port()

checkPort() {
    lsof -i:"$1"
}

# Compare two files with delta's rendering (side-by-side, line numbers,
# syntax highlighting) instead of plain diff output. Kept as its own name
# rather than aliasing `diff` itself, since Claude Code (and other tools
# that source shell aliases) would otherwise get delta's colorized output
# instead of plain, parseable diff.
dif() {
    if ! command -v delta >/dev/null 2>&1; then
        echo "Error: delta is not installed" >&2
        echo "Install with: brew install git-delta" >&2
        return 1
    fi
    diff -u "$@" | delta
}

# dust's -n/--number-of-lines defaults to the terminal height and silently
# truncates larger trees with no built-in pager. Raise the cap and pipe
# through less to get a scrollable full view instead.
# Output is captured first rather than streamed directly into less: dust
# (like many Rust CLIs) doesn't reset SIGPIPE to its default disposition, so
# if less exits early (e.g. -F auto-quitting on output that fits one screen)
# dust panics with "Broken pipe" instead of exiting quietly. Capturing lets
# dust always run to completion before less ever reads anything.
da() {
    if ! command -v dust >/dev/null 2>&1; then
        echo "Error: dust is not installed" >&2
        echo "Install with: brew install dust" >&2
        return 1
    fi
    local output
    output="$(dust -n 9999 "$@" 2>&1)" || return $?
    printf '%s\n' "$output" | less -R -F -X
}

# ----------------------------------------------------------------------------
# awake: keep the Mac from idle-sleeping while long-running work (agents,
# builds, downloads) happens in the background.
#
#   awake                  hold in the background (caffeinate -i): idle sleep is
#                          blocked, the display may still sleep/lock. Works on
#                          AC and on battery.
#   awake screen           also keep the display on (-d)
#   awake ac               AC-only (caffeinate -s): the hold drops on unplug
#   awake for <time|pid>   timed (2h, 30m, 90s; -t) or tied to a PID (-w)
#   awake stop | status
#   --floor N              battery floor in percent (default 20, or set
#                          AWAKE_BATTERY_FLOOR)
#
# Battery safety: a watcher process (`zsh -f -c ... dotfiles-awake-watch
# <hold-pid> ...`, started with `zsh -f` so it inherits none of the
# interactive shell's traps, hooks or options) polls `pmset -g batt` every 60s
# (AWAKE_POLL_SECS overrides, mainly for tests). On battery at or below the
# floor it releases the hold and posts a macOS notification, so the Mac sleeps
# normally instead of draining to zero.
#
# Honest limit: this does not stop lid-close sleep. Closing the lid still
# sleeps the Mac unless it is on AC power with an external display attached
# (clamshell mode).
#
# State: ${TMPDIR:-/tmp}/dotfiles-awake.pid holds only the caffeinate PID (one
# line; other tools, e.g. a tmux status segment, may test it with `kill -0`);
# dotfiles-awake.state next to it holds mode/since/floor/watcher for `status`,
# and dotfiles-awake.lock serialises start/stop between shells. On macOS
# TMPDIR is the per-user /var/folders/.../T directory; a shell that overrides
# TMPDIR (some sandboxes do) sees its own, separate hold. The paths are
# resolved on every call rather than kept in global variables, because
# function-only shell snapshots (Claude Code's) drop plain variables.
# ----------------------------------------------------------------------------

# Set the caller's local pidfile/statefile/lockfile (callers declare them).
_awake_paths() {
    pidfile="${TMPDIR:-/tmp}/dotfiles-awake.pid"
    statefile="${pidfile%.pid}.state"
    lockfile="${pidfile%.pid}.lock"
}

# Take the start/stop lock into the caller's local lockfd. fcntl locks belong
# to the process holding them: they go away when it exits and are not
# inherited by the hold or the watcher, so nothing can leave the lock stuck.
_awake_lock() {
    zmodload -F zsh/system b:zsystem 2>/dev/null || return 0
    { : >>"$lockfile"; } 2>/dev/null || return 2
    zsystem flock -t "${1:-5}" -i 0.05 -f lockfd "$lockfile" 2>/dev/null
}

_awake_unlock() {
    [[ -n "$lockfd" ]] && zsystem flock -u "$lockfd" 2>/dev/null
    return 0
}

# Run "$@" while holding the lock.
_awake_locked() {
    local pidfile statefile lockfile lockfd=""
    _awake_paths
    _awake_lock
    case $? in
        0) ;;
        2)
            echo "awake: cannot create $lockfile (is ${TMPDIR:-/tmp} writable?)" >&2
            return 1
            ;;
        *)
            echo "awake: another 'awake' is starting or stopping; try again." >&2
            return 1
            ;;
    esac
    {
        "$@"
    } always {
        _awake_unlock
    }
}

# Print "<battery|ac> <percent>" ("ac " when the Mac has no battery).
_awake_power() {
    local out src pct=""
    out="$(pmset -g batt 2>/dev/null)" || return 1
    if [[ "$out" == *"Battery Power"* ]]; then src=battery; else src=ac; fi
    [[ "$out" =~ '([0-9]+)%' ]] && pct="${match[1]}"
    print -r -- "$src $pct"
}

# True when <pid> is a live process whose executable is named caffeinate. It
# checks the executable name (ps comm), not the argument list, so a reused PID
# or something like `vim caffeinate.md` never counts.
_awake_alive() {
    local pid="$1" comm
    [[ "$pid" == <-> ]] && ((pid > 1)) || return 1
    comm="$(ps -p "$pid" -o comm= 2>/dev/null)" || return 1
    comm="${comm:t}"
    [[ "${comm%% *}" == caffeinate ]]
}

# True when <pid> is the watcher of hold <hold>, matched on its marker
# argument, so a stale state file plus PID reuse can never kill an unrelated
# process (another shell, an editor, a build).
_awake_is_watcher() {
    local pid="$1" hold="$2" args
    [[ "$pid" == <-> && "$hold" == <-> ]] && ((pid > 1)) || return 1
    args="$(ps -ww -p "$pid" -o args= 2>/dev/null)" || return 1
    [[ "$args" == *" dotfiles-awake-watch $hold "* ]]
}

# True when the pidfile points at a live hold (caller has run _awake_paths).
_awake_active() {
    [[ -f "$pidfile" ]] && _awake_alive "$(<"$pidfile")"
}

# Load the state file into the caller's local associative array awake_state.
_awake_load() {
    awake_state=()
    [[ -r "$statefile" ]] || return 1
    local k v
    while IFS='=' read -r k v; do
        [[ -n "$k" ]] && awake_state[$k]="$v"
    done <"$statefile"
}

_awake_notify() {
    command -v osascript >/dev/null 2>&1 || return 0
    osascript -e "display notification \"$1\" with title \"awake\"" >/dev/null 2>&1
}

# Convert 30m / 2h / 90s / 1d to seconds.
_awake_parse_duration() {
    [[ "$1" =~ '^([0-9]+)([smhd])$' ]] || return 1
    local n="${match[1]}" unit="${match[2]}"
    ((n > 0)) || return 1
    case "$unit" in
        s) print $((n)) ;;
        m) print $((n * 60)) ;;
        h) print $((n * 3600)) ;;
        d) print $((n * 86400)) ;;
    esac
}

_awake_fmt_secs() {
    local s="$1" h m
    h=$((s / 3600))
    m=$(((s % 3600) / 60))
    if ((h > 0)); then
        print "${h}h ${m}m"
    elif ((m > 0)); then
        print "${m}m"
    else
        print "${s}s"
    fi
}

# Watcher body, run in its own `zsh -f` process:
#   <hold-pid> <floor> <pidfile> <statefile> <lockfile>
# Releases the hold when on battery at or below the floor (floor -1 disables
# that), and removes the state files once the hold ends for any reason.
_awake_watch() {
    local hold="$1" floor="$2" pidfile="$3" statefile="$4" lockfile="$5"
    local poll="${AWAKE_POLL_SECS:-60}" power src pct napper="" lockfd=""
    [[ "$poll" == <->(|.<->) ]] && ((poll > 0)) || poll=60
    trap '[[ -n "$napper" ]] && kill "$napper" 2>/dev/null; exit 0' TERM
    while _awake_alive "$hold"; do
        power="$(_awake_power)"
        src="${power%% *}"
        pct="${power#* }"
        if [[ "$src" == battery && "$pct" == <-> ]] && ((pct <= floor)); then
            kill "$hold" 2>/dev/null
            _awake_notify "Battery at ${pct}% (floor ${floor}%): released the awake hold so the Mac can sleep."
            break
        fi
        sleep "$poll" &
        napper=$!
        wait "$napper"
        napper=""
    done
    _awake_lock
    if [[ -f "$pidfile" && "$(<"$pidfile")" == "$hold" ]]; then
        rm -f "$pidfile" "$statefile"
    fi
    _awake_unlock
}

# Release the hold. "quiet" skips the messages.
_awake_stop() {
    local quiet="$1" pidfile statefile lockfile pid
    local -A awake_state
    _awake_paths
    if [[ ! -f "$pidfile" ]]; then
        rm -f "$statefile"
        [[ -n "$quiet" ]] || echo "awake: not active."
        return 0
    fi
    pid="$(<"$pidfile")"
    _awake_load
    # The watcher goes first, so it cannot clean up state that a new hold is
    # about to write. It is only killed when it is verifiably this hold's
    # watcher; otherwise it exits on its own at its next poll.
    if _awake_is_watcher "${awake_state[watcher]}" "$pid"; then
        kill "${awake_state[watcher]}" 2>/dev/null
    fi
    if _awake_alive "$pid"; then
        kill "$pid" 2>/dev/null
        [[ -n "$quiet" ]] || echo "awake: stopped (PID $pid)."
    else
        [[ -n "$quiet" ]] || echo "awake: was not running (cleaned up stale state)."
    fi
    rm -f "$pidfile" "$statefile"
}

_awake_status() {
    local pidfile statefile lockfile power src pct pid since floor_txt ac_hold=0
    local -A awake_state
    _awake_paths
    if _awake_active; then
        pid="$(<"$pidfile")"
        _awake_load
        echo "awake: active"
        if [[ "${awake_state[ac]}" == 1 ]]; then
            ac_hold=1
            echo "  mode:    AC only (caffeinate -s): holds while plugged in, drops on unplug"
            [[ "${awake_state[screen]}" == 1 ]] && echo "           plus display kept on (-d)"
        elif [[ "${awake_state[screen]}" == 1 ]]; then
            echo "  mode:    idle sleep and display sleep blocked (caffeinate -i -d)"
        else
            echo "  mode:    idle sleep blocked (caffeinate -i); the display may sleep/lock"
        fi
        since="${awake_state[since]}"
        if [[ "$since" == <-> ]]; then
            echo "  since:   $(date -r "$since" '+%a %H:%M') ($(_awake_fmt_secs $(($(date +%s) - since))) ago)"
        fi
        if [[ "${awake_state[until]}" == <-> ]]; then
            echo "  ends:    $(date -r "${awake_state[until]}" '+%a %H:%M') (timed)"
        elif [[ -n "${awake_state[waitpid]}" ]]; then
            echo "  ends:    when PID ${awake_state[waitpid]} exits"
        fi
        echo "  hold:    caffeinate PID $pid"
        floor_txt="${awake_state[floor]}"
    else
        [[ -f "$pidfile" ]] && rm -f "$pidfile" "$statefile"
        echo "awake: not active"
        floor_txt="${AWAKE_BATTERY_FLOOR:-20}"
    fi

    power="$(_awake_power)"
    src="${power%% *}"
    pct="${power#* }"
    if [[ "$src" == battery ]]; then
        if ((ac_hold)); then
            echo "  power:   battery ${pct:-?}%; the AC-only hold does not apply on battery"
        else
            echo "  power:   battery ${pct:-?}%; released automatically at <= ${floor_txt}%"
        fi
    elif [[ -n "$pct" ]]; then
        if ((ac_hold)); then
            echo "  power:   AC, battery ${pct}%; the AC-only hold drops if unplugged"
        else
            echo "  power:   AC, battery ${pct}%; floor ${floor_txt}% applies if unplugged"
        fi
    else
        echo "  power:   AC (no battery)"
    fi
    return 0
}

_awake_usage() {
    cat <<'USAGE'
Usage: awake [screen] [ac] [for <2h|30m|90s|pid>] [--floor N]
       awake stop | status

  awake                  keep the Mac from idle-sleeping (display may still sleep/lock)
  awake screen           also keep the display on
  awake ac               AC power only; the hold drops when unplugged
  awake for 2h           hold for 2h (also 30m, 90s, 1d)
  awake for 4321         hold until process 4321 exits
  awake stop             release the hold
  awake status           mode, since when, battery %, floor

  --floor N              on battery, release at N% or below (default 20,
                         env AWAKE_BATTERY_FLOOR); a notification is posted

Closing the lid still sleeps the Mac unless it is on AC with an external display.
USAGE
}

# Start (or replace) the hold. Runs under _awake_locked and reads awake()'s
# locals: ac, screen, floor, flags, sig, secs, waitpid, until_epoch.
_awake_start() {
    local -A awake_state
    local replacing=0 hold watcher i watch_floor="$floor"
    if _awake_active; then
        _awake_load
        if [[ "${awake_state[sig]}" == "$sig" ]]; then
            echo "awake: already active (PID $(<"$pidfile")). 'awake status' for details."
            return 0
        fi
        replacing=1
    fi

    # Start the new hold before touching the old one, so a failed start
    # leaves the existing hold in place.
    nohup caffeinate "${flags[@]}" >/dev/null 2>&1 </dev/null &|
    hold=$!
    for i in {1..10}; do
        sleep 0.1
        _awake_alive "$hold" && break
        kill -0 "$hold" 2>/dev/null || break
    done
    if ! _awake_alive "$hold"; then
        kill "$hold" 2>/dev/null
        echo "awake: caffeinate did not start (flags: ${flags[*]})" >&2
        ((replacing)) && echo "       The previous hold is unchanged." >&2
        return 1
    fi
    if ((replacing)); then
        _awake_stop quiet
        echo "awake: replaced the previous hold with the new settings."
    fi

    ((ac)) && watch_floor=-1
    AWAKE_WATCH_SRC="$(typeset -f _awake_alive _awake_power _awake_notify _awake_lock _awake_unlock _awake_watch)" \
        nohup "${commands[zsh]:-/bin/zsh}" -f -c 'eval "$AWAKE_WATCH_SRC"; unset AWAKE_WATCH_SRC; _awake_watch "$@"' \
        dotfiles-awake-watch "$hold" "$watch_floor" "$pidfile" "$statefile" "$lockfile" \
        </dev/null >/dev/null 2>&1 &|
    watcher=$!

    if ! {
        print -r -- "$hold" >"$pidfile" &&
            {
                print -r -- "sig=$sig"
                print -r -- "ac=$ac"
                print -r -- "screen=$screen"
                print -r -- "floor=$floor"
                print -r -- "since=$(date +%s)"
                print -r -- "watcher=$watcher"
                [[ -n "$until_epoch" ]] && print -r -- "until=$until_epoch"
                [[ -n "$waitpid" ]] && print -r -- "waitpid=$waitpid"
                true
            } >"$statefile"
    } 2>/dev/null; then
        kill "$watcher" "$hold" 2>/dev/null
        rm -f "$pidfile" "$statefile" 2>/dev/null
        echo "awake: could not write $pidfile or its state file; released the hold." >&2
        return 1
    fi

    local desc="idle sleep blocked"
    ((ac)) && desc="AC power only"
    ((screen)) && desc="$desc, display kept on"
    echo "awake: holding ($desc), PID $hold."
    [[ -n "$secs" ]] && echo "       for $(_awake_fmt_secs "$secs")."
    [[ -n "$waitpid" ]] && echo "       until PID $waitpid exits."
    ((! ac)) && echo "       On battery it releases itself at ${floor}% or below."
    echo "       Release with 'awake stop'."
    return 0
}

awake() {
    setopt local_options no_monitor no_notify

    case "${1:-}" in
        stop)
            _awake_locked _awake_stop
            return $?
            ;;
        status)
            _awake_status
            return 0
            ;;
        -h | --help | help)
            _awake_usage
            return 0
            ;;
    esac

    local ac=0 screen=0 target="" floor="${AWAKE_BATTERY_FLOOR:-20}"
    while (($# > 0)); do
        case "$1" in
            screen) screen=1 ;;
            ac) ac=1 ;;
            for)
                if [[ -z "${2:-}" ]]; then
                    echo "awake: 'for' needs a duration (e.g. 2h) or a PID" >&2
                    return 1
                fi
                target="$2"
                shift
                ;;
            --floor)
                floor="${2:-}"
                shift
                ;;
            --floor=*) floor="${1#--floor=}" ;;
            *)
                echo "awake: unknown argument '$1'" >&2
                _awake_usage >&2
                return 1
                ;;
        esac
        shift
    done

    if ! [[ "$floor" == <-> ]] || ((floor > 100)); then
        echo "awake: battery floor must be a percentage between 0 and 100 (got '$floor')" >&2
        return 1
    fi

    local -a flags
    local secs="" waitpid="" until_epoch=""
    if ((ac)); then flags=(-s); else flags=(-i); fi
    ((screen)) && flags+=(-d)
    if [[ -n "$target" ]]; then
        if secs="$(_awake_parse_duration "$target")"; then
            flags+=(-t "$secs")
            until_epoch=$(($(date +%s) + secs))
        elif [[ "$target" == <-> ]]; then
            # ps -p (not kill -0, which fails with EPERM for other users'
            # processes); PIDs 0 and 1 are never a meaningful target.
            if ((target <= 1)) || ! ps -p "$target" >/dev/null 2>&1; then
                echo "awake: no running process with PID $target" >&2
                return 1
            fi
            waitpid="$target"
            flags+=(-w "$waitpid")
        else
            echo "awake: '$target' is neither a duration (30m, 2h, 90s) nor a PID" >&2
            return 1
        fi
    fi

    # Validate before touching any existing hold: starting on battery already
    # below the floor would be released at once.
    local power src pct
    power="$(_awake_power)"
    src="${power%% *}"
    pct="${power#* }"
    if ((! ac)) && [[ "$src" == battery && "$pct" == <-> ]] && ((pct <= floor)); then
        echo "awake: battery is at ${pct}% (floor ${floor}%), so the hold would be released at once." >&2
        echo "       Plug in, or lower the floor: awake --floor N" >&2
        return 1
    fi

    local sig="ac=$ac screen=$screen target=$target floor=$floor"
    _awake_locked _awake_start
}

kill_by_port() {
    local dry_run=false
    local port_arg=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d | --dry-run)
                dry_run=true
                shift
                ;;
            -h | --help)
                echo "Usage: kill_by_port [OPTIONS] PORT"
                echo "Stop the process LISTENING on a TCP port (clients connected to it,"
                echo "such as a browser, are left alone). Sends SIGTERM, waits about 1s,"
                echo "then SIGKILLs anything still running. TCP only: UDP sockets are"
                echo "not looked at. The current shell and its parent are never killed."
                echo ""
                echo "Options:"
                echo "  -d, --dry-run    List processes without killing them"
                echo "  -h, --help       Show this help message"
                echo ""
                echo "Examples:"
                echo "  kill_by_port 3000        # Stop the listener on port 3000"
                echo "  kill_by_port -d 3000     # List it only (dry run)"
                return 0
                ;;
            -*)
                echo "Unknown option: $1"
                echo "Use -h or --help for usage information"
                return 1
                ;;
            *)
                if [ -n "$port_arg" ]; then
                    echo "Error: only one port at a time (got '$port_arg' and '$1')"
                    echo "Use -h or --help for usage information"
                    return 1
                fi
                port_arg="$1"
                shift
                ;;
        esac
    done

    # Check if port argument was provided
    if [ -z "$port_arg" ]; then
        echo "Error: Port number is required"
        echo "Use -h or --help for usage information"
        return 1
    fi

    # Validate port number
    if ! [[ "$port_arg" =~ ^[0-9]+$ ]]; then
        echo "Error: '$port_arg' is not a valid number"
        echo "Port must be a numeric value (e.g., 3000, 8080)"
        return 1
    fi

    if [ "$port_arg" -lt 1 ] || [ "$port_arg" -gt 65535 ]; then
        echo "Error: Port $port_arg is out of valid range"
        echo "Port must be between 1 and 65535 (recommended: 1024-65535)"
        return 1
    fi

    # Check if lsof is available
    if ! command -v lsof >/dev/null 2>&1; then
        echo "Error: lsof is not installed or not in PATH"
        echo "Install with: brew install lsof"
        return 1
    fi

    # Listeners only: a bare `lsof -i:PORT` also matches every client connected
    # to the port (browsers, curl, other services) and would kill those too.
    local apps
    apps="$(lsof -nP -iTCP:"$port_arg" -sTCP:LISTEN 2>/dev/null)"

    if [ -z "$apps" ]; then
        echo "No process is listening on port $port_arg"
        return 0
    fi

    echo "Listening on port $port_arg:"
    echo "$apps"
    echo ""

    local -a pids
    pids=(${(u)${(f)"$(lsof -t -nP -iTCP:"$port_arg" -sTCP:LISTEN 2>/dev/null)"}})
    # Never take down the shell running this (or its parent, e.g. the terminal
    # or tmux pane process) if it happens to own the listening socket.
    local self
    for self in $$ $PPID; do
        if ((${pids[(Ie)$self]})); then
            echo "Skipping PID $self: it is this shell or its parent"
            pids=(${pids:#$self})
        fi
    done
    if ((${#pids} == 0)); then
        echo "Warning: No PIDs found to kill"
        return 1
    fi

    if [ "$dry_run" = true ]; then
        echo "[DRY RUN] Would send SIGTERM to: ${pids[*]}"
        echo "[DRY RUN] Survivors would get SIGKILL after about 1 second"
        return 0
    fi

    local pid kill_failed=false
    local -a signalled survivors
    for pid in "${pids[@]}"; do
        if kill -TERM "$pid" 2>/dev/null; then
            signalled+=("$pid")
        else
            echo "Failed to signal process: $pid"
            echo "This may happen if:"
            echo "  • Process is owned by another user (try with sudo)"
            echo "  • Process has already terminated"
            echo "  • System protection prevented termination"
            kill_failed=true
        fi
    done

    # Give the processes up to ~1s to exit cleanly before escalating.
    local i
    for i in {1..10}; do
        survivors=()
        for pid in "${signalled[@]}"; do
            kill -0 "$pid" 2>/dev/null && survivors+=("$pid")
        done
        ((${#survivors} == 0)) && break
        sleep 0.1
    done

    for pid in "${signalled[@]}"; do
        if ((${survivors[(Ie)$pid]})); then
            if kill -KILL "$pid" 2>/dev/null; then
                echo "Force-killed process: $pid (did not exit on SIGTERM)"
            else
                echo "Failed to kill process: $pid"
                kill_failed=true
            fi
        else
            echo "Stopped process: $pid"
        fi
    done

    [ "$kill_failed" = true ] && return 1
    return 0
}
