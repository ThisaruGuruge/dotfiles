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
# The pin exports CLAUDE_CONFIG_DIR, GOOGLE_WORKSPACE_CLI_CONFIG_DIR and the
# gws file keyring backend via direnv, so plain `claude` and `gws` pick the
# right account inside the tree.
#
# What overrides what:
#   ccp/cce/ccpr/ccer/ccpc/ccec  set CLAUDE_CONFIG_DIR inline and blank
#                                GOOGLE_WORKSPACE_CLI_CONFIG_DIR for the claude
#                                they start, so a pin never leaks the other
#                                account's gws into it (bare gws stays blocked)
#   gwsp/gwse                    set the gws account inline
# Inside a pinned tree a bare `gws` is accepted by the bin/gws guard, because
# the pin supplies the account context; outside one it stays blocked.
_ENVRC_MARK="# Managed by envrc:"

_envrc_account() {
    case "$1" in
        work) echo enterprise ;;
        personal) echo personal ;;
    esac
}

# The exact .envrc written for an account (enterprise|personal).
_envrc_content() {
    local account="$1"
    printf '%s\n' \
        "${_ENVRC_MARK} ${account}" \
        "# Pins the Claude Code and Google Workspace accounts for this directory." \
        "# ccp/cce (and the resume/continue variants) override CLAUDE_CONFIG_DIR and blank" \
        "# the gws pin for the claude they start; gwsp/gwse override the gws account." \
        "# Inside this tree a bare \`gws\` uses the pinned account instead of being blocked." \
        "# Remove with: envrc off" \
        "source_up_if_exists" \
        "export CLAUDE_CONFIG_DIR=\"\$HOME/.claude-${account}\"" \
        "export GOOGLE_WORKSPACE_CLI_CONFIG_DIR=\"\$HOME/.config/gws-${account}\"" \
        "export GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file"
}

# Print the account named in a file written by envrc, or nothing if unmanaged.
_envrc_file_account() {
    [[ -f "$1" ]] || return 1
    local line
    line=$(grep -m1 "^${_ENVRC_MARK}" "$1") || return 1
    echo "${line#"${_ENVRC_MARK}" }"
}

# True when the file is byte-for-byte what envrc would write for either account.
_envrc_is_pristine() {
    local body
    body=$(<"$1")
    [[ "$body" == "$(_envrc_content enterprise)" || "$body" == "$(_envrc_content personal)" ]]
}

# Copy a .envrc we are about to replace or delete to .envrc.bak (never overwriting
# an earlier backup) and keep the backup out of git status. Prints the path.
_envrc_backup() {
    local file="$1" bak="$1.bak"
    [[ -e "$bak" ]] && bak="$1.bak.$(date +%Y%m%d%H%M%S)"
    command cp -p -- "$file" "$bak" || return 1
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git_ignore_local "/$(git rev-parse --show-prefix).envrc.bak*" >/dev/null
    fi
    echo "$bak"
}

# Make direnv notice a change to ./.envrc right away instead of at the next cd:
# load the lazily-loaded hook if it is not active yet, otherwise run the hook.
_envrc_reload() {
    if (( $+functions[_direnv_hook] )); then
        _direnv_hook
    elif (( $+functions[_direnv_check] )); then
        _direnv_check
    fi
}

# Refuse anything that is not a plain file at $1 (symlinks would be written through).
_envrc_refuse_odd() {
    if [[ -L "$1" ]]; then
        echo "$1 is a symlink (-> $(readlink "$1")); refusing to write through it."
        echo "Replace it with a regular file first (or remove it) and rerun."
        return 0
    fi
    if [[ -e "$1" && ! -f "$1" ]]; then
        echo "$1 exists and is not a regular file; leaving it alone."
        return 0
    fi
    return 1
}

envrc() {
    local cmd="${1:-}"
    local file="$PWD/.envrc"

    case "$cmd" in
        work | personal)
            local account
            account=$(_envrc_account "$cmd")
            local content
            content=$(_envrc_content "$account")

            _envrc_refuse_odd "$file" && return 1

            if [[ -f "$file" ]]; then
                local existing
                existing=$(_envrc_file_account "$file")
                if [[ "$(<"$file")" == "$content" ]]; then
                    echo "Already pinned to $cmd ($account) in $file"
                    _envrc_reload
                    return 0
                fi
                if [[ -n "$existing" ]] && _envrc_is_pristine "$file"; then
                    echo "$file is pinned to '$existing'; switching to '$account'."
                elif [[ -n "$existing" ]]; then
                    echo "$file was written by envrc ('$existing') but has been edited since."
                    echo "Your edits will be replaced (a backup is kept as .envrc.bak)."
                else
                    echo "$file exists and was not written by envrc ($(wc -l <"$file" | tr -d ' ') lines)."
                    echo "It will be replaced (a backup is kept as .envrc.bak)."
                fi
                if ! read -u 0 -q "?Overwrite? [y/N] "; then
                    echo
                    echo "Left $file unchanged."
                    return 1
                fi
                echo
                if ! { [[ -n "$existing" ]] && _envrc_is_pristine "$file"; }; then
                    local bak
                    bak=$(_envrc_backup "$file") || {
                        echo "Could not back up $file; left it unchanged."
                        return 1
                    }
                    echo "Backed up the old file to $bak"
                fi
            fi

            # Same as gws-account: the account dir holds credentials, keep it private.
            local gws_dir="$HOME/.config/gws-${account}"
            mkdir -p "$gws_dir" && chmod 700 "$gws_dir"

            printf '%s\n' "$content" >"$file" || return 1
            echo "Wrote $file (pinned to $cmd: Claude ~/.claude-${account}, gws ~/.config/gws-${account})"

            if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && ! git check-ignore -q "$file"; then
                git_ignore_local "/$(git rev-parse --show-prefix).envrc"
                if ! git check-ignore -q "$file"; then
                    echo "Warning: $file is still not ignored by git (tracked, or the exclude file is not honoured)."
                fi
            fi

            if command -v direnv >/dev/null 2>&1; then
                direnv allow "$PWD" && _envrc_reload
            else
                echo "direnv is not installed; the pin takes effect once it is (brew install direnv)."
            fi
            echo "ccp/cce/gwsp/gwse override this pin for the command they run (ccp/cce also blank the gws pin for claude)."
            echo "Inside this tree a bare \`gws\` now uses the pinned account instead of being blocked."
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
                _envrc_is_pristine "$found" || echo "  Note: $found has been edited since envrc wrote it."
            else
                echo "No envrc pin applies here; plain \`claude\` uses ~/.claude (-> ~/.claude-personal)."
            fi
            [[ -n "$unmanaged" ]] && echo "  Note: $unmanaged exists but was not written by envrc."
            echo "  CLAUDE_CONFIG_DIR=${CLAUDE_CONFIG_DIR:-<unset>}"
            echo "  GOOGLE_WORKSPACE_CLI_CONFIG_DIR=${GOOGLE_WORKSPACE_CLI_CONFIG_DIR:-<unset>}"
            echo "  Overrides: ccp/cce set CLAUDE_CONFIG_DIR and blank the gws pin for claude; gwsp/gwse set the gws account."
            echo "  A pinned tree lets a bare \`gws\` through the guard; unpinned, it stays blocked."
            ;;

        off)
            if [[ ! -e "$file" && ! -L "$file" ]]; then
                echo "No .envrc in $PWD; nothing to remove."
                return 0
            fi
            _envrc_refuse_odd "$file" && return 1
            if ! _envrc_file_account "$file" >/dev/null; then
                echo "$file was not written by envrc; leaving it alone."
                return 1
            fi
            local edited=0
            _envrc_is_pristine "$file" || edited=1
            (( edited )) && echo "$file has been edited since envrc wrote it; a backup is kept as .envrc.bak."
            if ! read -u 0 -q "?Remove $file? [y/N] "; then
                echo
                echo "Left $file unchanged."
                return 1
            fi
            echo
            if (( edited )); then
                local bak
                bak=$(_envrc_backup "$file") || {
                    echo "Could not back up $file; left it in place."
                    return 1
                }
                echo "Backed up $file to $bak"
            fi
            if rm -f -- "$file"; then
                echo "Removed $file."
                _envrc_reload
            fi
            ;;

        *)
            echo "Usage: envrc work|personal|status|off"
            echo "  work       pin this directory to the enterprise accounts"
            echo "  personal   pin this directory to the personal accounts"
            echo "  status     show the pin that applies here"
            echo "  off        remove the pin written by envrc from this directory"
            echo "ccp/cce override the pinned Claude account (and blank the gws pin for claude);"
            echo "gwsp/gwse override the gws account. Bare gws works only inside a pinned tree."
            [[ -n "$cmd" && "$cmd" != "-h" && "$cmd" != "--help" ]] && return 1
            return 0
            ;;
    esac
}
