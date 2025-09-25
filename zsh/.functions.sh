# Edit secrets in .env file (handles both encrypted and plaintext)
edit_secrets() {
    local env_file="$HOME/.env"
    local temp_file=$(mktemp)

    # Check if SOPS is available
    if ! command -v sops >/dev/null 2>&1; then
        echo "❌ SOPS is not installed. Install it with: brew install sops"
        return 1
    fi

    # Check if age key exists
    if [ ! -f "$HOME/.config/sops/age/keys.txt" ]; then
        echo "❌ Age encryption key not found. Run ./init.sh to set up secret management first."
        return 1
    fi

    # Handle existing .env file
    if [ -f "$env_file" ]; then
        # Check if encrypted
        if head -1 "$env_file" | grep -q "^#ENC\["; then
            echo "🔓 Decrypting .env file for editing..."
            if sops -d "$env_file" > "$temp_file" 2>/dev/null; then
                echo "✅ File decrypted successfully"
            else
                echo "❌ Failed to decrypt .env file"
                rm "$temp_file"
                return 1
            fi
        else
            echo "📄 Loading plaintext .env file for editing..."
            cp "$env_file" "$temp_file"
        fi
    else
        # Create new template
        echo "📝 Creating new .env file template..."
        cat > "$temp_file" << 'EOF'
# Environment Variables
# Format: export KEY="value"
# This file will be encrypted after editing

export GITHUB_TOKEN="your_github_token_here"
export DATABASE_URL="your_database_url_here"
export API_KEY="your_api_key_here"
export AWS_ACCESS_KEY_ID="your_aws_access_key"
export AWS_SECRET_ACCESS_KEY="your_aws_secret_key"

EOF
    fi

    # Create backup of original
    [ -f "$env_file" ] && cp "$env_file" "$env_file.backup.$(date +%Y%m%d_%H%M%S)"

    # Get file hash before editing
    local before_hash=$(shasum -a 256 "$temp_file" | cut -d' ' -f1)

    # Open in editor
    echo "🖊️  Opening editor..."
    ${EDITOR:-vim} "$temp_file"

    # Get file hash after editing
    local after_hash=$(shasum -a 256 "$temp_file" | cut -d' ' -f1)

    # Check if file was modified
    if [ "$before_hash" = "$after_hash" ]; then
        echo "📝 No changes made, skipping encryption"
        rm "$temp_file"
        return 0
    fi

    # Encrypt and save to .env
    echo "🔒 Encrypting and saving to .env..."
    if sops --config "$HOME/.sops.yaml" --encrypt --in-place "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$env_file"
        # Verify encryption worked
        if head -1 "$env_file" | grep -q "^#ENC\["; then
            echo "✅ Secrets encrypted and saved to $env_file"
            echo "💡 Restart your terminal or run 'source ~/.zshrc' to load updated secrets"
        else
            echo "❌ Encryption failed - file may be corrupted"
            return 1
        fi
    else
        echo "❌ Failed to encrypt .env file"
        rm "$temp_file"
        return 1
    fi

    echo "🎉 Edit complete! Your encrypted secrets are saved in $env_file"
}

# Edit dotfiles configuration with easy access to all config files
edit_dotfiles() {
    # Try to detect dotfiles directory - prefer dotfiles over .dotfiles
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    fi

    if [ -z "$dotfiles_dir" ]; then
        echo "❌ Dotfiles directory not found"
        echo "   Clone the repository first:"
        echo "   • git clone <repo-url> ~/dotfiles"
        echo "   • OR: git clone <repo-url> ~/.dotfiles"
        return 1
    fi

    echo "📝 Using dotfiles directory: $dotfiles_dir"

    echo "📝 Dotfiles Configuration Editor"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Select what to edit:"
    echo ""
    echo "  1) Shell Configuration (.zshrc)"
    echo "  2) Aliases (.aliases.sh)"
    echo "  3) Functions (.functions.sh)"
    echo "  4) Paths (.paths.sh)"
    echo "  5) Git Config (.gitconfig)"
    echo "  6) Vim Config (.vimrc)"
    echo "  7) Oh My Posh Theme (zen.json)"
    echo "  8) Environment Template (.env.example)"
    echo "  9) Brewfile (package list)"
    echo " 10) Init Script (init.sh)"
    echo " 11) Browse all files"
    echo ""
    echo "  0) Exit"
    echo ""

    local choice
    read -p "Choose file to edit (0-11): " choice

    local file_to_edit=""
    local description=""

    case "$choice" in
        1)
            file_to_edit="$dotfiles_dir/zsh/.zshrc"
            description="Shell Configuration"
            ;;
        2)
            file_to_edit="$dotfiles_dir/zsh/.aliases.sh"
            description="Command Aliases"
            ;;
        3)
            file_to_edit="$dotfiles_dir/zsh/.functions.sh"
            description="Custom Functions"
            ;;
        4)
            file_to_edit="$dotfiles_dir/zsh/.paths.sh"
            description="PATH Configuration"
            ;;
        5)
            file_to_edit="$dotfiles_dir/git/.gitconfig"
            description="Git Configuration"
            ;;
        6)
            file_to_edit="$dotfiles_dir/vim/.vimrc"
            description="Vim Configuration"
            ;;
        7)
            file_to_edit="$dotfiles_dir/config/ohmyposh/zen.json"
            description="Oh My Posh Theme"
            ;;
        8)
            file_to_edit="$dotfiles_dir/zsh/.env.example"
            description="Environment Template"
            ;;
        9)
            file_to_edit="$dotfiles_dir/Brewfile"
            description="Homebrew Package List"
            ;;
        10)
            file_to_edit="$dotfiles_dir/init.sh"
            description="Installation Script"
            ;;
        11)
            echo ""
            echo "📁 Available dotfiles:"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            find "$dotfiles_dir" -type f \( -name ".*" -o -name "*.sh" -o -name "*.json" -o -name "Brewfile" -o -name "README.md" \) ! -path "*/.git/*" | sed "s|$dotfiles_dir/||" | sort
            echo ""
            read -p "Enter file path to edit (relative to $dotfiles_dir): " relative_path
            if [ -n "$relative_path" ]; then
                file_to_edit="$dotfiles_dir/$relative_path"
                description="Custom File: $relative_path"
            else
                echo "❌ No file specified"
                return 1
            fi
            ;;
        0)
            echo "👋 Goodbye!"
            return 0
            ;;
        *)
            echo "❌ Invalid choice: $choice"
            return 1
            ;;
    esac

    # Verify file exists
    if [ ! -f "$file_to_edit" ]; then
        echo "❌ File not found: $file_to_edit"
        return 1
    fi

    # Create backup
    local backup_file="$file_to_edit.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$file_to_edit" "$backup_file"
    echo "💾 Created backup: ${backup_file##*/}"

    # Edit the file
    echo "🖊️  Opening $description for editing..."
    ${EDITOR:-vim} "$file_to_edit"

    # Check if file was modified
    if ! cmp -s "$file_to_edit" "$backup_file"; then
        echo "✅ File modified successfully"

        # Test syntax for shell files
        case "$file_to_edit" in
            *.sh|*/.zshrc)
                echo "🔍 Testing syntax..."
                if bash -n "$file_to_edit" 2>/dev/null; then
                    echo "✅ Syntax check passed"
                else
                    echo "⚠️  Syntax check failed - please review your changes"
                fi
                ;;
            *.json)
                echo "🔍 Testing JSON syntax..."
                if command -v jq >/dev/null 2>&1 && jq empty "$file_to_edit" 2>/dev/null; then
                    echo "✅ JSON syntax check passed"
                elif python3 -m json.tool "$file_to_edit" >/dev/null 2>&1; then
                    echo "✅ JSON syntax check passed"
                else
                    echo "⚠️  JSON syntax check failed - please review your changes"
                fi
                ;;
        esac

        echo ""
        echo "💡 Next steps:"
        case "$file_to_edit" in
            */.zshrc|*/.aliases.sh|*/.functions.sh|*/.paths.sh)
                echo "   • Restart terminal or run: source ~/.zshrc"
                ;;
            */zen.json)
                echo "   • Restart terminal to see prompt changes"
                ;;
            */Brewfile)
                echo "   • Run: brew bundle --file=$dotfiles_dir/Brewfile"
                ;;
            */init.sh)
                echo "   • Test with: bash -n $dotfiles_dir/init.sh"
                ;;
        esac

        # Option to commit changes
        if git -C "$dotfiles_dir" rev-parse --git-dir >/dev/null 2>&1; then
            echo ""
            if confirm "Commit changes to git?"; then
                git -C "$dotfiles_dir" add "$file_to_edit"
                echo "Enter commit message:"
                read -p "> " commit_msg
                if [ -n "$commit_msg" ]; then
                    git -C "$dotfiles_dir" commit -m "$commit_msg

🤖 Generated with edit_dotfiles command

Co-Authored-By: Claude <noreply@anthropic.com>"
                    echo "✅ Changes committed to git"
                else
                    echo "❌ Empty commit message - changes staged but not committed"
                fi
            fi
        fi
    else
        echo "📝 No changes made"
        rm "$backup_file"  # Remove unnecessary backup
    fi

    echo "🎉 Edit complete!"
}

# Update dotfiles repository and apply changes
update_dotfiles() {
    # Try to detect dotfiles directory - prefer dotfiles over .dotfiles
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    fi

    if [ -z "$dotfiles_dir" ]; then
        echo "❌ Dotfiles directory not found"
        echo "   Clone the repository first:"
        echo "   • git clone <repo-url> ~/dotfiles"
        echo "   • OR: git clone <repo-url> ~/.dotfiles"
        return 1
    fi

    echo "🔄 Using dotfiles directory: $dotfiles_dir"

    if ! git -C "$dotfiles_dir" rev-parse --git-dir >/dev/null 2>&1; then
        echo "❌ Dotfiles directory is not a git repository"
        return 1
    fi

    echo "🔄 Updating Dotfiles Repository"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Show current status
    echo "📍 Current status:"
    local current_branch=$(git -C "$dotfiles_dir" branch --show-current 2>/dev/null || echo "unknown")
    local current_commit=$(git -C "$dotfiles_dir" rev-parse --short HEAD 2>/dev/null || echo "unknown")
    echo "   Branch: $current_branch"
    echo "   Commit: $current_commit"
    echo ""

    # Check for uncommitted changes
    if ! git -C "$dotfiles_dir" diff-index --quiet HEAD --; then
        echo "⚠️  You have uncommitted changes:"
        git -C "$dotfiles_dir" status --porcelain
        echo ""

        if confirm "Stash uncommitted changes before updating?"; then
            git -C "$dotfiles_dir" stash push -m "Auto-stash before dotfiles update $(date)"
            echo "✅ Changes stashed"
        else
            echo "❌ Update cancelled - commit or stash your changes first"
            return 1
        fi
    fi

    # Fetch latest changes
    echo "🌐 Fetching latest changes..."
    if git -C "$dotfiles_dir" fetch origin; then
        echo "✅ Fetch completed"
    else
        echo "❌ Failed to fetch from remote"
        return 1
    fi

    # Check if updates are available
    local commits_behind=$(git -C "$dotfiles_dir" rev-list HEAD..origin/"$current_branch" --count 2>/dev/null || echo "0")

    if [ "$commits_behind" = "0" ]; then
        echo "✅ Already up to date!"
        return 0
    fi

    # Show what will be updated
    echo ""
    echo "📋 Updates available ($commits_behind commits behind):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    git -C "$dotfiles_dir" log HEAD..origin/"$current_branch" --oneline --decorate

    echo ""
    if ! confirm "Apply these updates?"; then
        echo "❌ Update cancelled"
        return 0
    fi

    # Create backup of current state
    local backup_branch="backup-$(date +%Y%m%d_%H%M%S)"
    git -C "$dotfiles_dir" branch "$backup_branch"
    echo "💾 Created backup branch: $backup_branch"

    # Pull updates
    echo ""
    echo "⬇️  Pulling updates..."
    if git -C "$dotfiles_dir" pull origin "$current_branch"; then
        echo "✅ Updates applied successfully"
    else
        echo "❌ Update failed - you may need to resolve conflicts"
        echo "💡 Your backup is available at branch: $backup_branch"
        return 1
    fi

    # Show what changed
    echo ""
    echo "📝 Changes applied:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    git -C "$dotfiles_dir" log "$current_commit"..HEAD --oneline --decorate

    # Check if critical files changed
    local changed_files=$(git -C "$dotfiles_dir" diff --name-only "$current_commit"..HEAD)
    local needs_reload=false
    local needs_reinstall=false

    echo ""
    echo "🔍 Analyzing changes..."

    echo "$changed_files" | while read -r file; do
        case "$file" in
            zsh/.zshrc|zsh/.aliases.sh|zsh/.functions.sh|zsh/.paths.sh)
                needs_reload=true
                ;;
            Brewfile|init.sh)
                needs_reinstall=true
                ;;
            config/ohmyposh/*)
                needs_reload=true
                ;;
        esac
    done

    # Provide next steps
    echo ""
    echo "💡 Next steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if echo "$changed_files" | grep -q -E "\.(zshrc|aliases\.sh|functions\.sh|paths\.sh)$"; then
        echo "   🔄 Shell configuration updated"
        if confirm "Reload shell configuration now?"; then
            echo "🔄 Reloading shell configuration..."
            source "$HOME/.zshrc"
            echo "✅ Shell configuration reloaded"
        else
            echo "   💡 Run: source ~/.zshrc (or restart terminal)"
        fi
    fi

    if echo "$changed_files" | grep -q "Brewfile"; then
        echo "   📦 Package list updated"
        if confirm "Update installed packages with brew bundle?"; then
            echo "📦 Updating packages..."
            brew bundle --file="$dotfiles_dir/Brewfile"
            echo "✅ Packages updated"
        else
            echo "   💡 Run: brew bundle --file=$dotfiles_dir/Brewfile"
        fi
    fi

    if echo "$changed_files" | grep -q "config/ohmyposh"; then
        echo "   🎨 Prompt theme updated"
        echo "   💡 Restart terminal to see prompt changes"
    fi

    if echo "$changed_files" | grep -q "init.sh"; then
        echo "   🛠️ Installation script updated"
        echo "   💡 Re-run ./init.sh if you need new features"
    fi

    # Cleanup old backup branches (keep last 5)
    echo ""
    echo "🧹 Cleaning up old backups..."
    git -C "$dotfiles_dir" for-each-ref --format='%(refname:short)' refs/heads/backup-* | sort -r | tail -n +6 | while read -r branch; do
        git -C "$dotfiles_dir" branch -D "$branch"
        echo "   🗑️ Removed old backup: $branch"
    done

    echo ""
    echo "🎉 Dotfiles update complete!"
    echo "   📂 Repository: $dotfiles_dir"
    echo "   🏷️  Current: $(git -C "$dotfiles_dir" rev-parse --short HEAD)"
    echo "   💾 Backup: $backup_branch"
}

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

    if command -v atuin &> /dev/null; then
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
            echo "  rg 'pattern' --type bal   # Search only Ballerina files"
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

        # Atuin Shell History
        "atuin"|"hs"|"hstats"|"hsync")
            echo "📚 Atuin Aliases - Enhanced Shell History"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Interactive History:"
            echo "  hs          atuin search (interactive fuzzy search)"
            echo "  Ctrl+Alt+R  atuin search (keybinding for quick access)"
            echo "  Ctrl+R      uses your terminal's native history (e.g., Warp's)"
            echo ""
            echo "Statistics & Sync:"
            echo "  hstats  atuin stats (show command statistics)"
            echo "  hsync   atuin sync (sync to server if configured)"
            echo "  hup     atuin up (navigate history up)"
            echo "  hdown   atuin down (navigate history down)"
            echo ""
            echo "💡 Features:"
            echo "  • Fuzzy search through entire command history"
            echo "  • Statistics on command usage and patterns"
            echo "  • Optional sync across multiple machines"
            echo "  • Context-aware suggestions"
            echo "  • Works alongside terminal's native history"
            echo ""
            echo "💡 Pro tip: Use Ctrl+Alt+R for quick Atuin search, Ctrl+R for Warp history!"
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
