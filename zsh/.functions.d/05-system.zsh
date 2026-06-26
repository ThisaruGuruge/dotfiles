#!/bin/zsh
# ============================================================================
# System Functions
# ============================================================================
# System utilities: checkPort(), kill_by_port()

checkPort() {
    lsof -i:"$1"
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
                echo "Kill processes running on the specified port"
                echo ""
                echo "Options:"
                echo "  -d, --dry-run    List processes without killing them"
                echo "  -h, --help       Show this help message"
                echo ""
                echo "Examples:"
                echo "  kill_by_port 3000        # Kill processes on port 3000"
                echo "  kill_by_port -d 3000     # List processes on port 3000 (dry run)"
                return 0
                ;;
            -*)
                echo "Unknown option: $1"
                echo "Use -h or --help for usage information"
                return 1
                ;;
            *)
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

    # Find processes on the port
    local apps
    apps="$(lsof -i:"$port_arg" 2>/dev/null)"

    if [ -z "$apps" ]; then
        echo "No processes found using port $port_arg"
        return 0
    fi

    echo "Processes found on port $port_arg:"
    echo "$apps"
    echo ""

    if [ "$dry_run" = true ]; then
        local pids_string
        pids_string="$(lsof -t -i:"$port_arg" 2>/dev/null)"
        echo "[DRY RUN] Would kill processes with PIDs: $pids_string"
        echo "Command that would be executed: kill -9 $pids_string"
    else
        local pids_string
        pids_string="$(lsof -t -i:"$port_arg" 2>/dev/null)"

        if [ -n "$pids_string" ]; then
            # Try to kill each PID individually to get better error reporting
            local kill_failed=false
            while IFS= read -r pid; do
                if [ -n "$pid" ]; then
                    if kill -9 "$pid" 2>/dev/null; then
                        echo "Successfully killed process: $pid"
                    else
                        echo "Failed to kill process: $pid"
                        echo "This may happen if:"
                        echo "  • Process is owned by another user (try with sudo)"
                        echo "  • Process has already terminated"
                        echo "  • System protection prevented termination"
                        kill_failed=true
                    fi
                fi
            done <<<"$pids_string"

            if [ "$kill_failed" = true ]; then
                return 1
            fi
        else
            echo "Warning: No PIDs found to kill"
            return 1
        fi
    fi
}
