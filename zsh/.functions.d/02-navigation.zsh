#!/bin/zsh
# ============================================================================
# Navigation Functions
# ============================================================================
# Smart directory/project navigation: take(), takedir(), takegit(), takeurl(), envrc()

# Yazi shell wrapper — cd to the directory yazi was in when you quit (q)
function y() {
    local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
    command yazi "$@" --cwd-file="$tmp"
    if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
        builtin cd -- "$cwd"
    fi
    rm -f -- "$tmp"
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

    local target_dir="${*: -1}" # Last argument - directory to cd into after creation

    echo "Creating directory: $*"
    if mkdir -p "$@"; then
        cd "$target_dir" || return
        echo "Created and entered $(pwd)"
    else
        echo "Failed to create directory: $*"
        return 1
    fi
}

function takegit() {
    local repo_url="$1"
    local category="$2"
    local repo_name
    local target_dir
    local projects_dir="${PROJECTS_DIR:-$HOME/Projects}"

    # Validate input
    if [ -z "$repo_url" ]; then
        echo "Error: Repository URL is required"
        echo "Usage: take <git-url> [category]"
        echo "  e.g., take https://github.com/user/repo Ballerina"
        return 1
    fi

    # Check if git is available
    if ! command -v git >/dev/null 2>&1; then
        echo "Error: git is not installed or not in PATH"
        return 1
    fi

    # Extract repository name from URL (consistent approach)
    repo_name="$(basename "$repo_url" .git)"

    # Handle edge cases
    if [[ "$repo_name" == "." ]] || [[ -z "$repo_name" ]]; then
        repo_name="repository"
    fi

    # Determine target directory
    if [ -n "$category" ]; then
        target_dir="$projects_dir/$category"
        mkdir -p "$target_dir"
        target_dir="$target_dir/$repo_name"
    else
        target_dir="$repo_name"
    fi

    # Check if directory already exists
    if [ -d "$target_dir" ]; then
        echo "Project already exists: $target_dir"
        echo "Entering existing project..."
        cd "$target_dir" || return
        return 0
    fi

    echo "Cloning $repo_url into $target_dir..."
    if git clone "$repo_url" "$target_dir"; then
        cd "$target_dir" || return
        echo "Successfully cloned and entered $repo_name"
    else
        echo "Failed to clone repository: $repo_url"
        echo "Possible causes:"
        echo "  • Repository doesn't exist or is private"
        echo "  • Network connectivity issues"
        echo "  • Invalid URL format"
        echo "  • Insufficient permissions"
        return 1
    fi
}

function takeurl() {
    local url="$1"
    local temp_file temp_dir extracted_dir

    # Validate input
    if [ -z "$url" ]; then
        echo "Error: URL is required"
        return 1
    fi

    # Check if curl is available
    if ! command -v curl >/dev/null 2>&1; then
        echo "Error: curl is not installed or not in PATH"
        return 1
    fi

    # Check if tar is available
    if ! command -v tar >/dev/null 2>&1; then
        echo "Error: tar is not installed or not in PATH"
        return 1
    fi

    temp_file="$(mktemp)"
    temp_dir="$(mktemp -d)"

    echo "Downloading $url..."
    if ! curl -L "$url" -o "$temp_file" 2>/dev/null; then
        echo "Failed to download $url"
        echo "Possible causes:"
        echo "  • URL is invalid or file doesn't exist"
        echo "  • Network connectivity issues"
        echo "  • Server is unreachable"
        rm -f "$temp_file"
        rmdir "$temp_dir" 2>/dev/null
        return 1
    fi

    # Verify file was downloaded and has content
    if [ ! -s "$temp_file" ]; then
        echo "Error: Downloaded file is empty"
        rm -f "$temp_file"
        rmdir "$temp_dir" 2>/dev/null
        return 1
    fi

    echo "Extracting archive..."
    cd "$temp_dir" || return

    # Determine extraction method based on file type
    case "$url" in
        *.tar.gz | *.tgz)
            if ! tar -xzf "$temp_file" 2>/dev/null; then
                echo "Error: Failed to extract tar.gz archive"
                cd - >/dev/null || return
                rm -f "$temp_file"
                rmdir "$temp_dir" 2>/dev/null
                return 1
            fi
            ;;
        *.tar.bz2 | *.tbz2)
            if ! tar -xjf "$temp_file" 2>/dev/null; then
                echo "Error: Failed to extract tar.bz2 archive"
                cd - >/dev/null || return
                rm -f "$temp_file"
                rmdir "$temp_dir" 2>/dev/null
                return 1
            fi
            ;;
        *.tar.xz)
            if ! tar -xJf "$temp_file" 2>/dev/null; then
                echo "Error: Failed to extract tar.xz archive"
                cd - >/dev/null || return
                rm -f "$temp_file"
                rmdir "$temp_dir" 2>/dev/null
                return 1
            fi
            ;;
        *.tar)
            if ! tar -xf "$temp_file" 2>/dev/null; then
                echo "Error: Failed to extract tar archive"
                cd - >/dev/null || return
                rm -f "$temp_file"
                rmdir "$temp_dir" 2>/dev/null
                return 1
            fi
            ;;
        *)
            echo "Error: Unsupported archive format"
            echo "Supported formats: .tar.gz, .tgz, .tar.bz2, .tbz2, .tar.xz, .tar"
            cd - >/dev/null || return
            rm -f "$temp_file"
            rmdir "$temp_dir" 2>/dev/null
            return 1
            ;;
    esac

    # Find the extracted directory
    extracted_dir="$(find . -maxdepth 1 -type d ! -name '.' | head -n 1)"

    if [ -n "$extracted_dir" ]; then
        cd "$extracted_dir" || return
        echo "Extracted and entered $(basename "$extracted_dir")"
    else
        echo "Warning: No directory found in archive, staying in temp directory"
        echo "Current location: $(pwd)"
    fi

    rm -f "$temp_file"
}

# ----------------------------------------------------------------------------
# envrc: pin the Claude Code + Google Workspace accounts to a directory
# ----------------------------------------------------------------------------
# envrc work|personal   write ./.envrc pinning the account (work = enterprise)
# envrc status          show which pin applies here and where it comes from
# envrc off             remove the pin from this directory
#
# The pin exports CLAUDE_CONFIG_DIR and GOOGLE_WORKSPACE_CLI_CONFIG_DIR via
# direnv, so plain `claude` and `gws` pick the right account inside the tree.
# The explicit commands (ccp/cce/ccpr/ccer/ccpc/ccec and gwsp/gwse) set the
# variables inline for their own process and therefore always win over the pin.
_ENVRC_MARK="# Managed by envrc:"

_envrc_account() {
    case "$1" in
        work) echo enterprise ;;
        personal) echo personal ;;
    esac
}

# Print the account named in a file written by envrc, or nothing if unmanaged.
_envrc_file_account() {
    [[ -f "$1" ]] || return 1
    local line
    line=$(grep -m1 "^${_ENVRC_MARK}" "$1") || return 1
    echo "${line#"${_ENVRC_MARK}" }"
}

envrc() {
    local cmd="${1:-}"
    local file="$PWD/.envrc"

    case "$cmd" in
        work | personal)
            local account
            account=$(_envrc_account "$cmd")
            local content
            content="${_ENVRC_MARK} ${account}
# Pins the Claude Code and Google Workspace accounts for this directory.
# ccp/cce/gwsp/gwse override this pin for the single command they run.
# Remove with: envrc off
source_up_if_exists
export CLAUDE_CONFIG_DIR=\"\$HOME/.claude-${account}\"
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR=\"\$HOME/.config/gws-${account}\"
export GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file"

            if [[ -f "$file" ]]; then
                local existing
                existing=$(_envrc_file_account "$file")
                if [[ -n "$existing" && "$(<"$file")" == "$content" ]]; then
                    echo "Already pinned to $cmd ($account) in $file"
                    return 0
                fi
                if [[ -n "$existing" ]]; then
                    echo "$file is pinned to '$existing'; switching to '$account'."
                else
                    echo "$file exists and was not written by envrc ($(wc -l <"$file" | tr -d ' ') lines)."
                    echo "It will be replaced."
                fi
                if ! read -u 0 -q "?Overwrite? [y/N] "; then
                    echo
                    echo "Left $file unchanged."
                    return 1
                fi
                echo
            fi

            printf '%s\n' "$content" >"$file" || return 1
            echo "Wrote $file (pinned to $cmd: Claude ~/.claude-${account}, gws ~/.config/gws-${account})"

            if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && ! git check-ignore -q "$file"; then
                git_ignore_local .envrc
            fi

            if command -v direnv >/dev/null 2>&1; then
                direnv allow "$PWD"
            else
                echo "direnv is not installed; the pin takes effect once it is (brew install direnv)."
            fi
            echo "ccp/cce/gwsp/gwse still override this pin when you type them explicitly."
            ;;

        status)
            local dir="$PWD" found="" unmanaged=""
            while :; do
                if [[ -f "$dir/.envrc" ]]; then
                    if _envrc_file_account "$dir/.envrc" >/dev/null; then
                        found="$dir/.envrc"
                        break
                    fi
                    [[ -z "$unmanaged" ]] && unmanaged="$dir/.envrc"
                fi
                [[ "$dir" == "/" ]] && break
                dir="${dir:h}"
            done

            if [[ -n "$found" ]]; then
                local pinned
                pinned=$(_envrc_file_account "$found")
                echo "Pinned to ${pinned} by $found"
                [[ "$found" != "$file" ]] && echo "  (inherited from a parent directory)"
            else
                echo "No envrc pin applies here; plain \`claude\` uses ~/.claude (→ ~/.claude-personal)."
            fi
            [[ -n "$unmanaged" ]] && echo "  Note: $unmanaged exists but was not written by envrc."
            echo "  CLAUDE_CONFIG_DIR=${CLAUDE_CONFIG_DIR:-<unset>}"
            echo "  GOOGLE_WORKSPACE_CLI_CONFIG_DIR=${GOOGLE_WORKSPACE_CLI_CONFIG_DIR:-<unset>}"
            echo "  ccp/cce/gwsp/gwse override the pin for the command they run."
            ;;

        off)
            if [[ ! -f "$file" ]]; then
                echo "No .envrc in $PWD; nothing to remove."
                return 0
            fi
            if ! _envrc_file_account "$file" >/dev/null; then
                echo "$file was not written by envrc; leaving it alone."
                return 1
            fi
            if ! read -u 0 -q "?Remove $file? [y/N] "; then
                echo
                echo "Left $file unchanged."
                return 1
            fi
            echo
            rm -f -- "$file" && echo "Removed $file. The pin is gone once direnv reloads (next prompt)."
            ;;

        *)
            echo "Usage: envrc work|personal|status|off"
            echo "  work       pin this directory to the enterprise accounts"
            echo "  personal   pin this directory to the personal accounts"
            echo "  status     show the pin that applies here"
            echo "  off        remove the pin written by envrc from this directory"
            [[ -n "$cmd" && "$cmd" != "-h" && "$cmd" != "--help" ]] && return 1
            return 0
            ;;
    esac
}
