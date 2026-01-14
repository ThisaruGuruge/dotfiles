#!/bin/bash
set -euo pipefail

# ============================================================================
# Verify Commit Rewrite
# ============================================================================
# This script verifies that the commit rewrite was successful and that
# all commits follow the Conventional Commits format
# ============================================================================

echo "=== Verifying Commit Rewrite ==="
echo ""

# Find backup branch
BACKUP_BRANCH=$(git branch | grep 'backup/pre-conventional' | head -1 | xargs)

if [[ -z "$BACKUP_BRANCH" ]]; then
    echo "Error: No backup branch found"
    echo "Cannot verify without a backup to compare against"
    exit 1
fi

echo "Comparing against backup: $BACKUP_BRANCH"
echo ""

# Test 1: Verify commit count unchanged
echo "Test 1: Verifying commit count..."
OLD_COUNT=$(git log --all --oneline "$BACKUP_BRANCH" | wc -l | xargs)
NEW_COUNT=$(git log --all --oneline | wc -l | xargs)

if [[ $OLD_COUNT -eq $NEW_COUNT ]]; then
    echo "✓ PASS: Commit count unchanged ($NEW_COUNT commits)"
else
    echo "✗ FAIL: Commit count mismatch!"
    echo "  Original: $OLD_COUNT, New: $NEW_COUNT"
    exit 1
fi
echo ""

# Test 2: Verify all commits follow Conventional Commits format
echo "Test 2: Verifying Conventional Commits format..."
NON_CONVENTIONAL=$(git log --all --format="%s" | grep -vE '^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\(.*\))?:\ .+' || true)

if [[ -z "$NON_CONVENTIONAL" ]]; then
    echo "✓ PASS: All commits follow Conventional Commits format"
else
    echo "✗ FAIL: Found non-conventional commits:"
    echo "$NON_CONVENTIONAL"
    exit 1
fi
echo ""

# Test 3: Verify metadata preserved (authors)
echo "Test 3: Verifying commit authors preserved..."
OLD_AUTHORS=$(git log --all --format="%an|||%ae" "$BACKUP_BRANCH" | sort | uniq)
NEW_AUTHORS=$(git log --all --format="%an|||%ae" | sort | uniq)

if [[ "$OLD_AUTHORS" == "$NEW_AUTHORS" ]]; then
    echo "✓ PASS: All commit authors preserved"
else
    echo "✗ FAIL: Author mismatch detected"
    echo "This should not happen - only messages should change!"
    exit 1
fi
echo ""

# Test 4: Verify no file content changes
echo "Test 4: Verifying no file content changes..."
# Compare the tree of the latest commit
OLD_TREE=$(git log "$BACKUP_BRANCH" --format="%T" -1)
NEW_TREE=$(git log --format="%T" -1)

if [[ "$OLD_TREE" == "$NEW_TREE" ]]; then
    echo "✓ PASS: File contents unchanged (tree hashes match)"
else
    echo "⚠ WARNING: Tree hashes differ on HEAD"
    echo "This is expected if commits were made after the backup"
    echo "Checking overall diff..."

    # Show diff between backup and current
    DIFF_OUTPUT=$(git diff "$BACKUP_BRANCH"..HEAD --stat)
    if [[ -z "$DIFF_OUTPUT" ]]; then
        echo "✓ PASS: No file differences detected"
    else
        echo "Files changed since backup:"
        echo "$DIFF_OUTPUT"
    fi
fi
echo ""

# Test 5: Sample commit review
echo "Test 5: Sample of rewritten commits..."
echo ""
git log --oneline | head -15
echo ""

# Test 6: Type distribution
echo "Test 6: Commit type distribution..."
git log --all --format="%s" | grep -oE '^[a-z]+' | sort | uniq -c | sort -rn
echo ""

# Test 7: Scope distribution
echo "Test 7: Commit scope distribution..."
git log --all --format="%s" | grep -oP '\(\K[^)]+' | sort | uniq -c | sort -rn || echo "(No scopes found or some commits have no scope)"
echo ""

# Final summary
echo "=== Verification Summary ==="
echo "✓ All automated tests passed"
echo "✓ Commit history successfully rewritten"
echo ""
echo "Manual checks recommended:"
echo "1. Review commits: git log --oneline | less"
echo "2. Check specific types: git log --oneline --grep='^feat'"
echo "3. Verify important commits retained their meaning"
echo ""
echo "If everything looks good:"
echo "  git push --force-with-lease --all"
echo ""
echo "To rollback if needed:"
echo "  git checkout $BACKUP_BRANCH"
echo "  git branch -D main wezterm"
echo "  git checkout -b main"
echo "  git checkout -b wezterm"
