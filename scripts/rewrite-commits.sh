#!/bin/bash
set -euo pipefail

# ============================================================================
# Automated Conventional Commits Rewriter
# ============================================================================
# This script rewrites all commits in the repository to follow the
# Conventional Commits format as defined in CONTRIBUTING.md
#
# Usage: ./scripts/rewrite-commits.sh [--dry-run] [--branch BRANCH]
#
# Options:
#   --dry-run    Show what would be done without making changes
#   --branch     Process only specified branch (default: all branches)
# ============================================================================

# Configuration
BACKUP_BRANCH="backup/pre-conventional-commits-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false
TARGET_BRANCH=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --branch) TARGET_BRANCH="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Source helper functions
source "$SCRIPT_DIR/lib/scope-mapper.sh"
source "$SCRIPT_DIR/lib/type-detector.sh"
source "$SCRIPT_DIR/lib/message-generator.sh"

# Processing function for dry-run (reads from stdin)
process_commit_message_from_arg() {
    local commit_hash="$1"
    local original_msg
    original_msg=$(cat)

    # Skip if already in conventional format (preserve the 5 existing ones)
    if [[ "$original_msg" =~ ^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\(.*\))?:\ .+ ]]; then
        echo "$original_msg"
        return
    fi

    # Get changed files for this commit
    local files
    if git rev-parse "$commit_hash" &>/dev/null; then
        files=$(git show --name-only --pretty="" "$commit_hash" 2>/dev/null || echo "")
    else
        files=""
    fi

    # Determine scope and type
    local scope
    scope=$(determine_scope "$files")
    local type
    type=$(determine_type "$original_msg" "$commit_hash" "$scope")

    # Generate new message
    generate_message "$type" "$scope" "$original_msg"
}

# Main processing function for filter-branch
process_commit_message() {
    local original_msg
    original_msg=$(cat)
    local commit_hash
    commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "HEAD")

    # Skip if already in conventional format (preserve the 5 existing ones)
    if [[ "$original_msg" =~ ^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\(.*\))?:\ .+ ]]; then
        echo "$original_msg"
        return
    fi

    # Get changed files for this commit
    local files
    if git rev-parse "$commit_hash" &>/dev/null; then
        files=$(git show --name-only --pretty="" "$commit_hash" 2>/dev/null || echo "")
    else
        files=""
    fi

    # Determine scope and type
    local scope
    scope=$(determine_scope "$files")
    local type
    type=$(determine_type "$original_msg" "$commit_hash" "$scope")

    # Generate new message
    generate_message "$type" "$scope" "$original_msg"
}

# Export for git filter-branch
export -f process_commit_message
export -f determine_scope
export -f determine_type
export -f generate_message

main() {
    echo "=== Conventional Commits Rewriter ==="
    echo "Repository: $(pwd)"
    echo "Target: ${TARGET_BRANCH:-all branches}"
    echo "Dry run: $DRY_RUN"
    echo ""

    # Validation
    if [[ ! -f "CONTRIBUTING.md" ]]; then
        echo "Error: Not in dotfiles repository root"
        exit 1
    fi

    if [[ "$DRY_RUN" == false ]] && [[ -n "$(git status --porcelain)" ]]; then
        echo "Error: Working directory not clean. Commit or stash changes first."
        exit 1
    fi

    # Create backup (only if not dry-run)
    if [[ "$DRY_RUN" == false ]]; then
        echo "Creating backup branch: $BACKUP_BRANCH"
        git branch "$BACKUP_BRANCH"

        # Try to push backup (don't fail if no remote)
        if git remote get-url origin &>/dev/null; then
            echo "Pushing backup to remote..."
            git push origin "$BACKUP_BRANCH" || echo "Warning: Could not push backup to remote"
        fi

        # Create recovery tag
        local tag_name
        tag_name="pre-conventional-commits-$(date +%Y%m%d)"
        echo "Creating recovery tag: $tag_name"
        git tag "$tag_name" || echo "Warning: Tag already exists"

        # Export commit metadata
        local export_file
        export_file="commits-backup-$(date +%Y%m%d-%H%M%S).txt"
        echo "Exporting commit metadata to: $export_file"
        git log --all --format="%H|||%an|||%ae|||%ad|||%s|||%b" > "$export_file"

        echo ""
    fi

    # Dry run analysis
    if [[ "$DRY_RUN" == true ]]; then
        echo "=== DRY RUN: Analyzing commits ==="
        echo ""

        local changed_count=0
        local unchanged_count=0

        if [[ -n "$TARGET_BRANCH" ]]; then
            local commit_list="$TARGET_BRANCH"
        else
            local commit_list="--all"
        fi

        while read -r line; do
            # Split by ||| using parameter expansion
            local hash="${line%%|||*}"
            local msg="${line#*|||}"

            # Process message (close stdin to prevent reading from pipe)
            local new_msg
            new_msg=$(echo "$msg" | process_commit_message_from_arg "$hash")
            if [[ "$msg" != "$new_msg" ]]; then
                echo "WOULD CHANGE:"
                echo "  Hash: ${hash:0:7}"
                echo "  Old:  $msg"
                echo "  New:  $new_msg"
                echo ""
                ((changed_count++))
            else
                ((unchanged_count++))
            fi
        done < <(git log "$commit_list" --format="%H|||%s")

        echo "=== Summary ==="
        echo "Would change: $changed_count commits"
        echo "Would preserve: $unchanged_count commits"
        echo ""
        echo "To execute the rewrite, run without --dry-run"
        exit 0
    fi

    # Execute rewrite
    echo "=== Starting commit rewrite ==="
    echo "This will take about 30 seconds..."
    echo ""

    # Use filter-branch to rewrite commit messages
    # The msg-filter needs to call the function directly since it reads from stdin
    if [[ -n "$TARGET_BRANCH" ]]; then
        FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter \
            'process_commit_message' \
            "$TARGET_BRANCH"
    else
        # Rewrite all branches except the backup branch
        FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter \
            'process_commit_message' \
            -- --branches --tags --remotes \
            --not refs/heads/"$BACKUP_BRANCH" --not refs/remotes/origin/"$BACKUP_BRANCH"
    fi

    echo ""
    echo "=== Rewrite complete! ==="
    echo ""
    echo "Backup branch: $BACKUP_BRANCH"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes: git log --oneline | head -30"
    echo "2. Run verification: ./scripts/verify-rewrite.sh"
    echo "3. Force push to remote: git push --force-with-lease --all"
    echo "4. Clean up: rm -rf .git/refs/original/"
    echo ""
    echo "To rollback if needed:"
    echo "  git checkout $BACKUP_BRANCH"
    echo "  git branch -D main wezterm"
    echo "  git checkout -b main"
    echo "  git checkout -b wezterm"
}

main
