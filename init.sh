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

# True when $1 is a sops-encrypted dotenv file. sops encrypts each value on its
# own (KEY=ENC[...]) and always writes a sops_mac= line, so the first line of an
# encrypted file can be anything; don't test it for #ENC[.
is_sops_encrypted() {
    [ -f "$1" ] && grep -q -e '^sops_mac=' -- "$1" 2>/dev/null
}

# Temp directories holding plaintext secrets; removed however the script exits
CLEANUP_DIRS=()
cleanup_temp_dirs() {
    local dir
    for dir in "${CLEANUP_DIRS[@]}"; do
        [ -n "$dir" ] && rm -rf -- "$dir"
    done
}
trap cleanup_temp_dirs EXIT
trap 'exit 130' INT TERM HUP

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

# Install bestow (Go-based symlink manager, replaces GNU Stow)
install_bestow() {
    log_step "Installing bestow"

    if ! command_exists bestow; then
        log_warning "bestow not found"

        if ! command_exists go; then
            log_error "Go is required to install bestow (installed via Brewfile earlier in this script, or 'brew install go'). Exiting."
            exit 1
        fi

        if confirm "Install bestow? (Required for dotfiles management)"; then
            log_info "Installing bestow via 'go install'..."
            if go install github.com/redpierrot/bestow@latest; then
                log_success "bestow installed successfully"
                # Make it available for the rest of this script run, even before
                # zsh/.paths.sh (which adds $GOPATH/bin to PATH) is stowed
                local gopath_bin
                gopath_bin="$(go env GOPATH)/bin"
                export PATH="$gopath_bin:$PATH"
            else
                log_error "Failed to install bestow. Exiting."
                exit 1
            fi
        else
            log_error "bestow is required for this dotfiles setup. Exiting."
            exit 1
        fi
    else
        log_success "bestow already installed: $(bestow --version 2>&1 | head -n 1)"
    fi

    # bestow needs its own config file to run at all (source + destination
    # profile) — bootstrap it if this is a fresh machine
    local bestow_config_dir="$HOME/.config/bestow"
    mkdir -p "$bestow_config_dir"
    if [ ! -f "$bestow_config_dir/config.yaml" ]; then
        log_info "Bootstrapping bestow config (source: $DOTFILES_DIR, destination: $HOME)..."
        bestow init --source "$DOTFILES_DIR" --destination "$HOME" >/dev/null 2>&1
        log_success "bestow config created at $bestow_config_dir/config.yaml"
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
        curl -fsSL "https://get.sdkman.io" | bash

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

# Install TPM (tmux plugin manager). ~/.tmux.conf ends with
# `run '~/.tmux/plugins/tpm/tpm'`, which fails on a fresh machine until TPM is
# cloned. Pinned to a release tag, and checked against that tag's commit.
TPM_VERSION="v3.1.0"
TPM_COMMIT="7bdb7ca33c9cc6440a600202b50142f401b6fe21"

install_tpm() {
    log_step "Installing TPM (tmux Plugin Manager)"

    local tpm_dir="$HOME/.tmux/plugins/tpm"
    if [ -d "$tpm_dir" ]; then
        log_success "TPM already installed"
        return 0
    fi
    if ! command_exists tmux || ! command_exists git; then
        log_warning "tmux or git not found - skipping TPM"
        return 0
    fi
    if ! confirm "Install TPM $TPM_VERSION and the tmux plugins listed in ~/.tmux.conf?"; then
        log_info "Skipped TPM (tmux reports an error for its 'run tpm' line until it's installed)"
        return 0
    fi

    # (git warns about checking out an annotated tag; only show its output on failure)
    local clone_output
    if ! clone_output=$(git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$TPM_VERSION" \
        https://github.com/tmux-plugins/tpm "$tpm_dir" 2>&1); then
        echo "$clone_output"
        log_error "Could not clone TPM"
        return 0
    fi
    if [ "$(git -C "$tpm_dir" rev-parse HEAD 2>/dev/null)" != "$TPM_COMMIT" ]; then
        log_error "TPM $TPM_VERSION doesn't match the expected commit; removing it"
        rm -rf -- "$tpm_dir"
        return 0
    fi
    log_success "TPM $TPM_VERSION installed"

    if "$tpm_dir/bin/install_plugins" >/dev/null 2>&1; then
        log_success "tmux plugins installed"
    else
        log_warning "Could not install tmux plugins now; press prefix + I inside tmux to install them"
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

# Commits are signed with SSH (git/.config/git/config: commit.gpgSign = true,
# gpg.format = ssh), so every `git commit` fails until user.signingkey points
# at a key that exists. Warn about that, and offer to create the key the
# template expects.
check_git_signing() {
    log_step "Checking Git commit signing"

    local signing_key_file="$HOME/.ssh/id_ed25519_signing"
    local signing_key key_path
    signing_key=$(cd "$HOME" && git config --get user.signingkey 2>/dev/null) || signing_key=""

    if [ -z "$signing_key" ]; then
        log_warning "Commit signing is on but user.signingkey isn't set - every git commit will fail"
        log_info "Set it in ~/.gitconfig.local (see git/.gitconfig.local.example), e.g."
        log_info "  signingkey = ~/.ssh/id_ed25519_signing.pub"
        return 0
    fi

    # A literal "key::ssh-..." value needs no file
    case "$signing_key" in
        key::*)
            log_success "Commit signing key configured (literal key)"
            return 0
            ;;
    esac

    key_path="${signing_key/#\~/$HOME}"
    if [ -f "$key_path" ]; then
        log_success "Commit signing key found: $signing_key"
        return 0
    fi

    log_warning "user.signingkey is $signing_key, which doesn't exist - every git commit will fail"
    if [ "$key_path" = "$signing_key_file.pub" ] && command_exists ssh-keygen &&
        confirm "Create an SSH signing key at $signing_key_file now? (ssh-keygen asks for a passphrase)"; then
        mkdir -p "$HOME/.ssh"
        chmod 700 "$HOME/.ssh"
        if ssh-keygen -t ed25519 -f "$signing_key_file" -C "git commit signing ($(whoami)@$(hostname -s))"; then
            log_success "Created $signing_key_file"
            log_info "Add $signing_key_file.pub to GitHub (Settings > SSH and GPG keys > New SSH key > Signing key)"
            log_info "and to ~/.config/git/allowed_signers so git can verify your own signatures"
        else
            log_error "ssh-keygen failed; create the key yourself or change user.signingkey"
        fi
    else
        log_info "Create it (ssh-keygen -t ed25519 -f ${key_path%.pub}) or point user.signingkey at an existing key"
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

# Write ~/.sops.yaml for this machine from bash/.sops.yaml.example. The file
# names the age recipient that new secrets are encrypted to, so it is per
# machine: it is not tracked in the repo and not stowed.
setup_sops_config() {
    local recipient="$1"
    local sops_config="$HOME/.sops.yaml"
    local template="$DOTFILES_DIR/bash/.sops.yaml.example"

    # Older setups stowed the repo's bash/.sops.yaml (the repo owner's
    # recipient) here as a symlink
    if [ -L "$sops_config" ]; then
        log_warning "$sops_config is a symlink (to $(readlink "$sops_config")); replacing it with this machine's own config"
        rm -f "$sops_config"
    fi

    if [ -f "$sops_config" ]; then
        if grep -qF -- "$recipient" "$sops_config"; then
            log_success "$sops_config lists this machine's age key"
            return 0
        fi
        log_error "$sops_config doesn't list this machine's age key ($recipient)"
        log_info "New secrets would be encrypted to a key this machine can't decrypt."
        log_info "Add the key to ~/.sops.yaml, or delete the file and re-run ./init.sh"
        return 1
    fi

    if [ ! -f "$template" ]; then
        log_error "sops config template not found: $template"
        return 1
    fi
    log_info "Creating ~/.sops.yaml for this machine's age key..."
    if sed "s/AGE_PUBLIC_KEY/$recipient/g" "$template" >"$sops_config"; then
        log_success "Created ~/.sops.yaml"
    else
        log_error "Could not write ~/.sops.yaml"
        return 1
    fi
}

# True when encrypted dotenv $1 decrypts to the same entries as plaintext $2
# (sops drops blank lines, so those are ignored)
env_decrypts_to() {
    local decrypted
    decrypted=$(sops -d "$1" 2>/dev/null) || return 1
    [ "$(printf '%s\n' "$decrypted" | awk 'NF')" = "$(awk 'NF' "$2")" ]
}

# Encrypt plaintext dotenv $1 in place with sops config $2. The plaintext copy
# kept for safety lives in a private (umask 077) mktemp -d directory and is
# deleted afterwards. The ciphertext has to decrypt back to the original
# before it replaces the file, and again after.
encrypt_env_in_place() {
    local env_file="$1" sops_config="$2" work original encrypted
    work=$(umask 077 && mktemp -d "${TMPDIR:-/tmp}/dotfiles-env.XXXXXX") || return 1
    CLEANUP_DIRS+=("$work")
    original="$work/original.env"
    encrypted="$work/encrypted.env"

    # sops picks the dotenv format and the creation_rule from the .env name
    if ! (umask 077 && cp "$env_file" "$original" &&
        sops --config "$sops_config" --encrypt "$env_file" >"$encrypted"); then
        rm -rf -- "$work"
        return 1
    fi
    if ! is_sops_encrypted "$encrypted" || ! env_decrypts_to "$encrypted" "$original"; then
        rm -rf -- "$work"
        return 1
    fi
    if ! mv -f "$encrypted" "$env_file" || ! env_decrypts_to "$env_file" "$original"; then
        # Put the plaintext back rather than leave something unreadable
        cp "$original" "$env_file"
        rm -rf -- "$work"
        return 1
    fi
    rm -rf -- "$work"
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
    local env_file="$HOME/.env"

    # Create age directory if it doesn't exist
    if [ ! -d "$age_dir" ]; then
        log_info "Creating age directory..."
        (umask 077 && mkdir -p "$age_dir")
    fi

    # Generate age key if it doesn't exist
    if [ ! -f "$age_key_file" ]; then
        if command -v age-keygen >/dev/null 2>&1; then
            log_info "Generating age encryption key..."
            (umask 077 && age-keygen -o "$age_key_file")
            chmod 600 "$age_key_file"
            log_success "Age encryption key generated"
            log_warning "Back up $age_key_file somewhere safe - without it ~/.env can't be decrypted"
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
    if ! [[ "$public_key" =~ ^age1[a-z0-9]+$ ]]; then
        log_error "Could not extract a public key from $age_key_file"
        return 1
    fi
    export SOPS_AGE_KEY_FILE="$age_key_file"

    setup_sops_config "$public_key" || return 1

    # Handle ~/.env (single file approach)
    if [ -f "$env_file" ]; then
        if is_sops_encrypted "$env_file"; then
            if sops -d "$env_file" >/dev/null 2>&1; then
                log_success "$env_file is encrypted and decrypts with this machine's key"
            else
                log_warning "$env_file is encrypted, but this machine's age key can't decrypt it"
                log_info "Copy the age key it was encrypted for to $age_key_file, or recreate ~/.env with edit_secrets"
            fi
        else
            log_warning "Found a plaintext ~/.env"
            if confirm "Encrypt ~/.env in place with sops?"; then
                if encrypt_env_in_place "$env_file" "$sops_config"; then
                    log_success "Encrypted ~/.env (verified it decrypts back to the original; no plaintext copy kept)"
                else
                    log_error "Encryption failed or didn't verify; ~/.env was left as it was (plaintext)"
                    return 1
                fi
            else
                log_info "$env_file stays plaintext; run edit_secrets later to encrypt it"
            fi
        fi
    else
        if confirm "Create an encrypted ~/.env now? (opens your editor via edit_secrets)"; then
            # edit_secrets keeps the plaintext in a private temp dir and only
            # writes ~/.env once the ciphertext verifies
            if ! zsh -c 'source "$1" && edit_secrets' _ "$DOTFILES_DIR/zsh/.functions.d/06-dotfiles.zsh" </dev/tty; then
                log_warning "edit_secrets didn't finish; run it later to create ~/.env"
            fi
        else
            log_info "Skipped. Run edit_secrets later (zsh/.env.example lists the expected keys)"
        fi
    fi

    log_success "Secret management setup complete"
    log_info "Note: Your .zshrc is configured to automatically handle encrypted .env files"

    log_info "Secret Management Commands:"
    log_info "  • Edit secrets: edit_secrets"
    log_info "  • View secrets: sops -d ~/.env"
    log_info "  • Direct edit: sops ~/.env"
}

# Use bestow to create symlinks (conflict resolution is handled by bestow itself)
bestow_packages() {
    log_step "Using bestow to manage dotfiles"

    local packages=("zsh" "bash" "bin" "nvim" "git" "tmux" "direnv" "ssh" "atuin" "gh" "htop" "lazygit" "ripgrep" "yazi" "flutter" "claude" "typos" "dust" "ghostty" "hammerspoon" "colima")

    echo ""
    echo -e "${CYAN}If a dotfile already exists at the destination, how should it be handled?${NC}"
    echo -e "  ${YELLOW}b${NC}) Backup existing files (renamed to *.bestow.backup) and symlink"
    echo -e "  ${YELLOW}k${NC}) Keep existing files as-is (skip only the conflicting files)"
    echo ""

    local conflict_flag=""
    while true; do
        echo -en "  ${YELLOW}Choose action (b/k): ${NC}"
        read -r -n 1 choice
        echo
        case "$choice" in
            [Bb])
                conflict_flag="--backup"
                break
                ;;
            [Kk])
                conflict_flag=""
                break
                ;;
            *) echo -e "  ${YELLOW}${WARNING} Please press 'b' or 'k'${NC}" ;;
        esac
    done

    local stowed_packages=()
    local failed_packages=()

    for package in "${packages[@]}"; do
        if [ ! -d "$DOTFILES_DIR/$package" ]; then
            log_warning "Package directory not found: $package"
            continue
        fi

        # bin symlinks into ~/bin, not $HOME directly
        local dest="$HOME"
        if [ "$package" = "bin" ]; then
            dest="$HOME/bin"
            mkdir -p "$dest"
        fi

        # shellcheck disable=SC2086 # conflict_flag is intentionally unquoted (empty or a single flag)
        if bestow stow "$package" -s "$DOTFILES_DIR" -d "$dest" $conflict_flag >/dev/null 2>&1; then
            log_success "Stowed $package package"
            stowed_packages+=("$package")
        else
            log_error "Failed to stow $package package"
            failed_packages+=("$package")
        fi
    done

    if [ ${#stowed_packages[@]} -gt 0 ]; then
        log_success "Successfully stowed packages: ${stowed_packages[*]}"
    else
        log_error "No packages were stowed successfully"
        return 1
    fi

    if [ ${#failed_packages[@]} -gt 0 ]; then
        log_warning "Some packages had issues: ${failed_packages[*]}"
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
        errors=$((errors + 1))
    fi

    # Test function files
    local func_errors=0
    if [ -d "$HOME/.functions.d" ]; then
        for func_file in "$HOME/.functions.d"/*.zsh; do
            if [ -f "$func_file" ] && ! zsh -n "$func_file" >/dev/null 2>&1; then
                log_error "Syntax error in $(basename "$func_file")"
                func_errors=$((func_errors + 1))
            fi
        done
        if [ "$func_errors" -eq 0 ]; then
            log_success "Function files syntax is valid"
        else
            errors=$((errors + func_errors))
        fi
    else
        log_warning "Functions directory ~/.functions.d not found"
    fi

    # Test aliases file
    if zsh -n "$HOME/.aliases.sh" >/dev/null 2>&1; then
        log_success "Aliases file syntax is valid"
    else
        log_error "Aliases file has syntax errors"
        errors=$((errors + 1))
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
        log_info "Run 'bestow stow zsh' to create the symlink"
    fi

    if [ $errors -eq 0 ]; then
        log_success "Installation test passed!"
    else
        log_error "Installation test found $errors errors"
        return 1
    fi
}

# pam_reattach (Touch ID inside tmux) is loaded by sudo as root, so it must not
# be loaded from the Homebrew prefix: that's writable by your user, and any
# process running as you could swap the module and get root on the next sudo.
# init.sh copies it to root-owned /opt/pam and points sudo_local there. Re-run
# ./init.sh after `brew upgrade pam-reattach` to refresh the copy.
PAM_REATTACH_DIR="/opt/pam"
PAM_REATTACH_LIB="$PAM_REATTACH_DIR/pam_reattach.so"

# Print the path of Homebrew's pam_reattach.so (the copy source), if any
find_brew_pam_reattach() {
    local prefix
    for prefix in "${HOMEBREW_PREFIX:-}" /opt/homebrew /usr/local; do
        if [[ -n "$prefix" && -f "$prefix/lib/pam/pam_reattach.so" ]]; then
            echo "$prefix/lib/pam/pam_reattach.so"
            return 0
        fi
    done
    return 1
}

# Copy pam_reattach.so $1 to $PAM_REATTACH_LIB as root:wheel 0444 (needs sudo)
install_pam_reattach() {
    log_info "Copying $1 to $PAM_REATTACH_LIB (root-owned, read-only; needs sudo)..."
    sudo install -d -o root -g wheel -m 755 "$PAM_REATTACH_DIR" &&
        sudo install -o root -g wheel -m 444 "$1" "$PAM_REATTACH_LIB"
}

# Setup Touch ID for sudo authentication
setup_touchid_sudo() {
    log_step "Setting up Touch ID for sudo"

    local sudo_local="/etc/pam.d/sudo_local"
    local brew_lib current_lib
    brew_lib=$(find_brew_pam_reattach) || brew_lib=""

    # Check if already configured
    if [[ -f "$sudo_local" ]] && grep -q "pam_tid.so" "$sudo_local"; then
        log_success "Touch ID for sudo already configured"

        # Module path of an active `auth ... pam_reattach.so` line, if any
        current_lib=$(awk '$1 == "auth" && $3 ~ /pam_reattach\.so$/ { print $3; exit }' "$sudo_local")

        if [[ -z "$current_lib" ]]; then
            # Not configured yet (Touch ID won't work inside tmux)
            if [[ -n "$brew_lib" ]]; then
                log_warning "pam_reattach not configured (Touch ID won't work inside tmux)"
                if confirm "Add pam_reattach for tmux Touch ID support?"; then
                    if install_pam_reattach "$brew_lib"; then
                        # Prepend pam_reattach line before pam_tid
                        sudo sed -i '' "/pam_tid.so/i\\
auth       optional       $PAM_REATTACH_LIB
" "$sudo_local"
                        log_success "Added pam_reattach for tmux support"
                    else
                        log_error "Could not copy pam_reattach; $sudo_local left unchanged"
                    fi
                fi
            fi
        elif [[ "$current_lib" != "$PAM_REATTACH_LIB" ]]; then
            # Migration from the old setup, which loaded it from Homebrew
            log_warning "sudo loads pam_reattach from $current_lib, which isn't root-owned"
            log_info "Any process running as you could replace it and get root on your next sudo"
            local source_lib="${brew_lib:-$current_lib}"
            if [[ ! -f "$source_lib" ]]; then
                log_error "pam_reattach.so not found; run 'brew install pam-reattach' and re-run ./init.sh"
            elif confirm "Copy it to root-owned $PAM_REATTACH_LIB and point $sudo_local there?"; then
                if install_pam_reattach "$source_lib"; then
                    sudo sed -i '' "s|^\(auth[[:space:]][[:space:]]*optional[[:space:]][[:space:]]*\)[^[:space:]]*pam_reattach\.so|\1$PAM_REATTACH_LIB|" "$sudo_local"
                    log_success "$sudo_local now loads $PAM_REATTACH_LIB"
                else
                    log_error "Could not copy pam_reattach; $sudo_local left unchanged"
                fi
            fi
        elif [[ -n "$brew_lib" ]] && ! cmp -s "$brew_lib" "$PAM_REATTACH_LIB"; then
            # Already migrated, but Homebrew has a different (upgraded) build
            log_warning "$PAM_REATTACH_LIB differs from Homebrew's copy (was pam-reattach upgraded?)"
            if confirm "Refresh $PAM_REATTACH_LIB from $brew_lib?"; then
                if install_pam_reattach "$brew_lib"; then
                    log_success "Refreshed $PAM_REATTACH_LIB"
                else
                    log_error "Could not refresh $PAM_REATTACH_LIB"
                fi
            fi
        else
            log_success "pam_reattach loads from root-owned $PAM_REATTACH_LIB"
        fi
        return 0
    fi

    if confirm "Enable Touch ID for sudo? (Use fingerprint instead of password)"; then
        log_info "Configuring Touch ID for sudo via /etc/pam.d/sudo_local..."
        log_info "This file persists across macOS updates (unlike editing /etc/pam.d/sudo)"

        # Build the sudo_local content
        local content="# sudo_local: local config for sudo (persists across macOS updates)
# Added by dotfiles/init.sh
"

        # Add pam_reattach if available (must come before pam_tid), loaded
        # from the root-owned copy
        local with_reattach=false
        if [[ -n "$brew_lib" ]]; then
            if install_pam_reattach "$brew_lib"; then
                content+="auth       optional       $PAM_REATTACH_LIB
"
                with_reattach=true
                log_info "Including pam_reattach for tmux compatibility"
            else
                log_warning "Could not copy pam_reattach - Touch ID won't work inside tmux"
            fi
        else
            log_warning "pam-reattach not found - Touch ID won't work inside tmux"
            log_info "Install with: brew install pam-reattach, then re-run ./init.sh"
        fi

        content+="auth       sufficient     pam_tid.so
"

        # Write the file (requires sudo)
        echo "$content" | sudo tee "$sudo_local" >/dev/null
        log_success "Touch ID for sudo enabled"
        log_info "You can now use your fingerprint when sudo prompts for a password"

        if [[ "$with_reattach" = true ]]; then
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
    echo -e "• ${YELLOW}Ghostty:${NC} Already configured in ~/.config/ghostty/config (FiraCode Nerd Font)"
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
    install_core_dependencies # Installs Go (via Brewfile), required by install_bestow
    install_bestow
    setup_touchid_sudo
    install_dev_tools
    install_terminal_apps
    install_fonts
    install_zinit
    setup_secret_management || log_warning "Secret management isn't finished - fix the issue above and re-run ./init.sh"
    backup_existing_files
    bestow_packages # Must run after backup_existing_files
    install_tpm     # Needs ~/.tmux.conf from bestow_packages
    setup_git_config
    check_git_signing
    test_installation || true # Problems are reported above; still print the next steps

    print_final_instructions
}

# Run main function
main "$@"
