#!/bin/bash

# Dotfiles Initialization Script
# This script sets up the complete development environment with dependency checking

set -e # Exit on any error

# Ensure script is run from ~/.dotfiles directory
basename_dir="$(basename "$PWD")"
if [[ ! "$basename_dir" == "dotfiles" && ! "$basename_dir" == ".dotfiles" ]]; then
    echo "❌ This script must be run from your dotfiles directory"
    echo "Please run:"
    echo "  cd ~/dotfiles  # or ~/.dotfiles"
    echo "  ./init.sh"
    exit 1
fi

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

DOTFILES_DIR="$(pwd)"

# Logging functions
log_success() {
    echo -e "  ${GREEN}${CHECK}  $1${NC}"
}

log_warning() {
    echo -e "  ${YELLOW}${WARNING}  $1${NC}"
}

log_info() {
    echo -e "  ${CYAN}${INFO}  $1${NC}"
}

log_error() {
    echo -e "  ${RED}${CROSS}  $1${NC}"
}

log_step() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════${NC}"
    echo -e " ${BLUE}${ARROW}  $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════${NC}"
    echo ""
}

# Enhanced user confirmation function with single key press
confirm() {
    while true; do
        echo ""
        echo -en "  ${YELLOW}$1 (y/n/q): ${NC}"
        read -r -n 1 -s key # Read single character without echo
        echo                # Print newline after keypress

        case "$key" in
            [Yy])
                echo -e "  ${GREEN}→ Yes${NC}"
                echo ""
                return 0
                ;;
            [Nn])
                echo -e "  ${RED}→ No${NC}"
                echo ""
                return 1
                ;;
            [Qq])
                echo -e "  ${YELLOW}→ Quit${NC}"
                echo ""
                log_info "Installation cancelled by user"
                exit 0
                ;;
            *)
                echo -e "  ${YELLOW}${WARNING} Please press 'y' for yes, 'n' for no, or 'q' to quit.${NC}"
                ;;
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
    else
        log_warning "GNU Stow not found"
        if confirm "Install GNU Stow? (Required for dotfiles management)"; then
            log_info "Installing GNU Stow..."
            brew install stow
            log_success "GNU Stow installed successfully"
        else
            log_error "GNU Stow is required for this dotfiles setup. Exiting."
            exit 1
        fi
    fi

    # Install jq for JSON parsing (used for dynamic package reading)
    if command_exists jq; then
        log_success "jq already installed: $(jq --version 2>/dev/null || echo 'unknown version')"
    else
        log_warning "jq not found (needed for dynamic package configuration)"
        if confirm "Install jq? (Enables dynamic package reading from packages.json)"; then
            log_info "Installing jq..."
            brew install jq
            log_success "jq installed successfully"
        else
            log_warning "jq not installed - will use fallback package lists"
        fi
    fi
}

# Install core dependencies
install_core_dependencies() {
    log_step "Installing Core Dependencies"

    # Read packages from packages.json if available, fallback to hardcoded list
    local packages=()
    if command_exists jq && [ -f "$DOTFILES_DIR/packages.json" ]; then
        # Extract enabled packages from core and security categories
        log_info "Reading package list from packages.json..."
        local core_packages_list security_packages_list
        core_packages_list="$(jq -r '.categories.core.packages | to_entries[] | select(.value.enabled == true) | .key' "$DOTFILES_DIR/packages.json" 2>/dev/null || true)"
        security_packages_list="$(jq -r '.categories.security.packages | to_entries[] | select(.value.enabled == true) | .key' "$DOTFILES_DIR/packages.json" 2>/dev/null || true)"

        # Build packages array manually for maximum compatibility
        local pkg
        for pkg in $core_packages_list $security_packages_list; do
            if [ -n "$pkg" ]; then
                packages[${#packages[@]}]="$pkg"
            fi
        done
    else
        # Fallback to hardcoded list if jq or packages.json not available
        log_warning "Using fallback package list (jq or packages.json not found)"
        packages=("oh-my-posh" "fzf" "zoxide" "tree" "bat" "eza" "ripgrep" "fd" "git-delta" "lazygit" "tmux" "htop" "direnv" "atuin" "gh" "stow" "sops" "age")
    fi
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
# Enhanced tool installation with individual confirmation and legacy detection
install_terminal_apps() {
    log_step "Installing Terminal Applications & Development Tools (Optional)"

    # Define tools with their detection and installation info
    # Using arrays instead of associative arrays for better compatibility
    local tools_list=(
        "cursor|Code Editor|/Applications/Cursor.app|--cask cursor|Legacy: installer download"
        "visual-studio-code|Code Editor|/Applications/Visual Studio Code.app|--cask visual-studio-code|Legacy: installer download"
        "warp|Terminal|/Applications/Warp.app|--cask warp|Legacy: none"
        "iterm2|Terminal|/Applications/iTerm.app|--cask iterm2|Legacy: none"
        "github-cli|Development|gh command|gh|Legacy: none"
        "postgresql|Database|postgres command|postgresql@16|Legacy: installer or postgres.app"
        "redis|Database|redis-server command|redis|Legacy: manual install"
        "aws-vault|AWS Tool|aws-vault command|aws-vault|Legacy: manual install"
    )

    # Check each tool individually (compatible approach)
    echo ""
    echo "📋 Tool Installation Status:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local -a to_install
    local tool_info

    for tool_info in "${tools_list[@]}"; do
        IFS='|' read -r tool category app_path install_cmd legacy_info <<<"$tool_info"
        local installed=false

        # Check if tool is installed
        case "$tool" in
            "cursor" | "visual-studio-code" | "warp" | "iterm2")
                if [ -d "$app_path" ]; then
                    installed=true
                # Check for legacy installations
                elif [ "$tool" = "visual-studio-code" ] && command -v code >/dev/null 2>&1; then
                    installed=true
                    legacy_info="Legacy: command 'code' found"
                fi
                ;;
            *)
                local cmd_name
                case "$tool" in
                    "github-cli") cmd_name="gh" ;;
                    "postgresql") cmd_name="postgres" ;;
                    "redis") cmd_name="redis-server" ;;
                    "aws-vault") cmd_name="aws-vault" ;;
                esac
                if command -v "$cmd_name" >/dev/null 2>&1; then
                    installed=true
                    # Check if it's a legacy installation (not via Homebrew)
                    # Extract package name from install command (remove --cask and other flags)
                    local brew_pkg_name="${install_cmd##* }" # Get last word (package name)
                    if ! brew list "$brew_pkg_name" >/dev/null 2>&1; then
                        legacy_info="Legacy: $cmd_name command found (non-Homebrew)"
                    fi
                fi
                ;;
        esac

        # Display status and ask for installation
        if [ "$installed" = "true" ]; then
            log_success "$tool already installed ($legacy_info)"
        else
            log_info "$tool not found - $category tool"
            if confirm "Install $tool?"; then
                to_install+=("$tool|$install_cmd")
            else
                log_info "Skipped $tool installation"
            fi
        fi
    done

    # Install selected tools
    if [ ${#to_install[@]} -gt 0 ]; then
        log_info "Installing selected tools..."

        for tool_install in "${to_install[@]}"; do
            IFS='|' read -r tool install_cmd <<<"$tool_install"
            log_info "Installing $tool..."

            # Special handling for Docker Desktop detection
            if [ "$tool" = "docker" ]; then
                # Enhanced Docker vs Rancher Desktop detection
                local has_docker_desktop=false
                local has_rancher_desktop=false

                # Check for Docker Desktop
                if [ -d "/Applications/Docker.app" ]; then
                    has_docker_desktop=true
                fi

                # Check for Rancher Desktop
                if [ -d "/Applications/Rancher Desktop.app" ]; then
                    has_rancher_desktop=true
                fi

                if [ "$has_rancher_desktop" = "true" ] && [ "$has_docker_desktop" = "false" ]; then
                    log_success "Rancher Desktop detected (provides Docker functionality)"
                    continue
                fi
            fi

            if brew install "$install_cmd"; then
                log_success "$tool installed successfully"
            else
                log_warning "Failed to install $tool - you may need to install it manually"
            fi
        done
    else
        log_success "All desired tools are already installed or skipped"
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
    local backup_dir
    backup_dir="$HOME/.dotfiles_backup_$(date +%Y%m%d_%H%M%S)"
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

# Setup encrypted secret management with SOPS and age
setup_secret_management() {
    log_step "Setting up Encrypted Secret Management"

    # Check if SOPS is installed
    if ! command -v sops >/dev/null 2>&1; then
        log_error "SOPS is not installed. Please install it with: brew install sops"
        return 1
    fi

    # Setup age encryption
    local age_dir="$HOME/.config/sops/age"
    local age_key_file="$age_dir/keys.txt"
    local sops_config="$HOME/.sops.yaml"

    # Create age directory if it doesn't exist
    if [ ! -d "$age_dir" ]; then
        log_info "Creating age directory..."
        mkdir -p "$age_dir"
    fi

    # Generate age key if it doesn't exist
    if [ ! -f "$age_key_file" ]; then
        if command -v age-keygen >/dev/null 2>&1; then
            log_info "Generating age encryption key..."
            age-keygen -o "$age_key_file"
            chmod 600 "$age_key_file"
            log_success "Age encryption key generated"
        else
            log_error "age-keygen not found. Please install age: brew install age"
            return 1
        fi
    else
        log_success "Age encryption key already exists"
    fi

    # Get the public key for SOPS config
    local public_key
    public_key=$(grep "^# public key:" "$age_key_file" | cut -d' ' -f4)
    if [ -z "$public_key" ]; then
        log_error "Could not extract public key from age key file"
        return 1
    fi

    # Create .sops.yaml configuration
    if [ ! -f "$sops_config" ]; then
        log_info "Creating sops configuration..."
        cat >"$sops_config" <<EOF
creation_rules:
  - path_regex: \.env$
    age: $public_key
  - path_regex: \.env\.sops$
    age: $public_key
  - path_regex: \.secrets\.sops\.ya?ml$
    age: $public_key
EOF
        log_success "Created .sops.yaml configuration"
    else
        log_success "sops configuration already exists"
    fi

    # Handle .env file (single file approach)
    local env_file="$HOME/.env"

    if [ -f "$env_file" ]; then
        # Check if file is already encrypted
        if head -1 "$env_file" | grep -q "^#ENC\["; then
            log_success ".env file is already encrypted"
        else
            log_info "Found plaintext .env file"

            # Check if the file uses export format
            if grep -q "^export " "$env_file"; then
                log_info "Your .env file uses shell 'export KEY=value' format - perfect for sourcing!"
            fi

            if confirm "Encrypt .env file in-place with sops?"; then
                log_info "Creating backup and encrypting .env file..."

                # Create backup for safety
                cp "$env_file" "$env_file.backup"
                log_info "Created backup: $env_file.backup"

                # Encrypt in-place
                if sops --config "$HOME/.sops.yaml" --encrypt --in-place "$env_file"; then
                    # Verify encryption worked
                    if head -1 "$env_file" | grep -q "^#ENC\["; then
                        log_success "Successfully encrypted .env file in-place"
                        log_info "Backup saved as $env_file.backup"
                    else
                        log_error "Encryption failed - restoring from backup"
                        cp "$env_file.backup" "$env_file"
                        return 1
                    fi
                else
                    log_error "Failed to encrypt .env file - restoring from backup"
                    cp "$env_file.backup" "$env_file"
                    return 1
                fi
            fi
        fi
    else
        if confirm "Create new .env file from template?"; then
            log_info "Creating .env file from template..."
            cp "$DOTFILES_DIR/zsh/.env.example" "$env_file"

            log_info "Opening .env file for editing..."
            if command -v code >/dev/null 2>&1; then
                code "$env_file"
            elif command -v vim >/dev/null 2>&1; then
                vim "$env_file"
            else
                nano "$env_file"
            fi

            if confirm "Encrypt the .env file now?"; then
                log_info "Encrypting .env file..."
                if sops --config "$HOME/.sops.yaml" --encrypt --in-place "$env_file"; then
                    if head -1 "$env_file" | grep -q "^#ENC\["; then
                        log_success "Successfully encrypted new .env file"
                    else
                        log_error "Encryption failed"
                        return 1
                    fi
                else
                    log_error "Failed to encrypt .env file"
                    return 1
                fi
            fi
        fi
    fi

    log_success "Secret management setup complete"
    log_info "Note: Your .zshrc is configured to automatically handle encrypted .env files"

    # Add .env to .gitignore if not already there
    local gitignore_file="$DOTFILES_DIR/.gitignore"
    if [ -f "$gitignore_file" ] && ! grep -q "\.env$" "$gitignore_file"; then
        echo ".env" >>"$gitignore_file"
        log_success "Added .env to .gitignore"
    fi

    log_info "Secret Management Commands:"
    log_info "  • Edit secrets: edit_secrets"
    log_info "  • View secrets: sops -d ~/.env"
    log_info "  • Direct edit: sops ~/.env"
}

# Use stow to create symlinks
stow_packages() {
    log_step "Using Stow to manage dotfiles"

    local packages=("zsh" "vim" "config" "git" "tmux" "direnv")
    local stowed_packages=()

    for package in "${packages[@]}"; do
        if [ -d "$DOTFILES_DIR/$package" ]; then
            log_info "Stowing $package package..."

            # Use stow to create symlinks (exclude .env files for zsh package)
            local stow_args=(-t "$HOME" "$package")
            if [ "$package" = "zsh" ]; then
                # Exclude .env files from stowing since they're managed by secret management
                stow_args+=(--ignore='.env$' --ignore='.env.example$')
            fi

            if stow "${stow_args[@]}" 2>/dev/null; then
                log_success "Stowed $package package"
                stowed_packages+=("$package")
            else
                log_warning "Failed to stow $package (may have conflicts)"

                # Try to restow (useful if already stowed)
                if stow -R "${stow_args[@]}" 2>/dev/null; then
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

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          🎉 Installation Complete! 🎉     ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Enjoy your enhanced development environment! 🚀${NC}"
    echo ""
}

# Main execution
main() {
    if [ "$1" == "--dry-run" ]; then
        echo "Dry run successful"
        exit 0
    fi

    clear
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║        Thisaru's Dotfiles Installer      ║${NC}"
    echo -e "${PURPLE}║    Enhanced Development Environment      ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════╝${NC}"
    echo ""

    # Verify we're in the right directory
    if [ ! -f "$(pwd)/init.sh" ] || [ ! -f "$(pwd)/zsh/.zshrc" ]; then
        log_error "Please run this script from the dotfiles directory"
        log_info "Usage: cd ~/dotfiles && ./init.sh  # or ~/.dotfiles"
        exit 1
    fi

    log_info "Starting installation from: $DOTFILES_DIR"
    log_info "This script will set up your complete development environment"
    echo -e "${CYAN}${INFO} During installation, press 'y' for yes, 'n' for no, or 'q' to quit (no Enter needed)${NC}"

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
    setup_secret_management
    backup_existing_files
    stow_packages
    setup_git_config
    test_installation

    print_final_instructions
}

# Run main function
main "$@"
