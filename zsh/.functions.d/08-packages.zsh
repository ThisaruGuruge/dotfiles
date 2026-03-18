#!/bin/zsh
# ============================================================================
# Package Management Functions
# ============================================================================
# Tool management: list_dotfiles_tools(), remove_dotfiles_tool(), install_lazygit_latest(), manage_packages()

# List all tools configured in dotfiles
list_dotfiles_tools() {
    echo "🛠️ Dotfiles Tool Inventory"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📺 SHELL & TERMINAL ENHANCEMENT:"
    echo "   zsh              - Shell"
    echo "   powerlevel10k    - Fast prompt (pure Zsh)"
    echo "   zinit            - Plugin manager"
    echo "   tmux             - Terminal multiplexer"
    echo ""
    echo "📁 FILE & NAVIGATION TOOLS:"
    echo "   yazi             - Terminal file manager (Neovim integration)"
    echo "   eza              - Modern ls replacement"
    echo "   bat              - Enhanced cat with syntax highlighting"
    echo "   glow             - Terminal markdown viewer"
    echo "   ripgrep (rg)     - Fast grep replacement"
    echo "   fzf              - Fuzzy finder"
    echo "   zoxide           - Smart cd replacement"
    echo "   fd               - Fast find replacement"
    echo "   dust             - Modern du replacement"
    echo "   htop             - Better top"
    echo ""
    echo "🔧 DEVELOPMENT TOOLS:"
    echo "   git + lazygit    - Version control"
    echo "   git-delta        - Enhanced git diff viewer"
    echo "   gh               - GitHub CLI"
    echo "   lazydocker       - Docker TUI"
    echo "   nvim             - Text editor"
    echo "   direnv           - Directory-specific environments"
    echo "   atuin            - Enhanced shell history"
    echo "   jq               - JSON processor"
    echo "   jless            - Interactive JSON/YAML viewer"
    echo ""
    echo "📋 LANGUAGE & RUNTIME MANAGEMENT:"
    echo "   NVM              - Node.js version manager (lazy-loaded)"
    echo "   SDKMAN           - Java ecosystem manager (lazy-loaded)"
    echo "   rbenv            - Ruby version manager (optional)"
    echo "   pyenv            - Python version manager (optional)"
    echo "   Ballerina        - Cloud-native programming language"
    echo ""
    echo "🔐 SECURITY & SECRETS:"
    echo "   SOPS             - Secret management"
    echo "   Age              - File encryption"
    echo "   pam-reattach     - Touch ID in tmux"
    echo ""
    echo "⚙️ SYSTEM TOOLS:"
    echo "   Homebrew         - Package manager"
    echo "   stow             - Symlink farm manager"
    echo ""
    echo "💡 Usage: remove_dotfiles_tool <tool_name>"
    echo "   Example: remove_dotfiles_tool rbenv"
}

# Remove a specific tool from dotfiles configuration
remove_dotfiles_tool() {
    local tool_name="$1"

    if [ -z "$tool_name" ]; then
        echo "❌ Usage: remove_dotfiles_tool <tool_name>"
        echo ""
        echo "Available tools to remove:"
        echo "• nvm, sdkman, rbenv, pyenv"
        echo "• atuin, direnv"
        echo "• docker"
        echo "• legacy-java-tools (maven, tomcat, ant, mysql)"
        echo "• jmeter"
        echo ""
        echo "Use 'list_dotfiles_tools' to see all configured tools"
        return 1
    fi

    # Get dotfiles directory
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    else
        echo "❌ Dotfiles directory not found"
        return 1
    fi

    echo "🗑️ Removing $tool_name from dotfiles configuration..."
    echo ""

    case "$tool_name" in
        "nvm")
            echo "Removing NVM configuration..."
            local nvm_file="$dotfiles_dir/zsh/.zshrc.d/02-completion.zsh"
            if [ -f "$nvm_file" ] && grep -q "NVM" "$nvm_file"; then
                sed -i.bak '/# Lazy load NVM/,/^fi$/s/^/# REMOVED: /' "$nvm_file"
                echo "✅ NVM configuration commented out in $(basename "$nvm_file")"
            else
                echo "ℹ️ NVM configuration not found or already removed"
            fi
            ;;

        "sdkman")
            echo "Removing SDKMAN configuration..."
            local sdkman_file="$dotfiles_dir/zsh/.zshrc.d/02-completion.zsh"
            if [ -f "$sdkman_file" ] && grep -q "SDKMAN" "$sdkman_file"; then
                sed -i.bak '/# Lazy load SDKMAN/,/^fi$/s/^/# REMOVED: /' "$sdkman_file"
                echo "✅ SDKMAN configuration commented out in $(basename "$sdkman_file")"
            else
                echo "ℹ️ SDKMAN configuration not found or already removed"
            fi
            ;;

        "rbenv")
            echo "Removing rbenv configuration..."
            local rbenv_file="$dotfiles_dir/zsh/.zshrc.d/06-environment.zsh"
            if [ -f "$rbenv_file" ] && grep -q "rbenv" "$rbenv_file"; then
                sed -i.bak '/# Initialize rbenv/,/^fi$/s/^/# REMOVED: /' "$rbenv_file"
                echo "✅ rbenv configuration commented out in $(basename "$rbenv_file")"
            else
                echo "ℹ️ rbenv configuration not found or already removed"
            fi
            ;;

        "pyenv")
            echo "Removing pyenv configuration..."
            local pyenv_file="$dotfiles_dir/zsh/.zshrc.d/06-environment.zsh"
            if [ -f "$pyenv_file" ] && grep -q "pyenv" "$pyenv_file"; then
                sed -i.bak '/# Initialize pyenv/,/^fi$/s/^/# REMOVED: /' "$pyenv_file"
                echo "✅ pyenv configuration commented out in $(basename "$pyenv_file")"
            else
                echo "ℹ️ pyenv configuration not found or already removed"
            fi
            ;;

        "atuin")
            echo "Removing Atuin configuration..."
            local atuin_file="$dotfiles_dir/zsh/.zshrc.d/05-shell-integrations.zsh"
            if [ -f "$atuin_file" ] && grep -q "atuin" "$atuin_file"; then
                sed -i.bak '/# Atuin/,/^fi$/s/^/# REMOVED: /' "$atuin_file"
                echo "✅ Atuin configuration commented out in $(basename "$atuin_file")"
            fi
            # Also remove from aliases
            if grep -q "atuin" "$dotfiles_dir/zsh/.aliases.sh"; then
                sed -i.bak '/# Atuin shell history aliases/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.aliases.sh"
                echo "✅ Atuin aliases commented out in .aliases.sh"
            fi
            ;;

        "direnv")
            echo "Removing direnv configuration..."
            local direnv_file="$dotfiles_dir/zsh/.zshrc.d/05-shell-integrations.zsh"
            if [ -f "$direnv_file" ] && grep -q "direnv" "$direnv_file"; then
                sed -i.bak '/# Direnv/,/^fi$/s/^/# REMOVED: /' "$direnv_file"
                echo "✅ direnv configuration commented out in $(basename "$direnv_file")"
            else
                echo "ℹ️ direnv configuration not found or already removed"
            fi
            ;;

        "google-cloud-sdk")
            echo "ℹ️ Google Cloud SDK is managed via optional Brewfiles (packages/cloud.brewfile)"
            echo "   To uninstall gcloud completely, run:"
            echo "   brew uninstall --cask google-cloud-sdk"
            return 0
            ;;

        "legacy-java-tools")
            echo "Removing legacy Java tools (Maven, Tomcat, Ant, MySQL)..."
            if [ -f "$dotfiles_dir/zsh/.paths.sh" ]; then
                # Comment out legacy tool sections
                sed -i.bak '/# Legacy tool paths/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.paths.sh"
                echo "✅ Legacy Java tools commented out in .paths.sh"
            else
                echo "ℹ️ .paths.sh not found"
            fi
            ;;

        "jmeter")
            echo "Removing JMeter configuration..."
            if grep -q "JMeter" "$dotfiles_dir/zsh/.paths.sh"; then
                sed -i.bak '/# JMeter/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.paths.sh"
                echo "✅ JMeter configuration commented out in .paths.sh"
            else
                echo "ℹ️ JMeter configuration not found or already removed"
            fi
            ;;

        "docker")
            echo "Removing Docker aliases..."
            if grep -q "docker" "$dotfiles_dir/zsh/.aliases.sh"; then
                sed -i.bak '/# Docker aliases/,/alias dprune/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.aliases.sh"
                echo "✅ Docker aliases commented out in .aliases.sh"
            else
                echo "ℹ️ Docker aliases not found or already removed"
            fi
            ;;

        *)
            echo "❌ Unknown tool: $tool_name"
            echo ""
            echo "Available tools to remove:"
            echo "• nvm, sdkman, rbenv, pyenv"
            echo "• atuin, direnv"
            echo "• docker"
            echo "• legacy-java-tools (maven, tomcat, ant, mysql)"
            echo "• jmeter"
            return 1
            ;;
    esac

    echo ""
    echo "🎉 Tool removal complete!"
    echo ""
    echo "💡 Next steps:"
    echo "   • Restart your terminal or run: source ~/.zshrc"
    echo "   • Optionally uninstall the tool itself using your package manager"
    echo "   • Backup files created with .bak extension in case you need to restore"
    echo ""
    echo "🔄 To restore a tool, edit the config files and remove '# REMOVED: ' prefixes"
}

# Install or update lazygit from official tap
install_lazygit_latest() {
    local action="${1:-install}"

    case "$action" in
        install)
            echo "🚀 Installing lazygit from official tap..."
            if ! brew tap | grep -q "jesseduffield/lazygit"; then
                echo "Adding jesseduffield/lazygit tap..."
                brew tap jesseduffield/lazygit
            fi
            brew install jesseduffield/lazygit/lazygit
            ;;
        update)
            echo "🔄 Updating lazygit from official tap..."
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
            echo "  install_lazygit_latest          # Install from official tap"
            echo "  install_lazygit_latest install  # Install from official tap"
            echo "  install_lazygit_latest update   # Update to latest version"
            echo "  install_lazygit_latest check    # Check current installation"
            echo ""
            echo "💡 Using official jesseduffield tap for frequent updates"
            return 1
            ;;
    esac
}

# Manage dotfiles packages (enable/disable packages and regenerate Brewfile)
manage_packages() {
    # Check if we have the package manager script
    local dotfiles_dir=""
    if [ -d "${HOME}/dotfiles" ]; then
        dotfiles_dir="${HOME}/dotfiles"
    elif [ -d "${HOME}/.dotfiles" ]; then
        dotfiles_dir="${HOME}/.dotfiles"
    fi

    if [ -n "$dotfiles_dir" ] && [ -f "$dotfiles_dir/bin/manage-packages" ]; then
        "$dotfiles_dir/bin/manage-packages" "$@"
    else
        echo "❌ Package manager not found"
        echo "Expected location: $dotfiles_dir/bin/manage-packages"
        echo ""
        echo "📦 Package management allows you to:"
        echo "• Enable/disable individual packages"
        echo "• Enable/disable entire categories"
        echo "• Automatically regenerate Brewfile"
        echo "• Maintain consistency between init.sh and Brewfile"
        echo ""
        echo "Make sure you're in your dotfiles directory and the script exists."
    fi
}
