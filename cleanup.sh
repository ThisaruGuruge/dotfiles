#!/bin/bash

echo "🧹 Dotfiles Cleanup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v bestow >/dev/null 2>&1; then
    echo "❌ bestow is not installed. Install with: go install github.com/redpierrot/bestow@latest"
    exit 1
fi

if [ -n "$1" ]; then
    # Unstow specific package if argument provided
    echo "Removing symlinks for $1..."
    # bin/ symlinks into ~/bin, not $HOME, so it needs a separate destination
    dest="$HOME"
    [ "$1" = "bin" ] && dest="$HOME/bin"
    if bestow unstow "$1" -d "$dest" 2>/dev/null; then
        echo "✅ $1 unstowed"
    else
        echo "⚠️  Failed to unstow $1 (might not be stowed)"
    fi
else
    # No package given: unstow everything bestow manages
    echo "Unstowing all packages..."
    if bestow unstow 2>/dev/null; then
        echo "✅ All packages unstowed"
    else
        echo "⚠️  Failed to unstow one or more packages"
    fi
    if [ -d "bin" ]; then
        if bestow unstow bin -d "$HOME/bin" 2>/dev/null; then
            echo "✅ bin package unstowed from ~/bin"
        else
            echo "⚠️  Failed to unstow bin package"
        fi
    fi
fi

echo ""
echo "🎉 Cleanup complete!"
