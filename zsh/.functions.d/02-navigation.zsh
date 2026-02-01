#!/bin/zsh
# ============================================================================
# Navigation Functions
# ============================================================================
# Smart directory/project navigation: take(), takedir(), takegit(), takeurl()

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
