compress () {
    tar -czvf "$1.tar.gz" $1
}

extract () {
    if [ -f $1 ] ; then
        case $1 in
            *.tar.bz2)   tar xjf $1     ;;
            *.tar.gz)    tar xzf $1     ;;
            *.bz2)       bunzip2 $1     ;;
            *.rar)       unrar e $1     ;;
            *.gz)        gunzip $1      ;;
            *.tar)       tar xf $1      ;;
            *.tbz2)      tar xjf $1     ;;
            *.tgz)       tar xzf $1     ;;
            *.zip)       unzip $1       ;;
            *.Z)         uncompress $1  ;;
            *.7z)        7z x $1        ;;
            *)     echo "'$1' cannot be extracted via extract()" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

checkPort() {
    lsof -i:$1
}

kill_by_port() {
    local dry_run=false
    local port_arg=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
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

    if ! [[ "$port_arg" =~ ^[0-9]+$ ]] || [ "$port_arg" -lt 1000 ] || [ "$port_arg" -gt 65534 ]; then
        echo "Invalid input: $port_arg. Enter a valid port number. (Numbers must be between 1000-65534)"
        return 1
    else
        apps="$(lsof -i:$port_arg)"
        if [ -z "$apps" ]
        then
            echo "No apps using the port $port_arg"
        else
            echo "Apps found on port $port_arg:"
            echo "$apps"

            if [ "$dry_run" = true ]; then
                echo "
[DRY RUN] The above processes would be killed with: kill -9 $(lsof -t -i:$port_arg)"
            else
                #read "resonse?Do you want to kill these ? (y/N): "
                #if [[ $response =~ '^[yY]$' ]]
                #then
                kill -9 $(lsof -t -i:$port_arg)
                echo "Killed Apps"
                #else
                #    echo "Quit"
                #fi
            fi
        fi
    fi
}

function take() {
    if [ -z "$1" ]; then
        echo "Usage: take <directory|git-repo|archive-url>"
        return 1
    fi

    # Check for archive URLs
    if [[ $1 =~ ^(https?|ftp).*\.(tar\.gz|tar\.bz2|tar\.xz|tgz|tbz2)$ ]]; then
        takeurl "$1"
    # Check for git repositories (various formats)
    elif [[ $1 =~ ^(https?://.*\.git|git@.*:.*\.git|ssh://.*\.git|.*\.git)/?$ ]] || [[ $1 =~ ^https?://github\.com/.*/.*$ ]] || [[ $1 =~ ^https?://gitlab\.com/.*/.*$ ]] || [[ $1 =~ ^https?://bitbucket\.org/.*/.*$ ]]; then
        takegit "$1"
    # Default to directory creation
    else
        takedir "$@"
    fi
}

function takedir() {
    if [ $# -eq 0 ]; then
        echo "Usage: takedir <directory> [subdirectories...]"
        return 1
    fi

    local target_dir="${@: -1}"  # Last argument is the final directory

    echo "Creating directory: $*"
    if mkdir -p "$@"; then
        cd "$target_dir"
        echo "Created and entered $(pwd)"
    else
        echo "Failed to create directory: $*"
        return 1
    fi
}

function takegit() {
    local repo_url="$1"
    local repo_name

    # Extract repository name from various URL formats
    if [[ $repo_url =~ .*/([^/]+)\.git/?$ ]]; then
        repo_name="${match[1]}"
    elif [[ $repo_url =~ .*/([^/]+)/?$ ]]; then
        repo_name="${match[1]}"
    else
        repo_name="$(basename "$repo_url" .git)"
    fi

    echo "Cloning $repo_url into $repo_name..."
    if git clone "$repo_url" "$repo_name"; then
        cd "$repo_name"
        echo "Successfully cloned and entered $repo_name"
    else
        echo "Failed to clone repository: $repo_url"
        return 1
    fi
}

function takeurl() {
    local url="$1"
    local temp_file temp_dir extracted_dir

    temp_file="$(mktemp)"
    temp_dir="$(mktemp -d)"

    echo "Downloading $url..."
    if ! curl -L "$url" -o "$temp_file"; then
        echo "Failed to download $url"
        rm -f "$temp_file"
        rmdir "$temp_dir" 2>/dev/null
        return 1
    fi

    echo "Extracting archive..."
    cd "$temp_dir"

    # Determine extraction method based on file type
    case "$url" in
        *.tar.gz|*.tgz)
            tar -xzf "$temp_file"
            ;;
        *.tar.bz2|*.tbz2)
            tar -xjf "$temp_file"
            ;;
        *.tar.xz)
            tar -xJf "$temp_file"
            ;;
        *.tar)
            tar -xf "$temp_file"
            ;;
        *)
            echo "Unsupported archive format"
            cd - > /dev/null
            rm -f "$temp_file"
            rmdir "$temp_dir" 2>/dev/null
            return 1
            ;;
    esac

    # Find the extracted directory
    extracted_dir="$(find . -maxdepth 1 -type d ! -name '.' | head -n 1)"

    if [ -n "$extracted_dir" ]; then
        cd "$extracted_dir"
        echo "Extracted and entered $(basename "$extracted_dir")"
    else
        echo "No directory found in archive, staying in temp directory"
    fi

    rm -f "$temp_file"
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

  echo "$1" >> "$repo_root/.git/info/exclude"
  echo "Added '$1' to $repo_root/.git/info/exclude"
}

# Show available modern tools and their usage
show_tools() {
    echo "🚀 Modern CLI Tools Available:"
    echo ""

    if command -v eza &> /dev/null; then
        echo "📁 eza (modern ls):"
        echo "  ls      - Basic listing with icons and git status"
        echo "  ll      - Detailed listing with headers"
        echo "  lt      - Tree view (2 levels)"
        echo ""
    fi

    if command -v bat &> /dev/null; then
        echo "📄 bat (enhanced cat):"
        echo "  cat file.js    - View with syntax highlighting"
        echo "  less README.md - Page through with highlighting"
        echo ""
    fi

    if command -v rg &> /dev/null; then
        echo "🔍 ripgrep (fast grep):"
        echo "  grep 'pattern'     - Search with ripgrep"
        echo "  rg 'TODO' --type js - Search in JS files only"
        echo ""
    fi

    if command -v lazygit &> /dev/null; then
        echo "🌿 lazygit (git TUI):"
        echo "  lg         - Open interactive git interface"
        echo "  glog       - Beautiful git log with graph"
        echo ""
    fi

    if command -v tmux &> /dev/null; then
        echo "📺 tmux (terminal multiplexer):"
        echo "  t          - Start new session"
        echo "  ta         - Attach to last session"
        echo "  tl         - List all sessions"
        echo ""
    fi

    if command -v fd &> /dev/null; then
        echo "🔎 fd (fast find):"
        echo "  find . -name '*.js' - Search for JavaScript files"
        echo "  fd -e js            - Same as above, shorter syntax"
        echo ""
    fi

    if command -v delta &> /dev/null; then
        echo "📊 delta (enhanced git diff):"
        echo "  git diff           - Shows beautiful side-by-side diffs"
        echo "  git log -p         - Log with enhanced diff display"
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
        "ls"|"ll"|"la"|"lt")
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

        "cat"|"less"|"bat")
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

        "grep"|"rg")
            echo "🔍 Search Aliases (ripgrep-powered)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "grep   Fast text search with ripgrep"
            echo "       Example: grep 'TODO' *.js"
            echo "       Features: automatic .gitignore respect, 10x faster"
            echo ""
            echo "Advanced ripgrep usage:"
            echo "  rg 'pattern' --type js    # Search only JavaScript files"
            echo "  rg 'error' -A 3 -B 3      # Show 3 lines context"
            echo "  rg 'function' -c          # Count matches"
            ;;

        # Git Operations
        "git"|"gits"|"gl"|"gp"|"gco"|"gb"|"ga"|"gaa"|"lg"|"glog")
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
        "gradle"|"gw"|"gwb"|"gwc"|"gwt"|"gwcb")
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
        "docker"|"dps"|"dpsa"|"dex"|"dlog")
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
        "tmux"|"t"|"ta"|"tat"|"tl"|"tn")
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
        "myip"|"localip"|"ping")
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
    read choice

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
    echo ""
    echo "For detailed help: alias_help <alias_name>"
}
