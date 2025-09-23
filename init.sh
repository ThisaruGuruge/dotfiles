#!/bin/bash

# Dotfiles Initialization Script
# This script sets up the complete development environment with dependency checking

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Unicode symbols
CHECK="✅"
CROSS="❌"
ARROW="➜"
INFO="ℹ️"
WARNING="⚠️"

DOTFILES_DIR="$HOME/.dotfiles"

# Logging functions
log_info() {
    echo -e "${CYAN}${INFO} $1${NC}"
}

log_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

log_error() {
    echo -e "${RED}${CROSS} $1${NC}"
}

log_step() {
    echo -e "\n${BLUE}${ARROW} $1${NC}"
}

# User confirmation function
confirm() {
    while true; do
        read -p "$(echo -e "${YELLOW}$1 (y/N): ${NC}")" yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            "" ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running on macOS
check_macos() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "This script is designed for macOS. Detected OS: $OSTYPE"
        exit 1
    fi
    log_success "Running on macOS"
}

# Check if Xcode Command Line Tools are installed
check_xcode_tools() {
    log_step "Checking Xcode Command Line Tools"

    if xcode-select -p >/dev/null 2>&1; then
        log_success "Xcode Command Line Tools already installed"
        return 0
    fi

    log_warning "Xcode Command Line Tools not found"
    if confirm "Install Xcode Command Line Tools? (Required for development)"; then
        log_info "Installing Xcode Command Line Tools..."
        xcode-select --install
        log_info "Please complete the installation in the dialog that opened, then run this script again"
        exit 0
    else
        log_error "Xcode Command Line Tools are required. Exiting."
        exit 1
    fi
}

# Check and install Homebrew
setup_homebrew() {
    log_step "Checking Homebrew"

    if command_exists brew; then
        log_success "Homebrew already installed: $(brew --version | head -n 1)"
        return 0
    fi

    log_warning "Homebrew not found"
    if confirm "Install Homebrew? (Required package manager)"; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Add Homebrew to PATH for this session
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi

        log_success "Homebrew installed successfully"
    else
        log_error "Homebrew is required. Exiting."
        exit 1
    fi
}

# Install GNU Stow
install_stow() {
    log_step "Installing GNU Stow"

    if command_exists stow; then
        log_success "GNU Stow already installed: $(stow --version | head -n 1)"
        return 0
    fi

    log_warning "GNU Stow not found"
    if confirm "Install GNU Stow? (Required for dotfiles management)"; then
        log_info "Installing GNU Stow..."
        brew install stow
        log_success "GNU Stow installed successfully"
    else
        log_error "GNU Stow is required for this dotfiles setup. Exiting."
        exit 1
    fi
}

# Install core dependencies
install_core_dependencies() {
    log_step "Installing Core Dependencies"

    local packages=("oh-my-posh" "fzf" "zoxide" "tree" "bat" "eza" "ripgrep" "fd" "git-delta" "lazygit" "tmux" "htop" "direnv")
    local missing_packages=()

    # Check which packages are missing
    for package in "${packages[@]}"; do
        if ! brew list "$package" >/dev/null 2>&1; then
            missing_packages+=("$package")
        else
            log_success "$package already installed"
        fi
    done

    if [ ${#missing_packages[@]} -eq 0 ]; then
        log_success "All core dependencies already installed"
        return 0
    fi

    log_info "Missing packages: ${missing_packages[*]}"
    if confirm "Install missing core dependencies?"; then
        log_info "Installing: ${missing_packages[*]}"
        brew install "${missing_packages[@]}"
        log_success "Core dependencies installed"
    else
        log_warning "Skipped core dependencies installation"
    fi
}

# Install development tools
install_dev_tools() {
    log_step "Installing Development Tools (Optional)"

    local dev_tools=("pyenv" "rbenv" "nvm")
    local missing_tools=()

    # Check which tools are missing
    for tool in "${dev_tools[@]}"; do
        if ! brew list "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        else
            log_success "$tool already installed"
        fi
    done

    if [ ${#missing_tools[@]} -eq 0 ]; then
        log_success "All development tools already installed"
    else
        log_info "Missing development tools: ${missing_tools[*]}"
        if confirm "Install development tools? (Python, Ruby, Node.js version managers)"; then
            log_info "Installing: ${missing_tools[*]}"
            brew install "${missing_tools[@]}"
            log_success "Development tools installed"
        else
            log_warning "Skipped development tools installation"
        fi
    fi

    # Install SDKMAN
    install_sdkman
}

# Install SDKMAN
install_sdkman() {
    log_step "Installing SDKMAN (Java SDK Manager)"

    if [ -d "$HOME/.sdkman" ]; then
        log_success "SDKMAN already installed"
        return 0
    fi

    if confirm "Install SDKMAN? (Java, Gradle, Maven, Kotlin version manager)"; then
        log_info "Installing SDKMAN..."
        curl -s "https://get.sdkman.io" | bash

        # Source SDKMAN for this session
        if [ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
            source "$HOME/.sdkman/bin/sdkman-init.sh"
            log_success "SDKMAN installed successfully"

            if confirm "Install Java 21 LTS via SDKMAN?"; then
                log_info "Installing Java 21 LTS..."
                sdk install java 21.0.5-tem
                log_success "Java 21 installed"
            fi
        else
            log_error "SDKMAN installation failed"
        fi
    else
        log_warning "Skipped SDKMAN installation"
    fi
}

# Install terminal applications
install_terminal_apps() {
    log_step "Installing Terminal Applications (Optional)"

    # Check for terminal apps
    local warp_installed=false
    local iterm_installed=false

    if [ -d "/Applications/Warp.app" ]; then
        warp_installed=true
        log_success "Warp already installed"
    fi

    if [ -d "/Applications/iTerm.app" ]; then
        iterm_installed=true
        log_success "iTerm2 already installed"
    fi

    if ! $warp_installed && ! $iterm_installed; then
        log_info "No modern terminal detected"
        echo "  1) Warp (Recommended - Modern terminal with AI features)"
        echo "  2) iTerm2 (Feature-rich terminal)"
        echo "  3) Skip (use Terminal.app)"

        read -p "Choose terminal to install (1/2/3): " choice
        case $choice in
            1)
                log_info "Installing Warp..."
                brew install --cask warp
                log_success "Warp installed"
                ;;
            2)
                log_info "Installing iTerm2..."
                brew install --cask iterm2
                log_success "iTerm2 installed"
                ;;
            *)
                log_info "Skipping terminal installation"
                ;;
        esac
    fi
}

# Install Nerd Fonts
install_fonts() {
    log_step "Installing Nerd Fonts"

    # Check if FiraCode Nerd Font is installed
    if [ -f "$HOME/Library/Fonts/FiraCodeNerdFont-Regular.ttf" ] || [ -f "/System/Library/Fonts/FiraCodeNerdFont-Regular.ttf" ]; then
        log_success "FiraCode Nerd Font already installed"
        return 0
    fi

    log_warning "Nerd Font not found"
    if confirm "Install FiraCode Nerd Font? (Required for proper prompt display)"; then
        log_info "Installing FiraCode Nerd Font..."
        # Fonts are now in the main homebrew-cask repository
        brew install --cask font-fira-code-nerd-font
        log_success "FiraCode Nerd Font installed"
        log_info "Please configure your terminal to use 'FiraCode Nerd Font'"
    else
        log_warning "Skipped font installation - prompt may not display correctly"
    fi
}

# Install Zinit
install_zinit() {
    log_step "Installing Zinit (Zsh Plugin Manager)"

    local zinit_dir="${HOME}/.local/share/zinit/zinit.git"

    if [ -d "$zinit_dir" ]; then
        log_success "Zinit already installed"
        return 0
    fi

    if confirm "Install Zinit plugin manager?"; then
        log_info "Installing Zinit..."
        bash -c "$(curl --fail --show-error --silent --location https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"
        log_success "Zinit installed"
    else
        log_warning "Skipped Zinit installation"
    fi
}

# Setup environment file
setup_environment() {
    log_step "Setting up Environment Variables"

    if [ -f "$DOTFILES_DIR/zsh/.env" ] && [ -s "$DOTFILES_DIR/zsh/.env" ]; then
        log_success "Environment file already configured"
        return 0
    fi

    if [ ! -f "$DOTFILES_DIR/zsh/.env.example" ]; then
        log_error ".env.example not found in zsh directory"
        return 1
    fi

    log_info "Creating .env file from template"
    cp "$DOTFILES_DIR/zsh/.env.example" "$DOTFILES_DIR/zsh/.env"

    log_warning "Please edit $DOTFILES_DIR/zsh/.env with your personal information:"
    log_info "  - GitHub username"
    log_info "  - GitHub Personal Access Token (if needed)"

    if confirm "Open .env file for editing now?"; then
        if command_exists code; then
            code "$DOTFILES_DIR/zsh/.env"
        elif command_exists vim; then
            vim "$DOTFILES_DIR/zsh/.env"
        else
            nano "$DOTFILES_DIR/zsh/.env"
        fi
    fi
}

# Setup Git personal configuration
setup_git_config() {
    log_step "Setting up Git Personal Configuration"

    if [ -f "$HOME/.gitconfig.local" ]; then
        log_success "Git personal config already exists"
        return 0
    fi

    if [ -f "$DOTFILES_DIR/git/.gitconfig.local.example" ]; then
        log_info "Creating personal Git configuration from template"
        cp "$DOTFILES_DIR/git/.gitconfig.local.example" "$HOME/.gitconfig.local"

        log_warning "Please edit ~/.gitconfig.local with your personal Git information:"
        log_info "  - Your full name"
        log_info "  - Your email address"
        log_info "  - GitHub/GitLab usernames"

        if confirm "Open Git config for editing now?"; then
            if command_exists code; then
                code "$HOME/.gitconfig.local"
            elif command_exists vim; then
                vim "$HOME/.gitconfig.local"
            else
                nano "$HOME/.gitconfig.local"
            fi
        fi
    else
        log_warning "Git config template not found, skipping personal Git setup"
    fi
}

# Backup existing dotfiles
backup_existing_files() {
    log_step "Backing up existing dotfiles"

    local files=(".zshrc" ".vimrc" ".aliases.sh" ".functions.sh" ".paths.sh")
    local backup_dir="$HOME/.dotfiles_backup_$(date +%Y%m%d_%H%M%S)"
    local backed_up=false

    for file in "${files[@]}"; do
        if [ -f "$HOME/$file" ] && [ ! -L "$HOME/$file" ]; then
            if [ "$backed_up" = false ]; then
                mkdir -p "$backup_dir"
                backed_up=true
                log_info "Creating backup directory: $backup_dir"
            fi
            cp "$HOME/$file" "$backup_dir/"
            log_info "Backed up: $file"
        fi
    done

    if [ "$backed_up" = true ]; then
        log_success "Existing dotfiles backed up to: $backup_dir"
    else
        log_info "No existing dotfiles to backup"
    fi
}

# Use stow to create symlinks
stow_packages() {
    log_step "Using Stow to manage dotfiles"

    local packages=("zsh" "vim" "config" "git" "tmux" "direnv")
    local stowed_packages=()

    for package in "${packages[@]}"; do
        if [ -d "$DOTFILES_DIR/$package" ]; then
            log_info "Stowing $package package..."

            # Use stow to create symlinks
            if stow -t "$HOME" "$package" 2>/dev/null; then
                log_success "Stowed $package package"
                stowed_packages+=("$package")
            else
                log_warning "Failed to stow $package (may have conflicts)"

                # Try to restow (useful if already stowed)
                if stow -R -t "$HOME" "$package" 2>/dev/null; then
                    log_success "Re-stowed $package package"
                    stowed_packages+=("$package")
                else
                    log_error "Could not stow $package package"
                fi
            fi
        else
            log_warning "Package directory not found: $package"
        fi
    done

    if [ ${#stowed_packages[@]} -gt 0 ]; then
        log_success "Successfully stowed packages: ${stowed_packages[*]}"
    else
        log_error "No packages were stowed successfully"
        return 1
    fi
}

# Test installation
test_installation() {
    log_step "Testing Installation"

    local errors=0

    # Test zsh syntax
    if zsh -n "$HOME/.zshrc" >/dev/null 2>&1; then
        log_success "Zsh configuration syntax is valid"
    else
        log_error "Zsh configuration has syntax errors"
        ((errors++))
    fi

    # Test function files
    if bash -n "$HOME/.functions.sh" >/dev/null 2>&1; then
        log_success "Functions file syntax is valid"
    else
        log_error "Functions file has syntax errors"
        ((errors++))
    fi

    # Test aliases file
    if bash -n "$HOME/.aliases.sh" >/dev/null 2>&1; then
        log_success "Aliases file syntax is valid"
    else
        log_error "Aliases file has syntax errors"
        ((errors++))
    fi

    # Test command availability
    local commands=("oh-my-posh" "fzf" "zoxide")
    for cmd in "${commands[@]}"; do
        if command_exists "$cmd"; then
            log_success "$cmd is available"
        else
            log_warning "$cmd is not available (may need to restart terminal)"
        fi
    done

    if [ $errors -eq 0 ]; then
        log_success "Installation test passed!"
    else
        log_error "Installation test found $errors errors"
        return 1
    fi
}

# Print final instructions
print_final_instructions() {
    echo -e "\n${GREEN}🎉 Dotfiles installation completed!${NC}\n"

    echo -e "${CYAN}Next steps:${NC}"
    echo -e "1. ${YELLOW}Restart your terminal${NC} or run: ${BLUE}source ~/.zshrc${NC}"
    echo -e "2. ${YELLOW}Configure your terminal font${NC} to use 'FiraCode Nerd Font'"
    echo -e "3. ${YELLOW}Test the setup${NC} with: ${BLUE}take test-directory${NC}"
    echo -e "4. ${YELLOW}Explore available aliases${NC} with: ${BLUE}alias | grep git${NC}"

    echo -e "\n${CYAN}Terminal font configuration:${NC}"
    echo -e "• ${YELLOW}Warp:${NC} Settings → Appearance → Text → Font"
    echo -e "• ${YELLOW}iTerm2:${NC} Preferences → Profiles → Text → Font"
    echo -e "• ${YELLOW}Terminal.app:${NC} Preferences → Profiles → Text → Font"

    echo -e "\n${CYAN}Useful commands to try:${NC}"
    echo -e "• ${BLUE}show_tools${NC} - Discover all modern CLI tools with examples"
    echo -e "• ${BLUE}lg${NC} - Open lazygit for interactive git operations"
    echo -e "• ${BLUE}ll${NC} - Enhanced file listing with icons and git status"
    echo -e "• ${BLUE}take my-project${NC} - Create and enter directory"
    echo -e "• ${BLUE}kill_by_port 3000${NC} - Kill processes on port 3000"
    echo -e "• ${BLUE}alias_search docker${NC} - Find all Docker-related aliases"

    echo -e "\n${CYAN}For help and troubleshooting:${NC}"
    echo -e "• Check the README.md file"
    echo -e "• Open an issue on GitHub"

    echo -e "\n${GREEN}Enjoy your enhanced development environment! 🚀${NC}"
}

# Main execution
main() {
    clear
    echo -e "${PURPLE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║        Thisaru's Dotfiles Installer      ║${NC}"
    echo -e "${PURPLE}║    Enhanced Development Environment      ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════╝${NC}\n"

    # Verify we're in the right directory
    if [ ! -f "$(pwd)/init.sh" ] || [ ! -f "$(pwd)/zsh/.zshrc" ]; then
        log_error "Please run this script from the dotfiles directory"
        log_info "Usage: cd ~/.dotfiles && ./init.sh"
        exit 1
    fi

    # Update DOTFILES_DIR to current directory
    DOTFILES_DIR="$(pwd)"

    log_info "Starting installation from: $DOTFILES_DIR"
    log_info "This script will set up your complete development environment"

    if ! confirm "Continue with installation?"; then
        log_info "Installation cancelled"
        exit 0
    fi

    # Run installation steps
    check_macos
    check_xcode_tools
    setup_homebrew
    install_stow
    install_core_dependencies
    install_dev_tools
    install_terminal_apps
    install_fonts
    install_zinit
    setup_environment
    backup_existing_files
    stow_packages
    setup_git_config
    test_installation

    print_final_instructions
}

# Run main function
main "$@"
