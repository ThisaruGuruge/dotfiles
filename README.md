# Thisaru's Dotfiles

A comprehensive development environment setup for macOS featuring Zsh, Oh My Posh, and a curated collection of productivity tools and shortcuts.

## 🚀 What You'll Get

- **Modern Shell Experience**: Zsh with intelligent autocompletion, syntax highlighting, and command suggestions
- **Beautiful Prompt**: Custom Oh My Posh theme with git integration and contextual information
- **Terminal Compatibility**: Works with any modern terminal (Warp, iTerm2, Terminal.app, etc.)
- **Enhanced Navigation**: Fast directory jumping with `zoxide` and fuzzy finding with `fzf`
- **Development Tools**: Pre-configured support for Python, Ruby, Node.js, Java, and Docker
- **Modern CLI Tools**: Enhanced with eza (ls), bat (cat), delta (git diff), lazygit (git UI), atuin (shell history)
- **Terminal Multiplexer**: Tmux configuration with modern keybindings and themes
- **Project Environment Management**: Direnv for automatic project-specific environment loading
- **Productivity Shortcuts**: 150+ aliases and custom functions for common development tasks
- **Universal Archive Handler**: `take` command that handles git repos, archives, and directory creation
- **Smart Port Management**: Easy process killing by port with the `kill_by_port` function
- **Encrypted Secret Management**: SOPS + age encryption for environment variables with seamless editing
- **Enhanced Tool Installation**: Individual confirmation with legacy installation detection
- **Comprehensive Git Setup**: Modern Git configuration with delta integration and useful aliases

## 📋 Prerequisites

### Required Software

1. **macOS** (tested on macOS Sonoma and newer)
2. **Git** - Usually pre-installed, verify with `git --version`
3. **Homebrew** - Package manager for macOS
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

### Terminal Setup

4. **Modern Terminal** (Choose one):
   - **Warp** (Recommended) - Modern, fast terminal with AI features
     ```bash
     brew install --cask warp
     ```
   - **iTerm2** - Feature-rich terminal
     ```bash
     brew install --cask iterm2
     ```
   - **Terminal.app** - Built-in macOS terminal (works but limited features)

5. **Nerd Font** - Required for proper icon display in the prompt
   ```bash
   # Fonts are now in the main homebrew-cask repository (no tap needed)
   brew install --cask font-fira-code-nerd-font
   # Or choose another: font-hack-nerd-font, font-jetbrains-mono-nerd-font
   ```

   **Configure Your Terminal**:
   - **Warp**: Go to `Settings > Appearance > Text` and select your Nerd Font
   - **iTerm2**: Go to `Preferences > Profiles > Text > Font` and select your Nerd Font
   - **Terminal.app**: Go to `Preferences > Profiles > Text` and select your Nerd Font

## 🛠 Installation

### Option 1: Automated Installation (Recommended)

The easiest way to set up everything:

```bash
# Clone the repository
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
# OR: git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
cd ~/dotfiles

# Run the installation script
./init.sh
```

The `init.sh` script will:
- ✅ Check for macOS compatibility
- ✅ Install Xcode Command Line Tools (if needed)
- ✅ Install Homebrew (if needed)
- ✅ Install GNU Stow (dotfiles manager)
- ✅ Install modern CLI tools (eza, bat, delta, lazygit, tmux, direnv, atuin)
- ✅ Install secret management tools (sops, age)
- ✅ Set up encrypted environment variables with SOPS + age
- ✅ Offer to install development tools (Python, Ruby, Node.js managers)
- ✅ Enhanced tool installation (Cursor, VS Code, GitHub CLI, PostgreSQL, Redis, AWS Vault)
- ✅ Install SDKMAN (Java, Gradle, Maven, Kotlin manager)
- ✅ Offer terminal app installation (Warp or iTerm2)
- ✅ Install and configure Nerd Fonts
- ✅ Set up Zinit plugin manager
- ✅ Create environment file from template with encryption
- ✅ Set up Git personal configuration securely
- ✅ Backup existing dotfiles automatically
- ✅ Use Stow to manage symlinks cleanly
- ✅ Test the installation
- ✅ Provide next steps and usage instructions

### Option 2: Manual Installation

If you prefer to install manually or need to customize the process:

#### Step 1: Install Prerequisites

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install GNU Stow and core dependencies
brew install stow oh-my-posh fzf zoxide tree bat eza ripgrep fd git-delta lazygit tmux htop direnv atuin gh sops age

# Install development tools (optional)
brew install pyenv rbenv nvm

# Install terminal (choose one)
brew install --cask warp          # Recommended
# OR
brew install --cask iterm2         # Alternative

# Install Nerd Font (no tap needed - fonts are now in main repository)
brew install --cask font-fira-code-nerd-font

# Install SDKMAN (Java ecosystem)
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

### Option 3: Using Brewfile

The fastest way to install all dependencies:

```bash
# Clone the repository first
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
# OR: git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
cd ~/dotfiles

# Install all dependencies with Homebrew Bundle
brew bundle --file=Brewfile

# Follow steps 2-3 from Option 2 for Zinit and dotfiles setup
```

## 📦 Package Management System

This dotfiles repository includes a **centralized package management system** that ensures consistency between the installation script (`init.sh`) and the `Brewfile`.

### Features

- **Single Source of Truth**: All packages defined in `packages.json`
- **Easy Enable/Disable**: Toggle individual packages or entire categories
- **Automatic Brewfile Generation**: Brewfile is generated from configuration
- **Interactive Management**: User-friendly interface for package configuration
- **Perfect Consistency**: init.sh and Brewfile always stay in sync

### Managing Packages

```bash
# Interactive package management
manage_packages

# Command line usage
manage_packages list                    # List all packages
manage_packages categories              # List all categories
manage_packages enable cursor           # Enable a specific package
manage_packages disable htop            # Disable a specific package
manage_packages enable-category editors # Enable entire category
```

### Package Categories

The system organizes packages into logical categories:

- **core**: Essential tools (always enabled)
- **security**: Secret management tools (always enabled)
- **development**: Language version managers (optional)
- **database**: Database servers and tools (optional)
- **editors**: Code editors and IDEs (optional)
- **terminals**: Modern terminal applications (optional)
- **containers**: Docker and container tools (optional)
- **productivity**: Productivity and utility apps (optional)

### Customizing Your Installation

1. **Enable Optional Categories**:
   ```bash
   manage_packages enable-category development
   manage_packages enable-category editors
   ```

2. **Enable Individual Packages**:
   ```bash
   manage_packages enable visual-studio-code
   manage_packages enable docker
   ```

3. **Regenerate Brewfile**:
   ```bash
   ./bin/generate-brewfile
   ```

4. **Install New Packages**:
   ```bash
   brew bundle --file=Brewfile
   ```

#### Step 2: Install Zinit

```bash
bash -c "$(curl --fail --show-error --silent --location https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"
```

#### Step 3: Clone and Setup Dotfiles

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
   # OR: git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
   cd ~/dotfiles
   ```

2. **Setup environment variables**:
   ```bash
   cp zsh/.env.example zsh/.env

   # Edit .env with your preferred editor
   nano zsh/.env  # or vim zsh/.env, code zsh/.env, etc.

   # Update the following values:
   # export packageUser='YOUR_GITHUB_USERNAME'
   # export packagePAT='YOUR_GITHUB_PERSONAL_ACCESS_TOKEN'
   ```

3. **Backup existing configurations** (recommended):
   ```bash
   # Backup your current dotfiles
   cp ~/.zshrc ~/.zshrc.backup 2>/dev/null || true
   cp ~/.vimrc ~/.vimrc.backup 2>/dev/null || true
   ```

4. **Use Stow to manage dotfiles**:
   ```bash
   # Stow manages symlinks automatically in organized packages
   stow zsh      # Links all zsh-related configs
   stow vim      # Links vim configuration
   stow config   # Links application configs (Oh My Posh theme)
   ```

5. **Apply configuration**:
   ```bash
   # Restart your terminal or source the new configuration
   source ~/.zshrc
   ```

## 🚀 Quick Start

After installation, try these essential commands:

```bash
# 📚 LEARN YOUR SYSTEM - Documentation & Discovery
help                                       # Show comprehensive alias documentation
docs                                       # Interactive menu to browse all aliases
show_tools                                 # Show all modern CLI tools with examples
profile_startup                            # Test shell startup performance

# 📁 FILE OPERATIONS - Modern Tools
ls                                         # Enhanced listing with icons and git status
ll                                         # Detailed file listing with headers
cat README.md                              # View file with syntax highlighting
grep "TODO"                                # Fast search with ripgrep

# 🌿 GIT WORKFLOW - Enhanced Git Experience
lg                                         # Open lazygit for interactive git operations
glog                                       # Beautiful git log with graph
gits                                       # Git status (shorthand)
help git                                   # Show all git aliases with examples

# 📺 TERMINAL MULTIPLEXER - Session Management
t                                          # Start new tmux session
ta                                         # Attach to existing session
help tmux                                  # Show all tmux shortcuts and keybindings

# 🔧 DEVELOPMENT WORKFLOW - Productivity Tools
take my-project                            # Create directory and enter it
kill_by_port 3000                         # Kill processes on port 3000

# 📦 PACKAGE MANAGEMENT - Configure Your Setup
manage_packages                            # Interactive package configuration
manage_packages categories                 # List all available categories
manage_packages enable docker              # Enable specific packages

# 🔍 DISCOVERY - Find What You Need
alias_search docker                       # Find all Docker-related aliases
aliases                                    # Show aliases organized by category
help docker                               # Show Docker workflow with examples
```

#### Stow Package Structure

The dotfiles are organized into logical packages:
- **zsh/** - All shell-related configurations (.zshrc, .aliases.sh, .functions.sh, etc.)
- **vim/** - Vim configuration (.vimrc)
- **git/** - Git configuration with modern features and security
- **tmux/** - Terminal multiplexer configuration
- **direnv/** - Project-specific environment management
- **config/** - Application-specific configs (Oh My Posh themes, etc.)

```bash
# Install specific packages
stow zsh      # Shell configurations
stow vim      # Editor setup
stow git      # Git with modern features
stow tmux     # Terminal multiplexer
stow direnv   # Project environments
stow config   # Application configs
```

## 🎨 Post-Installation Setup

### Configure Development Tools

1. **Python Environment** (if using pyenv):
   ```bash
   # Install latest Python
   pyenv install 3.12.0
   pyenv global 3.12.0
   ```

2. **Node.js Environment** (if using nvm):
   ```bash
   # Install latest LTS Node.js
   nvm install --lts
   nvm use --lts
   nvm alias default node
   ```

3. **Ruby Environment** (if using rbenv):
   ```bash
   # Install latest Ruby
   rbenv install 3.2.0
   rbenv global 3.2.0
   ```

4. **Java Environment** (if using SDKMAN):
   ```bash
   # Install SDKMAN
   curl -s "https://get.sdkman.io" | bash
   source "$HOME/.sdkman/bin/sdkman-init.sh"

   # Install Java
   sdk install java 21.0.5-tem
   ```

5. **Atuin Shell History** (first run setup):
   ```bash
   # Import your existing shell history
   atuin import auto

   # Optional: Set up sync across machines
   # atuin register
   # atuin login
   # atuin sync
   ```

### Optional: Install Additional Tools

```bash
# Docker Desktop (if needed)
brew install --cask docker

# VS Code (if needed)
brew install --cask visual-studio-code

# Additional development tools
brew install jq curl wget htop
```

## 🚀 Features Overview

### Aliases Available

**Navigation & File Operations**:
- `..`, `...`, `....` - Quick directory traversal
- `ll` - Detailed file listing
- `c` - Clear terminal
- `cls` - Clear and list filesw

**Git Shortcuts**:
- `gits` - Git status
- `gp` / `gl` - Git push/pull
- `gco` - Git checkout
- `gb` - Git branch
- `ga` / `gaa` - Git add / add all

**Development**:
- `p3` - Python 3
- `v` - Vim
- `gwb` - Gradle build
- `use_java_17` / `use_java_21` - Switch Java versions

### Modern CLI Tools

**`eza` - Enhanced File Listing**:
```bash
ls                                         # Basic listing with icons and git status
ll                                         # Detailed listing with headers and file info
la                                         # Show all files including hidden ones
lt                                         # Tree view (2 levels deep)
ls_k                                       # Sort by file size (largest last)
ls_t                                       # Sort by modification time (newest last)
```

**`bat` - Syntax-Highlighted File Viewer**:
```bash
cat file.js                               # View JavaScript with syntax highlighting
less README.md                            # Page through markdown with highlighting
bat --style=numbers,changes file.py       # Show line numbers and git changes
```

**`ripgrep` - Fast Text Search**:
```bash
grep "TODO"                               # Fast search with ripgrep (much faster than grep)
rg "function" --type js                   # Search in JavaScript files only
rg "pattern" -A 3 -B 3                   # Show 3 lines before and after matches
```

> ⚠️ **Note**: `grep` is aliased to `ripgrep` for better performance, but it's not fully POSIX-compatible. For scripts requiring traditional grep behavior, use `\grep` or `/usr/bin/grep`.

**`lazygit` - Interactive Git Interface**:
```bash
lg                                         # Open lazygit TUI for git operations
glog                                       # Beautiful git log with graph and colors
gunstage                                   # Unstage files from git index
gundo                                      # Undo last commit but keep changes
gcleanup                                   # Remove merged branches automatically
```

**`tmux` - Terminal Multiplexer**:
```bash
t                                          # Start new tmux session
ta                                         # Attach to last session
tat work                                   # Attach to session named "work"
tl                                         # List all sessions
# Inside tmux: Ctrl-a | (split horizontally), Ctrl-a - (split vertically)
```

**`direnv` - Project Environment Management**:
```bash
# In project root, create .envrc file:
echo "layout python" > .envrc             # Auto-activate Python virtual env
echo "use node 18" > .envrc               # Use Node.js version 18
direnv allow                               # Allow direnv to load the environment
```

### Custom Functions

**`take` - Universal Directory/Repo Handler**:
```bash
take my-project                           # Create and enter directory
take https://github.com/user/repo.git     # Clone repo and enter
take git@github.com:user/repo.git         # Clone via SSH
take https://example.com/archive.tar.gz   # Download and extract
```

**`kill_by_port` - Process Management**:
```bash
kill_by_port 3000                         # Kill processes on port 3000
kill_by_port -d 8080                      # Dry run (show what would be killed)
kill_by_port --help                       # Show help
```

**Documentation System - Learn Your Aliases**:
```bash
help                                       # Show documentation system usage
help git                                   # Show all git aliases with detailed examples
help docker                               # Show all docker aliases and workflows
docs                                       # Interactive alias browser (menu-driven)
aliases                                    # Show all aliases organized by category
alias_search git                          # Find all aliases containing "git"
```

**`show_tools` - Discover Available Tools**:
```bash
show_tools                                 # Show all modern CLI tools and examples
```

**Secret Management**:
```bash
edit_secrets                               # Edit encrypted environment variables seamlessly
sops -d ~/.env                            # View decrypted secrets
sops ~/.env                               # Direct SOPS editing
```

**Other Utilities**:
- `extract archive.tar.gz` - Universal archive extractor
- `compress <folder>` - Create tar.gz archive
- `checkPort <port>` - See what's running on a port
- `git_ignore_local <file>` - Add to local git ignore

## 🔐 Secret Management

This dotfiles setup includes a comprehensive secret management system using **SOPS** (Secrets OPerationS) with **age** encryption.

### How It Works

- **Single `.env` file**: All environment variables are stored in `~/.env`
- **Automatic encryption**: The file is encrypted in-place using SOPS + age
- **Seamless integration**: Your shell automatically decrypts and loads variables on startup
- **Safe editing**: Use `edit_secrets` command to edit encrypted secrets safely

### Key Features

✅ **In-place encryption**: No separate `.env.sops` file to manage
✅ **Automatic detection**: Shell detects encrypted vs plaintext automatically
✅ **Safe backups**: Timestamped backups created before any changes
✅ **Format preservation**: Maintains `export KEY="value"` format for shell compatibility
✅ **Git ignored**: Environment files are automatically excluded from version control

### Usage

```bash
# Edit your encrypted secrets (recommended)
edit_secrets                               # Opens decrypted content in your editor
                                          # Automatically re-encrypts when you save

# View secrets without editing
sops -d ~/.env                            # Show decrypted content

# Direct SOPS editing (advanced)
sops ~/.env                               # Edit with SOPS directly

# Check if secrets are encrypted
head -1 ~/.env                            # Should show "#ENC[..." if encrypted
```

### Setup Process

The `./init.sh` script automatically:

1. 🔑 **Generates age encryption key** (stored in `~/.config/sops/age/keys.txt`)
2. ⚙️ **Creates SOPS configuration** (`~/.sops.yaml`)
3. 📁 **Handles existing `.env`**: Encrypts in-place with backup
4. 🆕 **Creates new `.env`**: From template if none exists
5. 🔧 **Configures shell**: Automatic decryption on terminal startup

### Security Benefits

- **🔒 Encrypted at rest**: Secrets are never stored in plaintext on disk
- **🚫 Git safe**: `.env` files are in `.gitignore` - no risk of committing secrets
- **🔑 Key isolation**: Encryption keys stored separately from encrypted data
- **📦 Backup safety**: Automatic backups before any encryption changes
- **🛡️ Age encryption**: Modern, secure encryption standard

### File Format

Your `.env` file uses standard shell export format:

```bash
# Environment Variables (encrypted with SOPS)
export GITHUB_TOKEN="ghp_your_github_personal_access_token"
export DATABASE_URL="postgresql://user:pass@localhost/db"
export API_KEY="your_api_key_here"
export AWS_ACCESS_KEY_ID="your_aws_access_key"
export AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
```

After encryption, the same file will look like:
```bash
#ENC[AES256_GCM,data:encrypted_data_here,iv:...,tag:...,type:comment]
#
export GITHUB_TOKEN=ENC[AES256_GCM,data:more_encrypted_data...]
# ... more encrypted content
```

## ⚙️ Customization

### Adding Your Own Aliases

Edit `~/.aliases.sh` and add your custom aliases:
```bash
alias myalias='my command'
```

### Adding Custom Functions

Edit `~/.functions.sh` and add your functions:
```bash
my_function() {
    echo "Hello from my function"
}
```

### Modifying the Prompt

The Oh My Posh theme is located at `~/.config/ohmyposh/zen.json`. You can:
- Modify colors in the `palette` section
- Add/remove prompt segments
- Check [Oh My Posh documentation](https://ohmyposh.dev/) for advanced customization

### Environment Variables

Add custom environment variables to your encrypted `~/.env` file:
```bash
# Use the secure edit_secrets command
edit_secrets

# Then add your variables in the editor:
export MY_CUSTOM_VAR='value'
export PATH="$PATH:/my/custom/path"
```

The variables will be automatically encrypted when you save and exit the editor.

## 🔧 Troubleshooting

### Common Issues

**"Command not found" errors**:
```bash
# Restart terminal or re-source configuration
source ~/.zshrc

# Check if tools are installed
which oh-my-posh fzf zoxide
```

**Permission denied errors**:
```bash
chmod +x ~/dotfiles/.functions.sh
chmod +x ~/dotfiles/.aliases.sh
```

**Zinit not loading**:
```bash
# Reinstall zinit
rm -rf ~/.local/share/zinit
bash -c "$(curl --fail --show-error --silent --location https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"
```

**Oh My Posh not working**:
```bash
# Verify installation
oh-my-posh --version

# Reinstall if needed
brew uninstall oh-my-posh
brew install oh-my-posh
```

### Verify Setup

Run this verification checklist to ensure everything is working:

```bash
# ✅ Shell configuration syntax check
zsh -n ~/.zshrc                          # Should pass without errors

# ✅ fzf key bindings
# Press Ctrl+R - should show fzf fuzzy search (Note: may conflict with Warp's native history)

# ✅ tmux functionality
tmux                                      # Start tmux session
# Press Ctrl+a | - should split horizontally
# Press Ctrl+a d - should detach session

# ✅ Modern CLI tools versions
eza --version                            # Enhanced ls
rg --version                             # ripgrep
atuin --version                          # Shell history

# ✅ Custom functions
kill_by_port --help                      # Should show help
take test-dir && pwd                     # Should create and enter directory
edit_secrets                             # Should open encrypted secrets for editing

# ✅ Secret management
sops --version                           # Should show SOPS version
age --version                            # Should show age version

# ✅ Atuin keybinding
# Press Ctrl+Alt+R - should show Atuin fuzzy history search
```

**Verification Checklist:**
- [ ] `zsh -n ~/.zshrc` passes without errors
- [ ] fzf fuzzy search works (Ctrl+R, but may conflict with Warp)
- [ ] `tmux` starts and Ctrl+a | splits panes
- [ ] `eza --version`, `rg --version`, `atuin --version` all work
- [ ] `sops --version` and `age --version` work (secret management)
- [ ] `edit_secrets` command opens encrypted environment file
- [ ] Ctrl+Alt+R triggers Atuin history search
- [ ] Custom functions like `take` and `kill_by_port --help` work

## ⚡ Performance

This dotfiles setup is optimized for fast shell startup and responsive daily use:

### Performance Targets
- **Excellent**: < 0.2s startup (instant feel)
- **Good**: < 0.4s startup (very responsive)
- **Acceptable**: < 0.8s startup (responsive)
- **Slow**: > 1.5s startup (needs optimization)

### Performance Features
- **Lazy Loading**: Heavy components (fzf, atuin, direnv, pyenv, rbenv, SDKMAN) load only when needed
- **Turbo Mode**: Non-essential Zinit plugins load with delay
- **Efficient Initialization**: Optimized oh-my-posh and plugin loading
- **PATH Deduplication**: Prevents PATH pollution and slow lookups

### Monitor Performance
```bash
# Quick performance test
profile_startup

# Detailed profiling with full script
./bin/profile-startup

# Manual timing
time zsh -i -c exit
```

## 🔄 Updating

To update the dotfiles:

```bash
cd ~/dotfiles
git pull origin main
source ~/.zshrc  # Reload configuration
```

## 📝 Notes

- This setup works with any modern terminal (Warp, iTerm2, Terminal.app, etc.)
- The configuration prioritizes productivity and includes many shortcuts - take time to learn them!
- All sensitive data is kept in local `.env` file and never committed to git
- The setup includes extensive error handling and helpful messages

## 🤝 Contributing

Found an issue or have a suggestion? Feel free to:
1. Open an issue on GitHub
2. Fork the repository and submit a pull request
3. Suggest improvements to the setup

### Quality Assurance

This repository includes automated validation:
- **Shellcheck**: Validates all shell scripts for common issues
- **Formatting**: Ensures consistent code formatting with shfmt
- **Syntax Testing**: Validates JSON and shell configuration syntax
- **Security Checks**: Scans for hardcoded paths and potential secrets
- **Cross-platform Testing**: Tests compatibility on macOS and Linux

All pull requests are automatically validated through GitHub Actions.

## 📄 License

MIT License - feel free to use and modify as needed.

---

**Enjoy your enhanced development environment! 🎉**

For questions or issues, refer to the troubleshooting section above or open an issue on GitHub.
