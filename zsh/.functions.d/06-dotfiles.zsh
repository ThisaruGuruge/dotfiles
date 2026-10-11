#!/bin/zsh
# ============================================================================
# Dotfiles Management Functions
# ============================================================================
# Dotfiles utilities: edit_secrets(), edit_dotfiles(), update_dotfiles(), adopt-config()
# Secrets helpers: _dotfiles_is_sops_encrypted(), _dotfiles_env_parse() and
# _dotfiles_load_env(). The IDE fast path in .zshrc sources this file on its
# own (no aliases loaded), and in normal shells aliases are already defined
# when it's sourced — so every external command here goes through `command`.

# ----------------------------------------------------------------------------
# Secrets (~/.env) helpers
# ----------------------------------------------------------------------------

# True when $1 is a sops-encrypted dotenv file. sops encrypts each value on its
# own (KEY=ENC[...]) and always writes a sops_mac= line, so the first line of
# an encrypted file can be anything — don't test for a leading #ENC[.
_dotfiles_is_sops_encrypted() {
    [[ -f $1 ]] && command grep -q -e '^sops_mac=' -- "$1" 2>/dev/null
}

# Export variables from dotenv text on stdin without sourcing or eval'ing it.
# Accepted lines are `[export ]NAME=VALUE` (blank lines and # comments are
# skipped) where VALUE is one of:
#   'single quoted'   taken literally (anything except a single quote)
#   "double quoted"   shell rules for \\ \" \$ \` and $NAME / ${NAME};
#                     nothing else expands, and bare backticks, $(...) and
#                     other ${...} forms are refused
#   unquoted          no whitespace, quotes or shell metacharacters
# optionally followed by a # comment. Names zsh treats specially (PATH, IFS,
# PS1, HOME, ...), prompts, hook arrays and loader variables are refused too.
# Refused entries are reported by name only, never by value.
_dotfiles_env_parse() {
    emulate -L zsh
    setopt extendedglob
    zmodload zsh/parameter 2>/dev/null
    local line name value rest unescaped
    local -i malformed=0
    local -a refused
    local re_assign='^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
    local re_single="^'([^']*)'[[:space:]]*(#.*)?\$"
    local re_double='^"((\\.|[^"\\`])*)"[[:space:]]*(#.*)?$'
    local re_token='(\\(.)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*))'
    local re_plain='^([^[:space:]'"'"'"\\`$;&|<>(){}]*)[[:space:]]*(#.*)?$'

    while IFS= read -r line || [[ -n $line ]]; do
        [[ $line == [[:space:]]#(\#*|) ]] && continue
        if [[ ! $line =~ $re_assign ]]; then
            (( malformed++ ))
            continue
        fi
        name=$match[2]
        value=$match[3]

        if [[ $name == (PS[1-4]|PROMPT[2-4]#|RPROMPT[2]#|RPS[12]|ZDOTDIR|ENV|BASH_ENV|LD_*|DYLD_*|*_functions) ]] ||
            [[ -n ${parameters[$name]} && ${parameters[$name]} != scalar(|-export) ]]; then
            refused+=($name)
            continue
        fi

        if [[ $value =~ $re_single ]]; then
            value=$match[1]
        elif [[ $value =~ $re_double ]]; then
            rest=$match[1]
            # Escaped characters are literal, so check what's left without them
            unescaped=${rest//\\?/}
            if [[ $unescaped == *'$('* || ${unescaped//\$\{[A-Za-z_][A-Za-z0-9_]#\}/} == *'${'* ]]; then
                refused+=($name)
                continue
            fi
            # Single left-to-right pass with shell double-quote rules: \\ \" \$
            # \` drop the backslash, any other \x stays as is, and $NAME /
            # ${NAME} become their value (which is never scanned again)
            value=""
            while [[ $rest =~ $re_token ]]; do
                value+=${rest[1,MBEGIN-1]}
                if [[ -n $match[2] ]]; then
                    if [[ $match[2] == [\\\"\$\`] ]]; then
                        value+=$match[2]
                    else
                        value+="\\$match[2]"
                    fi
                else
                    value+=${(P)${match[3]:-$match[4]}}
                fi
                rest=${rest[MEND+1,-1]}
            done
            value+=$rest
        elif [[ $value =~ $re_plain ]]; then
            value=$match[1]
        else
            refused+=($name)
            continue
        fi
        typeset -gx "$name=$value"
    done

    (( malformed )) && print -u2 "dotfiles: ignored $malformed malformed line(s) in ~/.env"
    (( $#refused )) && print -u2 "dotfiles: refused ~/.env entries (unsupported value or reserved name): ${(j:, :)refused}"
    return 0
}

# Load ~/.env into the environment. A sops-encrypted file is decrypted once and
# the plaintext cached in ~/.cache/zsh/env_cache (file 0600, directory 0700)
# until ~/.env changes; a plaintext ~/.env is read directly. Cache hits and
# misses both go through _dotfiles_env_parse, so neither file is ever executed.
_dotfiles_load_env() {
    emulate -L zsh
    local env_file="$HOME/.env"
    local cache_dir="$HOME/.cache/zsh"
    local cache_file="$cache_dir/env_cache"
    local decrypted
    [[ -f $env_file ]] || return 0

    # Cache hit: a regular file (not a symlink) we own, newer than ~/.env
    if [[ -f $cache_file && ! -L $cache_file && -O $cache_file && $cache_file -nt $env_file ]]; then
        _dotfiles_env_parse <"$cache_file"
        return 0
    fi

    if ! _dotfiles_is_sops_encrypted "$env_file"; then
        # Plaintext ~/.env: read it as-is, and drop a cache left over from an
        # older encrypted version
        [[ -e $cache_file || -L $cache_file ]] && command rm -f -- "$cache_file"
        _dotfiles_env_parse <"$env_file"
        return 0
    fi

    if (( ! $+commands[sops] )); then
        print -u2 "Warning: SOPS not available - cannot decrypt $env_file"
        return 1
    fi
    if ! decrypted=$(SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}" command sops -d "$env_file" 2>/dev/null); then
        print -u2 "Warning: Failed to decrypt $env_file - check your SOPS/age configuration"
        return 1
    fi

    # Write the cache under a private umask (no readable window) and rename it
    # into place, so a half-written cache is never picked up
    (
        umask 077
        tmp=""
        command mkdir -p -- "$cache_dir" && command chmod 700 "$cache_dir" &&
            tmp=$(command mktemp "$cache_dir/env_cache.XXXXXX") &&
            print -r -- "$decrypted" >|"$tmp" &&
            command mv -f -- "$tmp" "$cache_file" ||
            { [[ -n $tmp ]] && command rm -f -- "$tmp"; }
    )

    # zsh runs the last pipeline stage in this shell, so the exports stick
    print -r -- "$decrypted" | _dotfiles_env_parse
}

# Edit ~/.env with sops encryption. The plaintext only exists inside a private
# (0700) temp directory that is removed when the function exits or is
# interrupted; vim/nvim run without swap, undo, backup or shada copies; and the
# new ciphertext has to decrypt back to what you saved before it replaces
# ~/.env. The previous encrypted file is kept as ~/.env.backup.<timestamp>
# (newest 3 kept).
edit_secrets() {
    emulate -L zsh
    setopt localtraps extendedglob
    local env_file="$HOME/.env"
    local sops_config="$HOME/.sops.yaml"
    local key_file="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
    local old_umask tmp_dir plain_file enc_file before_hash after_hash
    local -a editor backups

    # Check if SOPS is available
    if (( ! $+commands[sops] )); then
        echo "❌ SOPS is not installed. Install it with: brew install sops"
        return 1
    fi

    # Check if age key exists
    if [[ ! -f $key_file ]]; then
        echo "❌ Age encryption key not found at $key_file. Run ./init.sh to set up secret management first."
        return 1
    fi

    # The sops config names the age recipient; it's per machine (not tracked)
    if [[ ! -f $sops_config ]]; then
        echo "❌ $sops_config is missing (or a dangling symlink). Run ./init.sh to write this machine's sops config."
        return 1
    fi
    export SOPS_AGE_KEY_FILE="$key_file"

    old_umask=$(umask)
    umask 077
    if ! tmp_dir=$(command mktemp -d "${TMPDIR:-/tmp}/edit_secrets.XXXXXX"); then
        umask "$old_umask"
        echo "❌ Could not create a private temp directory"
        return 1
    fi
    # A function's EXIT trap runs after its locals are gone, so bake the
    # values into the trap text
    trap "umask ${(q)old_umask}; command rm -rf -- ${(q)tmp_dir}" EXIT
    trap 'return 130' INT TERM HUP

    # Names must end in .env: the sops creation_rule matches \.env$, and the
    # extension tells sops to use the dotenv format
    plain_file="$tmp_dir/secrets.env"
    enc_file="$tmp_dir/secrets.enc.env"

    # Handle existing .env file
    if [[ -f $env_file ]]; then
        if _dotfiles_is_sops_encrypted "$env_file"; then
            echo "🔓 Decrypting .env file for editing..."
            if ! command sops -d "$env_file" >"$plain_file"; then
                echo "❌ Failed to decrypt $env_file (is it encrypted to this machine's age key?)"
                return 1
            fi
            echo "✅ File decrypted successfully"
        else
            echo "📄 Loading plaintext .env file for editing (it will be encrypted on save)..."
            command cp -- "$env_file" "$plain_file" || return 1
        fi
    else
        # Create new template
        echo "📝 Creating new .env file template..."
        command cat >"$plain_file" <<'EOF'
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

    before_hash=$(command shasum -a 256 <"$plain_file")

    # vim/nvim: no swap file, no undo file, no backup and no shada/viminfo
    # (registers) copies of the plaintext. --cmd applies before the user's
    # config and -c after it, since the config may turn undofile back on.
    editor=(${(z)${EDITOR:-vim}})
    editor=("${(Q)editor[@]}")
    if [[ ${editor[1]:t} == (nvim|vim|vi) ]]; then
        local safe_opts='set noundofile noswapfile nobackup nowritebackup'
        editor+=(-n -i NONE --cmd "$safe_opts" -c "$safe_opts")
    fi
    echo "🖊️  Opening editor..."
    "${editor[@]}" "$plain_file"

    after_hash=$(command shasum -a 256 <"$plain_file")
    if [[ $before_hash == "$after_hash" ]]; then
        echo "📝 No changes made, skipping encryption"
        return 0
    fi

    echo "🔒 Encrypting..."
    if ! command sops --config "$sops_config" --encrypt "$plain_file" >"$enc_file"; then
        echo "❌ Failed to encrypt (does $sops_config list this machine's age key?). $env_file was not changed."
        return 1
    fi

    # Round trip: the result must be sops-encrypted and decrypt with this
    # machine's key back to what was saved (sops drops blank lines, so compare
    # without them)
    if ! _dotfiles_is_sops_encrypted "$enc_file" ||
        ! command sops -d "$enc_file" 2>/dev/null | command awk 'NF' | command cmp -s - <(command awk 'NF' "$plain_file"); then
        echo "❌ The encrypted file didn't decrypt back to your edits. $env_file was not changed."
        return 1
    fi

    # Keep the previous version. Only ciphertext is ever backed up — a
    # plaintext ~/.env being encrypted for the first time is not copied.
    if _dotfiles_is_sops_encrypted "$env_file"; then
        if ! command cp -- "$env_file" "$env_file.backup.$(command date +%Y%m%d_%H%M%S)"; then
            echo "❌ Could not back up $env_file, so it was not replaced"
            return 1
        fi
    fi

    if ! command mv -f -- "$enc_file" "$env_file"; then
        echo "❌ Could not replace $env_file; it was not changed"
        return 1
    fi

    # Keep the newest 3 backups (names sort by timestamp)
    backups=("$env_file".backup.[0-9]##_[0-9]##(N.On))
    (( $#backups > 3 )) && command rm -f -- "${(@)backups[4,-1]}"

    # Force the next shell to decrypt the new file instead of using the cache
    command rm -f -- "$HOME/.cache/zsh/env_cache"

    echo "✅ Secrets encrypted and saved to $env_file"
    echo "💡 Restart your terminal or run 'source ~/.zshrc' to load updated secrets"
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

    if command -v dotdoctor >/dev/null 2>&1; then
        echo "   🩺 Run dotdoctor to check for files that still need linking (bestow stow <pkg>)"
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
