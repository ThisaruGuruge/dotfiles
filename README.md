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
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
cd ~/.dotfiles

# Run the installation script
./init.sh
```

The `init.sh` script will:
- ✅ Check for macOS compatibility
- ✅ Install Xcode Command Line Tools (if needed)
- ✅ Install Homebrew (if needed)
- ✅ Install GNU Stow (dotfiles manager)
- ✅ Install modern CLI tools (eza, bat, delta, lazygit, tmux, direnv, atuin)
- ✅ Offer to install development tools (Python, Ruby, Node.js managers)
- ✅ Install SDKMAN (Java, Gradle, Maven, Kotlin manager)
- ✅ Offer terminal app installation (Warp or iTerm2)
- ✅ Install and configure Nerd Fonts
- ✅ Set up Zinit plugin manager
- ✅ Create environment file from template
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
brew install stow oh-my-posh fzf zoxide tree bat eza ripgrep fd git-delta lazygit tmux htop direnv atuin gh

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
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
cd ~/.dotfiles

# Install all dependencies with Homebrew Bundle
brew bundle --file=Brewfile

# Follow steps 2-3 from Option 2 for Zinit and dotfiles setup
```

#### Step 2: Install Zinit

```bash
bash -c "$(curl --fail --show-error --silent --location https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"
```

#### Step 3: Clone and Setup Dotfiles

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
   cd ~/.dotfiles
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

**Other Utilities**:
- `extract archive.tar.gz` - Universal archive extractor
- `compress <folder>` - Create tar.gz archive
- `checkPort <port>` - See what's running on a port
- `git_ignore_local <file>` - Add to local git ignore

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

Add custom environment variables to `~/.env`:
```bash
export MY_CUSTOM_VAR='value'
export PATH="$PATH:/my/custom/path"
```

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
chmod +x ~/.dotfiles/.functions.sh
chmod +x ~/.dotfiles/.aliases.sh
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

# ✅ Atuin keybinding
# Press Ctrl+Alt+R - should show Atuin fuzzy history search
```

**Verification Checklist:**
- [ ] `zsh -n ~/.zshrc` passes without errors
- [ ] fzf fuzzy search works (Ctrl+R, but may conflict with Warp)
- [ ] `tmux` starts and Ctrl+a | splits panes
- [ ] `eza --version`, `rg --version`, `atuin --version` all work
- [ ] Ctrl+Alt+R triggers Atuin history search
- [ ] Custom functions like `take` and `kill_by_port --help` work

## 🔄 Updating

To update the dotfiles:

```bash
cd ~/.dotfiles
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

## 📄 License

MIT License - feel free to use and modify as needed.

---

**Enjoy your enhanced development environment! 🎉**

For questions or issues, refer to the troubleshooting section above or open an issue on GitHub.
