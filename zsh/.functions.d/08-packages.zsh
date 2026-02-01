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
    echo "   starship         - Fast prompt (Rust)"
    echo "   zinit            - Plugin manager"
    echo "   tmux             - Terminal multiplexer"
    echo ""
    echo "📁 FILE & NAVIGATION TOOLS:"
    echo "   eza              - Modern ls replacement"
    echo "   bat              - Enhanced cat with syntax highlighting"
    echo "   ripgrep (rg)     - Fast grep replacement"
    echo "   fzf              - Fuzzy finder"
    echo "   zoxide           - Smart cd replacement"
    echo "   fd               - Fast find replacement"
    echo "   dust             - Modern du replacement"
    echo "   duf              - Modern df replacement"
    echo "   htop             - Better top"
    echo ""
    echo "🔧 DEVELOPMENT TOOLS:"
    echo "   git + lazygit    - Version control"
    echo "   vim              - Text editor"
    echo "   direnv           - Environment variable management"
    echo "   atuin            - Enhanced shell history"
    echo ""
    echo "📋 LANGUAGE & RUNTIME MANAGEMENT:"
    echo "   NVM              - Node.js version manager"
    echo "   SDKMAN           - Java ecosystem manager"
    echo "   rbenv            - Ruby version manager"
    echo "   pyenv            - Python version manager"
    echo ""
    echo "💻 PROGRAMMING LANGUAGES & FRAMEWORKS:"
    echo "   Node.js          - JavaScript runtime (via NVM)"
    echo "   Java/JVM         - Java platform (via SDKMAN)"
    echo "   Gradle           - Build tool"
    echo "   Maven            - Build tool"
    echo "   Python           - Programming language (via pyenv)"
    echo "   Ruby             - Programming language (via rbenv)"
    echo "   Ballerina        - Programming language"
    echo ""
    echo "🏛️ LEGACY/SPECIFIC TOOLS:"
    echo "   Apache Tomcat    - Version 9.0.8"
    echo "   Apache Maven     - Version 3.5.3"
    echo "   Apache Ant       - Version 1.10.3"
    echo "   JMeter           - Load testing tool"
    echo "   MySQL            - Version 5.7"
    echo ""
    echo "☁️ CLOUD & DEVOPS:"
    echo "   Docker           - Containerization"
    echo "   Google Cloud SDK - GCP tools"
    echo "   Rancher Desktop  - Container management"
    echo ""
    echo "🔐 SECURITY & SECRETS:"
    echo "   SOPS             - Secret management"
    echo "   Age              - Encryption"
    echo ""
    echo "⚙️ SYSTEM TOOLS:"
    echo "   Homebrew         - Package manager"
    echo "   ag               - The Silver Searcher"
    echo "   todo.sh          - Todo management"
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
        echo "• starship, atuin, direnv"
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
            # Comment out NVM section in .zshrc using more robust pattern matching
            if grep -q "^# Lazy load NVM" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak '/^# Lazy load NVM/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.zshrc"
                echo "✅ NVM configuration commented out in .zshrc"
            else
                echo "ℹ️ NVM configuration not found or already removed"
            fi
            ;;

        "sdkman")
            echo "Removing SDKMAN configuration..."
            if grep -q "Lazy load SDKMAN" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak '/# Lazy load SDKMAN/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.zshrc"
                echo "✅ SDKMAN configuration commented out in .zshrc"
            else
                echo "ℹ️ SDKMAN configuration not found or already removed"
            fi
            ;;

        "rbenv")
            echo "Removing rbenv configuration..."
            if grep -q "_rbenv_lazy_load" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak '/# Lazy load rbenv/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.zshrc"
                echo "✅ rbenv configuration commented out in .zshrc"
            else
                echo "ℹ️ rbenv configuration not found or already removed"
            fi
            ;;

        "pyenv")
            echo "Removing pyenv configuration..."
            if grep -q "_pyenv_lazy_load" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak '/# Lazy load pyenv/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.zshrc"
                echo "✅ pyenv configuration commented out in .zshrc"
            else
                echo "ℹ️ pyenv configuration not found or already removed"
            fi
            ;;

        "oh-my-posh" | "starship")
            echo "Removing $tool_name configuration..."
            if grep -qi "$tool_name" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak "/# Initialize $tool_name/,/^fi$/s/^/# REMOVED: /" "$dotfiles_dir/zsh/.zshrc"
                echo "✅ $tool_name configuration commented out in .zshrc"
            else
                echo "ℹ️ $tool_name configuration not found or already removed"
            fi

            # Cleanup instructions
            echo ""
            echo "To fully remove $tool_name:"
            echo "  brew uninstall $tool_name"
            if [ "$tool_name" = "oh-my-posh" ]; then
                echo "  rm -rf ~/.config/ohmyposh ~/.cache/zsh/omp_cache.zsh"
            else
                echo "  rm -rf ~/.config/starship.toml"
            fi
            ;;

        "atuin")
            echo "Removing Atuin configuration..."
            if grep -q "_atuin_lazy_load" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak '/# Lazy load atuin/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.zshrc"
                echo "✅ Atuin configuration commented out in .zshrc"
            fi
            # Also remove from aliases
            if grep -q "atuin" "$dotfiles_dir/zsh/.aliases.sh"; then
                sed -i.bak '/# Atuin shell history aliases/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.aliases.sh"
                echo "✅ Atuin aliases commented out in .aliases.sh"
            fi
            ;;

        "direnv")
            echo "Removing direnv configuration..."
            if grep -q "_direnv_lazy_load" "$dotfiles_dir/zsh/.zshrc"; then
                sed -i.bak '/# Lazy load direnv/,/^fi$/s/^/# REMOVED: /' "$dotfiles_dir/zsh/.zshrc"
                echo "✅ direnv configuration commented out in .zshrc"
            else
                echo "ℹ️ direnv configuration not found or already removed"
            fi
            ;;

        "google-cloud-sdk")
            echo "ℹ️ Google Cloud SDK is now managed via packages.json (gcp category)"
            echo "   Set 'enabled: true' in packages.json under categories.gcp to enable"
            echo "   gcloud is disabled by default and no longer part of core dotfiles"
            echo ""
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
            echo "• starship, atuin, direnv"
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
