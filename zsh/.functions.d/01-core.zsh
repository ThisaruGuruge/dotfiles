#!/bin/zsh
# ============================================================================
# Core Utility Functions
# ============================================================================
# Essential functions used by other modules: cd(), confirm()

# Smart cd function that uses zoxide (z) for interactive use,
# but falls back to builtin cd for non-interactive use (scripts, AI tools, etc.)
# This allows tools like Claude to execute cd commands properly while
# still giving you the benefit of zoxide's smart directory jumping
cd() {
    # Check if this is an interactive shell with a terminal
    if [[ -o interactive ]] && [[ -t 0 ]]; then
        # Interactive use - use zoxide for smart directory jumping
        if command -v __zoxide_z >/dev/null 2>&1; then
            __zoxide_z "$@"
        else
            # Fallback if zoxide isn't loaded yet
            builtin cd "$@"
        fi
    else
        # Non-interactive use (scripts, tools like Claude) - use builtin cd
        builtin cd "$@"
    fi
}

# Enhanced user confirmation function with single key press
confirm() {
    while true; do
        echo ""
        echo -en "  ${YELLOW}$1 (y/n/q): ${NC}"
        read -r -n 1 -s key # Read single character silently without echo
        echo                # Print newline after keypress

        case "$key" in
            [Yy])
                echo -e "  ${GREEN}→ Yes${NC}"
                echo ""
                return 0
                ;;
            [Nn])
                echo -e "  ${RED}→ No${NC}"
                echo ""
                return 1
                ;;
            [Qq])
                echo -e "  ${YELLOW}→ Quit${NC}"
                echo ""
                echo "  Cancelled by user"
                exit 0
                ;;
            *)
                echo -e "  ${YELLOW}⚠️ Please press 'y' for yes, 'n' for no, or 'q' to quit.${NC}"
                ;;
        esac
    done
}
