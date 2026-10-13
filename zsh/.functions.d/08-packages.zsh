#!/bin/zsh
# ============================================================================
# Package Management Functions
# ============================================================================
# Tool management: list_dotfiles_tools(), install_lazygit_latest()

# List every tool declared in Brewfile and packages/*.brewfile (the single
# source of truth), with the trailing comment from each entry as description.
list_dotfiles_tools() {
    local root="${DOTFILES_DIR:-}"
    if [[ -z "$root" || ! -f "$root/Brewfile" ]]; then
        if [[ -f "${HOME}/dotfiles/Brewfile" ]]; then
            root="${HOME}/dotfiles"
        elif [[ -f "${HOME}/.dotfiles/Brewfile" ]]; then
            root="${HOME}/.dotfiles"
        else
            echo "❌ Dotfiles directory with a Brewfile not found"
            return 1
        fi
    fi

    echo "🛠️ Dotfiles Tool Inventory"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local file label
    for file in "$root/Brewfile" "$root"/packages/*.brewfile(N); do
        if [[ "$file" == "$root/Brewfile" ]]; then
            label="CORE (Brewfile)"
        else
            label="OPTIONAL (packages/${file:t})"
        fi
        echo ""
        echo "📦 ${label}:"
        awk '
            /^[[:space:]]*(brew|cask|tap)[[:space:]]+"/ {
                kind = $1
                name = $2
                gsub(/[",]/, "", name)
                desc = ""
                if (match($0, /#.*/)) {
                    desc = substr($0, RSTART + 1)
                    sub(/^[[:space:]]+/, "", desc)
                }
                if (desc == "") {
                    printf "   %-5s %s\n", kind, name
                } else {
                    printf "   %-5s %-32s %s\n", kind, name, desc
                }
            }
        ' "$file"
    done

    echo ""
    echo "💡 Runtimes (not in Brewfile): NVM, SDKMAN (lazy-loaded); pyenv/rbenv optional"
    echo "💡 Add a tool: edit Brewfile or packages/*.brewfile, then run 'brew bundle'"
}

# Install or update lazygit from the jesseduffield tap
install_lazygit_latest() {
    local action="${1:-install}"

    case "$action" in
        install)
            echo "🚀 Installing lazygit from the jesseduffield tap..."
            if ! brew tap | grep -q "jesseduffield/lazygit"; then
                echo "Adding jesseduffield/lazygit tap..."
                brew tap jesseduffield/lazygit
            fi
            brew install jesseduffield/lazygit/lazygit
            ;;
        update)
            echo "🔄 Updating lazygit from the jesseduffield tap..."
            brew upgrade jesseduffield/lazygit/lazygit
            ;;
        check)
            echo "🔍 Checking lazygit installation..."
            if command -v lazygit >/dev/null 2>&1; then
                local version
                version=$(lazygit --version 2>/dev/null | head -n 1)
                echo "✅ lazygit is installed: $version"
                return 0
            else
                echo "❌ lazygit is not installed"
                return 1
            fi
            ;;
        *)
            echo "Usage: install_lazygit_latest [install|update|check]"
            echo ""
            echo "Examples:"
            echo "  install_lazygit_latest          # Install from the jesseduffield tap"
            echo "  install_lazygit_latest install  # Install from the jesseduffield tap"
            echo "  install_lazygit_latest update   # Update to latest version"
            echo "  install_lazygit_latest check    # Check current installation"
            echo ""
            echo "💡 Using the jesseduffield tap (can run ahead of homebrew-core)"
            return 1
            ;;
    esac
}
