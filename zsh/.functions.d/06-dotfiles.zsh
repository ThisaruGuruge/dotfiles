#!/bin/zsh
# ============================================================================
# Dotfiles Management Functions
# ============================================================================
# Dotfiles utilities: edit_secrets(), edit_dotfiles(), update_dotfiles(), adopt-config()

# Edit secrets in .env file (handles both encrypted and plaintext)
edit_secrets() {
    local env_file="$HOME/.env"
    local temp_file
    temp_file="$(mktemp -t temp_env).env"

    # Set SOPS environment variable
    export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"

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
        if head -1 "$env_file" | grep -q "^#ENC\\["; then
            echo "🔓 Decrypting .env file for editing..."
            if sops -d "$env_file" >"$temp_file"; then
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
        cat >"$temp_file" <<'EOF'
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
    local before_hash
    before_hash=$(shasum -a 256 "$temp_file" | cut -d' ' -f1)

    # Open in editor
    echo "🖊️  Opening editor..."
    ${EDITOR:-vim} "$temp_file"

    # Get file hash after editing
    local after_hash
    after_hash=$(shasum -a 256 "$temp_file" | cut -d' ' -f1)

    # Check if file was modified
    if [ "$before_hash" = "$after_hash" ]; then
        echo "📝 No changes made, skipping encryption"
        rm "$temp_file"
        return 0
    fi

    # Encrypt and save to .env
    echo "🔒 Encrypting and saving to .env..."
    if sops --config "$HOME/.sops.yaml" --encrypt --in-place "$temp_file"; then
        mv "$temp_file" "$env_file"
        # Verify encryption worked
        if head -1 "$env_file" | grep -q "^#ENC\\["; then
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
    echo "  3) Functions (.functions.d/)"
    echo "  4) Paths (.paths.sh)"
    echo "  5) Git Config (.gitconfig)"
    echo "  6) Vim Config (.vimrc)"
    echo "  7) Powerlevel10k Prompt (.p10k.zsh)"
    echo "  8) Environment Template (.env.example)"
    echo "  9) Brewfile (package list)"
    echo " 10) Init Script (init.sh)"
    echo " 11) Browse all files"
    echo ""
    echo "  0) Exit"
    echo ""

    local choice
    read -r -p "Choose file to edit (0-11): " choice

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
            file_to_edit="$dotfiles_dir/zsh/.functions.d/"
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
            file_to_edit="$dotfiles_dir/zsh/.p10k.zsh"
            description="Powerlevel10k Prompt"
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
            read -r -p "Enter file path to edit (relative to $dotfiles_dir): " relative_path
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

    # Verify file/directory exists
    if [ ! -e "$file_to_edit" ]; then
        echo "❌ Not found: $file_to_edit"
        return 1
    fi

    # Create backup
    local backup_file
    backup_file="$file_to_edit.backup.$(date +%Y%m%d_%H%M%S)"
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
            *.zsh | */.zshrc)
                echo "🔍 Testing syntax..."
                if zsh -n "$file_to_edit" 2>/dev/null; then
                    echo "✅ Syntax check passed"
                else
                    echo "⚠️  Syntax check failed - please review your changes"
                fi
                ;;
            *.sh)
                echo "🔍 Testing syntax..."
                if zsh -n "$file_to_edit" 2>/dev/null; then
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
            */.zshrc | */.aliases.sh | */.functions.d/* | */.paths.sh)
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
                read -r -p "> " commit_msg
                if [ -n "$commit_msg" ]; then
                    git -C "$dotfiles_dir" commit -m "$commit_msg"
                    echo "✅ Changes committed to git"
                else
                    echo "❌ Empty commit message - changes staged but not committed"
                fi
            fi
        fi
    else
        echo "📝 No changes made"
        rm "$backup_file" # Remove unnecessary backup
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
    local current_branch
    local current_commit
    current_branch=$(git -C "$dotfiles_dir" branch --show-current 2>/dev/null || echo "unknown")
    current_commit=$(git -C "$dotfiles_dir" rev-parse --short HEAD 2>/dev/null || echo "unknown")
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
    local commits_behind
    commits_behind=$(git -C "$dotfiles_dir" rev-list HEAD..origin/"$current_branch" --count 2>/dev/null || echo "0")

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
    local backup_branch
    backup_branch="backup-$(date +%Y%m%d_%H%M%S)"
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
    local changed_files
    changed_files=$(git -C "$dotfiles_dir" diff --name-only "$current_commit"..HEAD)
    echo ""
    echo "🔍 Analyzing changes..."

    # Provide next steps
    echo ""
    echo "💡 Next steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if echo "$changed_files" | grep -q -E "\.(zshrc|aliases\.sh|paths\.sh)$|functions\.d/"; then
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

    if echo "$changed_files" | grep -q "\.p10k\.zsh"; then
        echo "   🎨 Prompt config updated"
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

# Adopt a config file or directory into dotfiles
adopt-config() {
    local target="$1"
    local config_name
    local dotfiles_config_dir="$HOME/dotfiles/config/.config"

    if [ -z "$target" ]; then
        echo "Usage: adopt-config <path-to-config>"
        return 1
    fi

    if [ ! -e "$target" ]; then
        echo "Error: $target does not exist"
        return 1
    fi

    # Normalize path
    target=$(realpath "$target")
    config_name=$(basename "$target")

    # Ensure .config dir exists in dotfiles
    mkdir -p "$dotfiles_config_dir"

    echo "📦 Adopting $config_name into dotfiles..."

    # Move to dotfiles
    mv -v "$target" "$dotfiles_config_dir/"

    # Stow it back
    echo "🔗 Stowing config..."
    if (cd "$HOME/dotfiles" && stow --no-folding config); then
        echo "✅ $config_name adopted and stowed!"
    else
        echo "❌ Stow failed — restoring original file..."
        mv -v "$dotfiles_config_dir/$config_name" "$target"
        return 1
    fi
}
