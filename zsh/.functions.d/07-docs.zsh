#!/bin/zsh
# ============================================================================
# Documentation Functions
# ============================================================================
# Help and documentation: show_tools(), alias_help(), alias_search(), alias_docs(), alias_categories(), profile_startup()

# Show available modern tools and their usage
show_tools() {
    echo "🚀 Modern CLI Tools Available:"
    echo ""

    if command -v eza &>/dev/null; then
        echo "📁 eza (modern ls):"
        echo "  ls      - Basic listing with icons and git status"
        echo "  ll      - Detailed listing with headers"
        echo "  lt      - Tree view (2 levels)"
        echo ""
    fi

    if command -v bat &>/dev/null; then
        echo "📄 bat (enhanced cat):"
        echo "  cat file.js    - View with syntax highlighting"
        echo "  less README.md - Page through with highlighting"
        echo ""
    fi

    if command -v rg &>/dev/null; then
        echo "🔍 ripgrep (fast grep):"
        echo "  grep 'pattern'     - Search with ripgrep"
        echo "  rg 'TODO' --type js - Search in JS files only"
        echo ""
    fi

    if command -v lazygit &>/dev/null; then
        echo "🌿 lazygit (git TUI):"
        echo "  lg         - Open interactive git interface"
        echo "  glog       - Beautiful git log with graph"
        echo ""
    fi

    if command -v tmux &>/dev/null; then
        echo "📺 tmux (terminal multiplexer):"
        echo "  t          - Start new session"
        echo "  ta         - Attach to last session"
        echo "  tl         - List all sessions"
        echo ""
    fi

    if command -v fd &>/dev/null; then
        echo "🔎 fd (fast find):"
        echo "  find . -name '*.js' - Search for JavaScript files"
        echo "  fd -e js            - Same as above, shorter syntax"
        echo ""
    fi

    if command -v delta &>/dev/null; then
        echo "📊 delta (enhanced git diff):"
        echo "  git diff           - Shows beautiful side-by-side diffs"
        echo "  git log -p         - Log with enhanced diff display"
        echo ""
    fi

    if command -v atuin &>/dev/null; then
        echo "📚 atuin (enhanced shell history):"
        echo "  hs                 - Interactive history search"
        echo "  Option+H           - Quick history search (keybinding)"
        echo "  hstats             - Show command statistics"
        echo ""
    fi

    echo "💡 Pro tip: Type 'alias' to see all available shortcuts!"
}

# Quick alias search
alias_search() {
    if [ -z "$1" ]; then
        echo "Usage: alias_search <keyword>"
        echo "Example: alias_search git"
        return 1
    fi

    echo "🔍 Aliases containing '$1':"
    alias | grep -i "$1" | head -20
}

# Comprehensive alias documentation system
alias_help() {
    local alias_name="$1"

    if [ -z "$alias_name" ]; then
        echo "📚 Alias Documentation System"
        echo ""
        echo "Usage: alias_help <alias_name>"
        echo "       alias_docs          # Browse all aliases interactively"
        echo "       alias_categories    # Show aliases by category"
        echo ""
        echo "Examples:"
        echo "  alias_help ll           # Show help for 'll' alias"
        echo "  alias_help git          # Show all git aliases"
        echo "  alias_help gw           # Show all gradle aliases"
        echo "  alias_help docker       # Show all docker aliases"
        return 0
    fi

    # Define comprehensive alias documentation
    case "$alias_name" in
        # File Operations
        "ls" | "ll" | "la" | "lt")
            echo "📁 File Listing Aliases (eza-powered)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "ls     Enhanced listing with icons and git status"
            echo "       Example: ls -l src/"
            echo ""
            echo "ll     Detailed listing with headers and file info"
            echo "       Shows: permissions, size, date, git status"
            echo "       Example: ll ~/projects"
            echo ""
            echo "la     Show all files including hidden ones"
            echo "       Example: la # shows .env, .gitignore, etc."
            echo ""
            echo "lt     Tree view (2 levels deep)"
            echo "       Example: lt # shows directory structure"
            ;;

        "cat" | "less" | "bat")
            echo "📄 File Viewing Aliases (bat-powered)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "cat    Syntax-highlighted file viewer"
            echo "       Example: cat package.json"
            echo "       Features: syntax highlighting, git integration"
            echo ""
            echo "less   Paginated file viewer with highlighting"
            echo "       Example: less README.md"
            echo "       Keys: q (quit), / (search), n (next match)"
            ;;

        "grep" | "rg")
            echo "🔍 Search Aliases (ripgrep-powered)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "grep   Fast text search with ripgrep"
            echo "       Example: grep 'TODO' *.js"
            echo "       Features: automatic .gitignore respect, 10x faster"
            echo ""
            echo "Advanced ripgrep usage:"
            echo "  rg 'pattern' --type js    # Search only JavaScript files"
            echo "  rg 'pattern' --type bal   # Search only Ballerina files"
            echo "  rg 'error' -A 3 -B 3      # Show 3 lines context"
            echo "  rg 'function' -c          # Count matches"
            ;;

        # Git Operations
        "git" | "gits" | "gl" | "gp" | "gco" | "gb" | "ga" | "gaa" | "lg" | "glog")
            echo "🌿 Git Aliases - Enhanced Git Workflow"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Basic Git:"
            echo "  gits    git status (quick status check)"
            echo "  ga      git add (stage files)"
            echo "  gaa     git add --all (stage everything)"
            echo "  gb      git branch (list/create branches)"
            echo "  gco     git checkout (switch branches)"
            echo ""
            echo "Remote Operations:"
            echo "  gl      git pull (update from remote)"
            echo "  gp      git push (push to remote)"
            echo "  gf      git fetch (fetch without merge)"
            echo ""
            echo "Modern Git Tools:"
            echo "  lg      lazygit (interactive git TUI)"
            echo "  glog    beautiful git log with graph"
            echo "  gundo   undo last commit (keep changes)"
            echo "  gamend  amend last commit message"
            echo ""
            echo "💡 Pro tip: Use 'lg' for complex git operations!"
            ;;

        # Gradle Operations
        "gradle" | "gw" | "gwb" | "gwc" | "gwt" | "gwcb")
            echo "🏗️ Gradle Wrapper Aliases - Project Build Tool"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Core Build Tasks:"
            echo "  gw      ./gradlew (with optimized 6 max workers)"
            echo "  gwb     ./gradlew build (compile and package)"
            echo "  gwc     ./gradlew clean (clean build artifacts)"
            echo "  gwt     ./gradlew test (run all tests)"
            echo ""
            echo "Combined Operations:"
            echo "  gwcb    ./gradlew clean build (full clean build)"
            echo ""
            echo "💡 Examples:"
            echo "  gwb                      # Quick build"
            echo "  gwcb                     # Full rebuild"
            echo "  gwt --tests MyTest       # Run specific test"
            echo "  gw bootRun               # Spring Boot run"
            echo "  gw dependencies          # Show dependency tree"
            echo "  ./gradlew tasks          # Show all available tasks (use full command)"
            echo ""
            echo "💡 Note: These use ./gradlew (project wrapper), not system gw command"
            echo "💡 For Gradle tasks list, use: ./gradlew tasks (not gw tasks)"
            ;;

        # Docker Operations
        "docker" | "dps" | "dpsa" | "dex" | "dlog")
            echo "🐳 Docker Aliases - Container Management"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Container Status:"
            echo "  dps     docker ps (running containers)"
            echo "  dpsa    docker ps -a (all containers)"
            echo "  dimg    docker images (list images)"
            echo ""
            echo "Container Operations:"
            echo "  dex     docker exec -it (enter container)"
            echo "          Example: dex mycontainer bash"
            echo "  dlog    docker logs (view container logs)"
            echo "  dlogf   docker logs -f (follow logs)"
            echo "  dstop   docker stop (stop container)"
            echo ""
            echo "Cleanup:"
            echo "  dprune  docker system prune -f (cleanup unused)"
            echo ""
            echo "💡 Example workflow:"
            echo "  dps → dex myapp bash → exit → dlog myapp"
            ;;

        # Tmux Operations
        "tmux" | "t" | "ta" | "tat" | "tl" | "tn")
            echo "📺 Tmux Aliases - Terminal Multiplexer"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Session Management:"
            echo "  t       tmux (start new session)"
            echo "  ta      tmux attach (attach to last session)"
            echo "  tat     tmux attach -t <name> (attach to named)"
            echo "  tn      tmux new (create new session)"
            echo "  tl      tmux list-sessions (show all)"
            echo "  tk      tmux kill-session (kill current)"
            echo ""
            echo "Inside Tmux (prefix: Ctrl-a):"
            echo "  Ctrl-a |    Split horizontally"
            echo "  Ctrl-a -    Split vertically"
            echo "  Ctrl-a h/j/k/l    Navigate panes"
            echo "  Ctrl-a c    New window"
            echo "  Ctrl-a d    Detach session"
            echo ""
            echo "💡 Example: tn myproject → work → Ctrl-a d → ta"
            ;;

        # Network Operations
        "myip" | "localip" | "ping")
            echo "🌐 Network Aliases - Network Utilities"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "myip      Get your public IP address"
            echo "          Example: myip # returns 203.0.113.1"
            echo ""
            echo "localip   Get your local network IP"
            echo "          Example: localip # returns 192.168.1.100"
            echo ""
            echo "ping      Ping with 5 packet limit"
            echo "          Example: ping google.com"
            ;;

        # Atuin Shell History
        "atuin" | "hs" | "hstats" | "hsync")
            echo "📚 Atuin - Enhanced Shell History"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Keybindings:"
            echo "  Ctrl+R      Atuin interactive search (fuzzy search history)"
            echo "  Up arrow    Atuin prefix search (search as you type)"
            echo ""
            echo "Aliases:"
            echo "  hs          atuin search (interactive fuzzy search)"
            echo "  hstats      atuin stats (show command statistics)"
            echo "  hsync       atuin sync (sync to server if configured)"
            echo ""
            echo "Search Modes (press Ctrl+R then Tab to cycle):"
            echo "  global      Search all history (default)"
            echo "  host        Search history from this machine only"
            echo "  session     Search current session only"
            echo "  directory   Search commands run in current directory"
            echo ""
            echo "💡 Features:"
            echo "  • Fuzzy search through entire command history"
            echo "  • Statistics on command usage and patterns"
            echo "  • Optional sync across multiple machines"
            echo "  • Context-aware suggestions based on directory"
            echo "  • Secrets automatically filtered from history"
            ;;

        *)
            echo "❓ Alias '$alias_name' not found in documentation."
            echo ""
            echo "Available categories:"
            echo "  File operations: ls, ll, cat, grep"
            echo "  Git workflow: git, gits, lg, glog"
            echo "  Gradle build: gw, gwb, gwc, gwt, gwcb"
            echo "  Docker: docker, dps, dex, dlog"
            echo "  Tmux: tmux, t, ta, tl"
            echo "  Network: myip, localip, ping"
            echo "  History: atuin, hs, hstats, hsync"
            echo ""
            echo "Try: alias_docs for interactive browsing"
            ;;
    esac
}

# Interactive alias browser
alias_docs() {
    echo "📚 Interactive Alias Documentation Browser"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Select a category:"
    echo "1) 📁 File Operations (ls, cat, grep)"
    echo "2) 🌿 Git Workflow (git, lg, glog)"
    echo "3) 🐳 Docker Management (dps, dex, dlog)"
    echo "4) 📺 Tmux Sessions (t, ta, tl)"
    echo "5) 🌐 Network Utilities (myip, ping)"
    echo "6) 🔧 Development Tools (take, kill_by_port)"
    echo "7) 📋 Show All Aliases"
    echo ""
    printf "Enter choice (1-7): "
    read -r choice

    case "$choice" in
        1) alias_help ls ;;
        2) alias_help git ;;
        3) alias_help docker ;;
        4) alias_help tmux ;;
        5) alias_help myip ;;
        6)
            echo "🔧 Development Tool Functions"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "take <path>           Create directory and enter it"
            echo "take <git-url>        Clone repo and enter it"
            echo "take <archive-url>    Download, extract and enter"
            echo ""
            echo "kill_by_port <port>   Kill processes on port"
            echo "kill_by_port -d <port>  Dry run (show what would be killed)"
            echo ""
            echo "show_tools            Show all modern CLI tools"
            echo "alias_search <term>   Search aliases by keyword"
            ;;
        7)
            echo "📋 All Available Aliases"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            alias | sort | nl
            ;;
        *)
            echo "Invalid choice. Please select 1-7."
            ;;
    esac
}

# Show aliases by category
alias_categories() {
    echo "📚 Aliases by Category"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📁 FILE OPERATIONS:"
    echo "   ls, ll, la, lt - Enhanced file listing (eza)"
    echo "   cat, less - Syntax highlighted viewing (bat)"
    echo "   grep - Fast text search (ripgrep)"
    echo ""
    echo "🌿 GIT WORKFLOW:"
    echo "   gits, ga, gaa, gb, gco - Basic git operations"
    echo "   gl, gp, gf - Remote operations"
    echo "   lg, glog, gundo, gamend - Advanced git tools"
    echo ""
    echo "🐳 DOCKER:"
    echo "   dps, dpsa, dimg - Container/image status"
    echo "   dex, dlog, dlogf - Container operations"
    echo "   dstop, drm, dprune - Management"
    echo ""
    echo "📺 TMUX:"
    echo "   t, ta, tat, tn, tl, tk - Session management"
    echo ""
    echo "🌐 NETWORK:"
    echo "   myip, localip, ping - Network utilities"
    echo ""
    echo "🔧 DEVELOPMENT:"
    echo "   take, kill_by_port, show_tools - Dev utilities"
    echo "   profile_startup - Test shell startup performance"
    echo "   manage_packages - Configure package installation"
    echo ""
    echo "For detailed help: alias_help <alias_name>"
}

# Profile shell startup performance
profile_startup() {
    # Check if we have the profiler script
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    fi

    if [ -n "$dotfiles_dir" ] && [ -f "$dotfiles_dir/bin/profile-startup" ]; then
        "$dotfiles_dir/bin/profile-startup"
    else
        echo "🚀 Quick Shell Startup Performance Test"
        echo "======================================"
        echo ""
        echo "Testing shell startup time (3 runs)..."

        local times=()
        for i in {1..3}; do
            echo -n "Test $i/3: "
            local time_output
            local total_time
            time_output=$(time zsh -i -c exit 2>&1)
            total_time=$(echo "$time_output" | grep -o '[0-9.]*s.*total' | grep -o '^[0-9.]*')
            times+=("$total_time")
            echo "${total_time}s"
        done

        echo ""
        echo "Results: ${times[*]}"
        echo ""
        echo "Performance targets:"
        echo "• < 0.2s: Excellent (instant)"
        echo "• < 0.4s: Good (very responsive)"
        echo "• < 0.8s: Acceptable (responsive)"
        echo "> 1.5s: Slow (needs optimization)"
        echo ""
        echo "For detailed analysis, use the full profiler:"
        echo "  $dotfiles_dir/bin/profile-startup"
    fi
}
