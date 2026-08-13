# Thisaru's Dotfiles Brewfile
# Single source of truth for core packages
# Install with: brew bundle

# Homebrew taps
tap "jesseduffield/lazygit"    # Official lazygit tap for frequent updates
tap "jesseduffield/lazydocker" # Official lazydocker tap
tap "gdubw/gng"                # GNG - Gradle run-anywhere tool

# Essential tools required for dotfiles functionality
brew "go"                           # Go toolchain; required to `go install` bestow, the symlink manager used by init.sh (github.com/redpierrot/bestow)
brew "git"                          # Version control
brew "neovim"                       # Text editor (nvim/ package configures it)
brew "fzf"                          # Fuzzy finder
brew "zoxide"                       # Smart cd command
brew "tree"                         # Directory tree viewer
brew "bat"                          # Cat clone with syntax highlighting
brew "eza"                          # Modern ls replacement
brew "dust"                         # Modern du replacement (d alias)
brew "ripgrep"                      # Fast text search
brew "fd"                           # Find replacement
brew "git-delta"                    # Git diff viewer
brew "lazygit"                      # Terminal UI for git (official tap for frequent updates)
brew "lazydocker"                   # Terminal UI for Docker
brew "tmux"                         # Terminal multiplexer
brew "htop"                         # System monitor
brew "direnv"                       # Directory-specific environments
brew "atuin"                        # Shell history with sync
brew "gh"                           # GitHub CLI

# Tools for managing secrets and encryption
brew "sops"                         # Secrets OPerationS
brew "age"                          # Simple file encryption

# Authentication
brew "pam-reattach"                 # Reattach to user namespace (Touch ID in tmux)

# File management
brew "yazi"                         # Terminal file manager (used in Neovim via yazi.nvim)
brew "ffmpegthumbnailer"            # Video thumbnail previews (yazi)
brew "poppler"                      # PDF preview (yazi)
brew "imagemagick"                  # SVG/font preview (yazi)
brew "unar"                         # Archive preview (yazi)
brew "chafa"                        # Image-to-text/sixel renderer (yazi image preview fallback)

# JSON/YAML processing and viewing
brew "jq"                           # JSON processor for scripts
brew "jless"                        # Interactive JSON/YAML viewer

# Markdown viewing
brew "mdcat"                        # Terminal markdown renderer (mdcat + mdless)

# Code formatting & linting (required for nvim format-on-save + CONTRIBUTING workflow)
brew "shellcheck"                   # Shell script linter (required by CONTRIBUTING.md validation)
brew "shfmt"                        # Shell script formatter (conform.nvim + CONTRIBUTING.md)
brew "stylua"                       # Lua formatter (conform.nvim)
brew "prettier"                     # JS/TS/JSON/YAML/Markdown formatter (conform.nvim)
brew "markdownlint-cli2"            # Markdown structure/style linter (nvim-lint)

# AI/Development Tools
cask "antigravity"                  # AI Agent
cask "claude-code"                  # Claude Code CLI (claude/ package configures it)

# Language version managers and development tools
brew "ballerina"                    # Cloud-native programming language
brew "gdubw/gng/gng"                # Gradle run-anywhere wrapper (gw command)

# Fonts
cask "font-fira-code-nerd-font"     # Nerd font with icons
cask "font-noto-sans-sinhala"       # Sinhala fallback font (used by ghostty config)

# Terminal emulator
cask "ghostty"                      # GPU-accelerated terminal (native Metal on macOS)

# Keyboard remapping
cask "hammerspoon"                  # hammerspoon/ package configures Caps Lock: tap for Escape, hold for Control (Karabiner alternative, no system extension)

