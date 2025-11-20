#!/bin/bash

# Dotfiles Cleanup Script
# Removes symlinks created by Stow

DOTFILES_DIR="$HOME/dotfiles"
STOW_DIRS=(
    "zsh"
    "git"
    "tmux"
    ".config"
)

echo "🧹 Dotfiles Cleanup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v stow >/dev/null 2>&1; then
    echo "❌ GNU Stow is not installed."
    exit 1
fi

# Function to unstow a package
unstow_package() {
    local package="$1"
    echo "Removing symlinks for $package..."
    if stow -D "$package" 2>/dev/null; then
        echo "✅ $package unstowed"
    else
        echo "⚠️  Failed to unstow $package (might not be stowed)"
    fi
}

# Main execution
if [ -n "$1" ]; then
    # Unstow specific package if argument provided
    unstow_package "$1"
else
    # Unstow all default packages
    echo "Unstowing all default packages..."
    for pkg in "${STOW_DIRS[@]}"; do
        unstow_package "$pkg"
    done
fi

echo ""
echo "🎉 Cleanup complete!"
