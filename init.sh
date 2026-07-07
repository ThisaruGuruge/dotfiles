#!/bin/bash

set -e

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
        read -r -n 1 -s key </dev/tty # Read single character from terminal
        echo                          # Print newline after keypress

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
            log_success "Homebrew installed successfully"
            log_info "Homebrew has been added to PATH for this installation session"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
            log_success "Homebrew installed successfully"
            log_info "Homebrew has been added to PATH for this installation session"
        else
            log_warning "Homebrew installed but could not be found in expected locations"
            log_info "You may need to manually add Homebrew to your PATH"
            log_info "Run: eval \"\$(/opt/homebrew/bin/brew shellenv)\" or check Homebrew docs"
        fi

        log_info "Note: Your .zshrc is already configured to load Homebrew on shell startup"
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
}

# Install core dependencies
install_core_dependencies() {
    log_step "Installing Core Dependencies"

    if [ -f "$DOTFILES_DIR/Brewfile" ]; then
        log_info "Installing dependencies from Brewfile..."
        if brew bundle --file="$DOTFILES_DIR/Brewfile"; then
            log_success "Core dependencies installed"
        else
            log_warning "Some dependencies failed to install"
        fi
    else
        log_error "Brewfile not found at $DOTFILES_DIR/Brewfile"
        return 1
    fi
}

# Install development tools
install_dev_tools() {
    log_step "Installing Development Tools (Optional)"

    # Helper function to get description
    get_tool_description() {
        case "$1" in
            pyenv) echo "Python version manager" ;;
            rbenv) echo "Ruby version manager" ;;
            nvm) echo "Node.js version manager" ;;
            *) echo "$1" ;;
        esac
    }

    # Check and install each tool individually
    for tool in pyenv rbenv nvm; do
        if brew list "$tool" >/dev/null 2>&1; then
            log_success "$tool already installed"
        else
            local description
            description=$(get_tool_description "$tool")
            if confirm "Install $tool? ($description)"; then
                log_info "Installing $tool..."
                if brew install "$tool"; then
                    log_success "$tool installed"
                else
                    log_warning "Failed to install $tool"
                fi
            else
                log_info "Skipped $tool"
            fi
        fi
    done

    # Install SDKMAN
    install_sdkman

    # Install Ballerina
    install_ballerina
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

# Install Ballerina
install_ballerina() {
    log_step "Installing Ballerina (Cloud-Native Programming Language)"

    # Check if Ballerina is already installed
    if command -v bal >/dev/null 2>&1; then
        local bal_version
        bal_version=$(bal version 2>&1 | head -n 1)
        log_success "Ballerina already installed: $bal_version"
        return 0
    fi

    if confirm "Install Ballerina programming language?"; then
        log_info "Installing Ballerina via Homebrew..."
        if brew install ballerina; then
            log_success "Ballerina installed successfully"

            # Verify installation
            if command -v bal >/dev/null 2>&1; then
                local bal_version
                bal_version=$(bal version 2>&1 | head -n 1)
                log_success "Ballerina version: $bal_version"
            else
                log_warning "Ballerina installed but not found in PATH. You may need to restart your terminal."
            fi
        else
            log_error "Ballerina installation failed"
        fi
    else
        log_warning "Skipped Ballerina installation"
    fi
}

# Install terminal applications
# Enhanced tool installation with individual confirmation and legacy detection
install_terminal_apps() {
    log_step "Installing Optional Applications & Tools"

    if [ -d "$DOTFILES_DIR/packages" ]; then
        echo "Optional package categories found in $DOTFILES_DIR/packages/"

        for brewfile in "$DOTFILES_DIR/packages/"*.brewfile; do
            [ -e "$brewfile" ] || continue

            local category_name
            category_name=$(basename "$brewfile" .brewfile)

            echo ""
            if confirm "Review $category_name packages?"; then
                log_info "Reviewing $category_name packages..."

                # Read brewfile and parse packages
                while IFS= read -r line; do
                    # Skip comments and empty lines
                    [[ "$line" =~ ^#.*$ ]] && continue
                    [[ -z "$line" ]] && continue

                    local package_type=""
                    local package_name=""
                    local package_comment=""

                    # Extract package info
                    if [[ "$line" =~ ^brew[[:space:]]+\"([^\"]+)\"[[:space:]]*#?[[:space:]]*(.*)?$ ]]; then
                        package_type="brew"
                        package_name="${BASH_REMATCH[1]}"
                        package_comment="${BASH_REMATCH[2]}"
                    elif [[ "$line" =~ ^cask[[:space:]]+\"([^\"]+)\"[[:space:]]*#?[[:space:]]*(.*)?$ ]]; then
                        package_type="cask"
                        package_name="${BASH_REMATCH[1]}"
                        package_comment="${BASH_REMATCH[2]}"
                    elif [[ "$line" =~ ^tap[[:space:]]+\"([^\"]+)\" ]]; then
                        # Auto-install taps without asking
                        package_name="${BASH_REMATCH[1]}"
                        if ! brew tap | grep -q "^${package_name}$"; then
                            log_info "Adding tap: $package_name"
                            brew tap "$package_name" 2>/dev/null || log_warning "Failed to add tap $package_name"
                        fi
                        continue
                    else
                        continue
                    fi

                    # Check if already installed
                    local already_installed=false
                    local install_status=""

                    if [ "$package_type" = "cask" ]; then
                        if brew list --cask "$package_name" >/dev/null 2>&1; then
                            already_installed=true
                            install_status="via Homebrew"
                        else
                            # Check if app exists in /Applications (manual install)
                            local app_name
                            # Convert package name to app name (e.g., postman -> Postman.app)
                            app_name=$(echo "$package_name" | sed 's/-/ /g; s/\b\(.\)/\u\1/g; s/ //g')
                            if [ -d "/Applications/${app_name}.app" ]; then
                                already_installed=true
                                install_status="manually installed"
                            fi
                        fi
                    else
                        if brew list "$package_name" >/dev/null 2>&1; then
                            already_installed=true
                            install_status="via Homebrew"
                        fi
                    fi

                    if [ "$already_installed" = true ]; then
                        echo -e "  ${GREEN}✓${NC} $package_name ${CYAN}($install_status)${NC}"
                    else
                        local description="$package_name"
                        [ -n "$package_comment" ] && description="$package_name - $package_comment"

                        if confirm "  Install $description?"; then
                            if [ "$package_type" = "cask" ]; then
                                if brew install --cask "$package_name" 2>&1 | tee /dev/tty | grep -q "It seems there is already an App"; then
                                    log_warning "$package_name appears to be manually installed - skipping Homebrew install"
                                else
                                    log_success "Installed $package_name"
                                fi
                            else
                                if brew install "$package_name"; then
                                    log_success "Installed $package_name"
                                else
                                    log_warning "Failed to install $package_name"
                                fi
                            fi
                        else
                            log_info "Skipped $package_name"
                        fi
                    fi
                done <"$brewfile"

                log_success "Finished reviewing $category_name"
            else
                log_info "Skipped $category_name category"
            fi
        done
    else
        log_warning "No optional packages directory found"
    fi
}

# Install Nerd Fonts
install_fonts() {
    log_step "Installing Nerd Fonts"

    # Check if FiraCode Nerd Font is installed (check for any variant)
    if ls "$HOME/Library/Fonts/FiraCodeNerdFont"*.ttf >/dev/null 2>&1 ||
        brew list --cask font-fira-code-nerd-font >/dev/null 2>&1; then
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

# Handle stow conflicts for a specific file
handle_stow_conflict() {
    local conflict_file="$1"
    local package="$2"

    echo ""
    log_warning "Conflict detected: $conflict_file"
    log_info "This file already exists in your home directory"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo -e "  ${YELLOW}b${NC}) Backup existing file and replace with stow symlink"
    echo -e "  ${YELLOW}k${NC}) Keep existing file (skip stowing this file)"
    echo -e "  ${YELLOW}s${NC}) Show diff between existing and dotfiles version"
    echo -e "  ${YELLOW}q${NC}) Quit installation"
    echo ""

    while true; do
        echo -en "  ${YELLOW}Choose action (b/k/s/q): ${NC}"
        read -r -n 1 choice
        echo

        case "$choice" in
            [Bb])
                local backup_dir
                backup_dir="$HOME/.dotfiles_backup_$(date +%Y%m%d_%H%M%S)"
                mkdir -p "$backup_dir"
                mv "$conflict_file" "$backup_dir/"
                log_success "Backed up to: $backup_dir/$(basename "$conflict_file")"
                return 0
                ;;
            [Kk])
                log_info "Keeping existing file: $conflict_file"
                return 1
                ;;
            [Ss])
                local dotfile_path="$DOTFILES_DIR/$package/${conflict_file#"$HOME"/}"
                if [ -f "$dotfile_path" ]; then
                    echo -e "\n${CYAN}=== Diff: Existing (left) vs Dotfiles (right) ===${NC}"
                    if command -v delta >/dev/null 2>&1; then
                        diff -u "$conflict_file" "$dotfile_path" | delta
                    else
                        diff -u "$conflict_file" "$dotfile_path" || true
                    fi
                    echo ""
                else
                    log_warning "Could not find dotfile at: $dotfile_path"
                fi
                ;;
            [Qq])
                log_info "Installation cancelled by user"
                exit 0
                ;;
            *)
                echo -e "  ${YELLOW}${WARNING} Please press 'b', 'k', 's', or 'q'${NC}"
                ;;
        esac
    done
}

# Use stow to create symlinks with conflict resolution
stow_packages() {
    log_step "Using Stow to manage dotfiles"

    local packages=("zsh" "bash" "bin" "config" "nvim" "git" "tmux" "direnv" "ssh" "atuin" "gh" "htop" "lazygit" "ripgrep" "wezterm" "yazi" "flutter" "noto" "claude")
    local stowed_packages=()
    local skipped_files=()

    for package in "${packages[@]}"; do
        if [ -d "$DOTFILES_DIR/$package" ]; then
            log_info "Processing $package package..."

            # Use stow to create symlinks
            # Note: Exclusions are managed via .stow-local-ignore files in each package
            local stow_args=(--no-folding -t "$HOME" "$package")

            # First, try a dry-run to detect conflicts
            local stow_output
            stow_output=$(stow -n "${stow_args[@]}" 2>&1)
            local stow_status=$?

            if [ $stow_status -eq 0 ]; then
                # No conflicts, proceed with stowing
                if stow "${stow_args[@]}" 2>/dev/null; then
                    log_success "Stowed $package package"
                    stowed_packages+=("$package")
                else
                    log_error "Unexpected error stowing $package package"
                fi
            else
                # Check if it's already stowed
                if echo "$stow_output" | grep -q "already stowed"; then
                    log_success "$package package already stowed"
                    stowed_packages+=("$package")
                # Check for conflicts
                elif echo "$stow_output" | grep -q "existing target"; then
                    log_warning "Conflicts detected in $package package"

                    # Extract conflicting files from stow output
                    local conflicts
                    conflicts=$(echo "$stow_output" | grep "existing target" | sed 's/.*existing target is //g' | sed 's/ .*//g')

                    # Ask user how to handle conflicts
                    echo ""
                    log_info "Found conflicts in $package package. How would you like to proceed?"
                    echo ""
                    echo -e "${CYAN}Options:${NC}"
                    echo -e "  ${YELLOW}a${NC}) Backup ALL conflicting files and replace with stow symlinks"
                    echo -e "  ${YELLOW}i${NC}) Handle each conflict individually"
                    echo -e "  ${YELLOW}k${NC}) Keep all existing files (skip this package)"
                    echo -e "  ${YELLOW}q${NC}) Quit installation"
                    echo ""

                    while true; do
                        echo -en "  ${YELLOW}Choose action (a/i/k/q): ${NC}"
                        read -r -n 1 bulk_choice
                        echo

                        case "$bulk_choice" in
                            [Aa])
                                # Backup all conflicts
                                local backup_dir
                                backup_dir="$HOME/.dotfiles_backup_$(date +%Y%m%d_%H%M%S)"
                                mkdir -p "$backup_dir"
                                log_info "Creating backup directory: $backup_dir"

                                for conflict in $conflicts; do
                                    if [ -f "$conflict" ] || [ -d "$conflict" ]; then
                                        mv "$conflict" "$backup_dir/"
                                        log_success "Backed up: $(basename "$conflict")"
                                    fi
                                done

                                # Now stow should work
                                if stow "${stow_args[@]}" 2>/dev/null; then
                                    log_success "Stowed $package package"
                                    stowed_packages+=("$package")
                                else
                                    log_error "Failed to stow $package after backup"
                                fi
                                break
                                ;;
                            [Ii])
                                # Handle individually
                                local can_stow=true
                                for conflict in $conflicts; do
                                    if ! handle_stow_conflict "$conflict" "$package"; then
                                        can_stow=false
                                        skipped_files+=("$conflict")
                                    fi
                                done

                                if [ "$can_stow" = true ]; then
                                    if stow "${stow_args[@]}" 2>/dev/null; then
                                        log_success "Stowed $package package"
                                        stowed_packages+=("$package")
                                    else
                                        log_warning "Some files in $package were skipped"
                                    fi
                                else
                                    log_warning "Skipped $package package due to conflicts"
                                fi
                                break
                                ;;
                            [Kk])
                                log_info "Skipped $package package"
                                break
                                ;;
                            [Qq])
                                log_info "Installation cancelled by user"
                                exit 0
                                ;;
                            *)
                                echo -e "  ${YELLOW}${WARNING} Please press 'a', 'i', 'k', or 'q'${NC}"
                                ;;
                        esac
                    done
                else
                    # Some other error, try restowing
                    if stow -R "${stow_args[@]}" 2>/dev/null; then
                        log_success "Re-stowed $package package"
                        stowed_packages+=("$package")
                    else
                        log_error "Could not stow $package package"
                    fi
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

    if [ ${#skipped_files[@]} -gt 0 ]; then
        echo ""
        log_info "Note: Some files were skipped and kept as-is:"
        for skipped in "${skipped_files[@]}"; do
            log_info "  - $skipped"
        done
    fi

    # Stow bin scripts into ~/bin (separate target from $HOME)
    log_info "Stowing bin scripts into ~/bin..."
    mkdir -p "$HOME/bin"
    if stow --no-folding -t "$HOME/bin" bin 2>/dev/null; then
        log_success "Stowed bin scripts into ~/bin"
    else
        log_warning "Could not stow bin scripts (may already be stowed)"
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
    local func_errors=0
    if [ -d "$HOME/.functions.d" ]; then
        for func_file in "$HOME/.functions.d"/*.zsh; do
            if [ -f "$func_file" ] && ! zsh -n "$func_file" >/dev/null 2>&1; then
                log_error "Syntax error in $(basename "$func_file")"
                ((func_errors++))
            fi
        done
        if [ "$func_errors" -eq 0 ]; then
            log_success "Function files syntax is valid"
        else
            ((errors += func_errors))
        fi
    else
        log_warning "Functions directory ~/.functions.d not found"
    fi

    # Test aliases file
    if zsh -n "$HOME/.aliases.sh" >/dev/null 2>&1; then
        log_success "Aliases file syntax is valid"
    else
        log_error "Aliases file has syntax errors"
        ((errors++))
    fi

    # Test command availability
    local commands=("fzf" "zoxide" "yazi")
    for cmd in "${commands[@]}"; do
        if command_exists "$cmd"; then
            log_success "$cmd is available"
        else
            log_warning "$cmd is not available (may need to restart terminal)"
        fi
    done

    # Verify Powerlevel10k configuration
    local p10k_config="$HOME/.p10k.zsh"
    if [ -L "$p10k_config" ] || [ -f "$p10k_config" ]; then
        log_success "Powerlevel10k config found at ~/.p10k.zsh"
    else
        log_warning "Powerlevel10k config not found at ~/.p10k.zsh"
        log_info "Run 'stow --no-folding zsh' to create the symlink"
    fi

    if [ $errors -eq 0 ]; then
        log_success "Installation test passed!"
    else
        log_error "Installation test found $errors errors"
        return 1
    fi
}

# Setup Touch ID for sudo authentication
setup_touchid_sudo() {
    log_step "Setting up Touch ID for sudo"

    local sudo_local="/etc/pam.d/sudo_local"
    local pam_reattach_lib=""

    # Find pam_reattach.so (supports both Apple Silicon and Intel)
    if [[ -f "/opt/homebrew/lib/pam/pam_reattach.so" ]]; then
        pam_reattach_lib="/opt/homebrew/lib/pam/pam_reattach.so"
    elif [[ -f "/usr/local/lib/pam/pam_reattach.so" ]]; then
        pam_reattach_lib="/usr/local/lib/pam/pam_reattach.so"
    fi

    # Check if already configured
    if [[ -f "$sudo_local" ]]; then
        if grep -q "pam_tid.so" "$sudo_local"; then
            log_success "Touch ID for sudo already configured"

            # Check if pam_reattach is also configured (for tmux support)
            if [[ -n "$pam_reattach_lib" ]] && ! grep -q "pam_reattach.so" "$sudo_local"; then
                log_warning "pam_reattach not configured (Touch ID won't work inside tmux)"
                if confirm "Add pam_reattach for tmux Touch ID support?"; then
                    # Prepend pam_reattach line before pam_tid
                    sudo sed -i '' "/pam_tid.so/i\\
auth       optional       $pam_reattach_lib
" "$sudo_local"
                    log_success "Added pam_reattach for tmux support"
                fi
            fi
            return 0
        fi
    fi

    if confirm "Enable Touch ID for sudo? (Use fingerprint instead of password)"; then
        log_info "Configuring Touch ID for sudo via /etc/pam.d/sudo_local..."
        log_info "This file persists across macOS updates (unlike editing /etc/pam.d/sudo)"

        # Build the sudo_local content
        local content="# sudo_local: local config for sudo (persists across macOS updates)
# Added by dotfiles/init.sh
"

        # Add pam_reattach if available (must come before pam_tid)
        if [[ -n "$pam_reattach_lib" ]]; then
            content+="auth       optional       $pam_reattach_lib
"
            log_info "Including pam_reattach for tmux compatibility"
        else
            log_warning "pam-reattach not found - Touch ID won't work inside tmux"
            log_info "Install with: brew install pam-reattach"
        fi

        content+="auth       sufficient     pam_tid.so
"

        # Write the file (requires sudo)
        echo "$content" | sudo tee "$sudo_local" > /dev/null
        log_success "Touch ID for sudo enabled"
        log_info "You can now use your fingerprint when sudo prompts for a password"

        if [[ -n "$pam_reattach_lib" ]]; then
            log_info "Touch ID will also work inside tmux sessions"
        fi
    else
        log_info "Skipped Touch ID setup"
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
    echo -e "• ${YELLOW}WezTerm:${NC} Already configured in ~/.config/wezterm/wezterm.lua (FiraCode Nerd Font)"
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
    setup_touchid_sudo
    install_dev_tools
    install_terminal_apps
    install_fonts
    install_zinit
    setup_environment
    setup_secret_management
    backup_existing_files
    stow_packages  # Must run after backup_existing_files
    setup_git_config
    test_installation

    print_final_instructions
}

# Run main function
main "$@"
