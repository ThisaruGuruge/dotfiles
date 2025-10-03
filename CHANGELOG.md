# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-03

### Major Features

#### Secret Management

- **SOPS + age encryption** for environment variables with seamless editing
- `edit_secrets` command for safe secret editing with automatic encryption/decryption
- Age key generation and SOPS configuration in init script
- Environment variable templates (.env.example) instead of committing secrets
- Automatic detection of encrypted vs plaintext .env files
- Timestamped backups before encryption changes

#### Validation & Testing

- **Comprehensive validation suite** via `test-zsh` command
- Tests all tools, runtimes, environment variables, and PATH configuration
- Beautiful colored output with pass/fail/warning states
- Performance testing with 3-sample averages (~0.6s startup time)
- Dynamic testing based on packages.json configuration
- GitHub Actions CI/CD with shellcheck, shfmt, JSON validation, and security scanning

#### Package Management System

- **Centralized package configuration** in packages.json as single source of truth
- Automated Brewfile generation from packages.json
- `manage_packages` interactive tool for package configuration
- Category-based organization (core, security, development, database, etc.)
- Enable/disable individual packages or entire categories
- Perfect consistency between init.sh and Brewfile

#### Performance Optimizations

- **Fast shell startup** (~0.6s) with lazy loading strategies
- NVM lazy loading - PATH added immediately, full NVM loads on demand
- Oh My Posh caching (~/.cache/zsh/omp_cache.zsh)
- Zinit turbo mode for non-essential plugins
- PATH deduplication to prevent slow lookups
- Performance profiling tool (bin/profile-startup)

#### Custom Oh My Posh Theme

- **Context-aware prompt** with language runtime indicators
- Java (☕), Node.js (⬢), Python (🐍), Ballerina (🦢) version display
- Git status with file changes, staged files, stash count
- Path truncation (max 3 levels) for clean display
- Multi-language project support
- Upstream tracking (ahead/behind/diverged indicators)

### Tools & Integrations

#### Modern CLI Tools

- **Enhanced file operations**: eza (ls), bat (cat), ripgrep (grep), fd (find)
- **Git workflow**: lazygit (TUI), git-delta (diff viewer), gh (GitHub CLI)
- **Productivity**: fzf (fuzzy finder), zoxide (smart cd), atuin (shell history sync)
- **System tools**: tmux (multiplexer), htop (monitor), direnv (env management)
- **Search & navigation**: tree, ripgrep, fd with aliases and integrations

#### Development Environment Support

- **Java ecosystem**: SDKMAN for Java, Gradle, Maven, Kotlin management
- **Node.js**: NVM with lazy loading and global package support
- **Python**: pyenv for Python version management
- **Ruby**: rbenv for Ruby version management
- **Ballerina**: Cloud-native programming language support
- **Docker**: Container management and development tools

#### GNU Stow Package Structure

- **Organized packages**: zsh, vim, git, tmux, direnv, config
- Clean symlink management with automatic backup
- Easy package installation/removal (stow/unstow commands)
- Modular configuration with clear separation of concerns

### Documentation

#### Comprehensive README

- **1089 lines** of detailed documentation
- Prerequisites and installation instructions (automated, manual, Brewfile)
- Quick start guide with essential commands
- Package management system documentation
- Secret management guide with examples
- Prompt customization and understanding
- Troubleshooting section with common issues
- Performance metrics and optimization tips
- Verification checklist for setup validation

#### Inline Documentation

- **150+ documented aliases** with examples
- `help` command system for discovering aliases by category
- `docs` interactive menu for browsing all aliases
- `alias_search` for finding specific aliases
- `show_tools` for discovering modern CLI tools
- Extensive function documentation with usage examples

### Security

#### Secret Protection

- SOPS + age encryption for all environment variables
- No secrets in git history (verified clean)
- Proper .gitignore excluding .env, credentials, and sensitive files
- CI secret scanning for passwords, tokens, and keys
- Hardcoded path detection in CI to prevent leaks

#### Secure Practices

- Environment variable templates instead of actual secrets
- Automatic encryption of plaintext .env files during init
- Safe editing workflow with edit_secrets command
- Key isolation (encryption keys stored separately from data)
- GitHub Personal Access Token (PAT) setup guidance

### Configuration Files

#### Shell Configuration

- `.zshrc` - Main shell configuration with plugin management
- `.aliases.sh` - 150+ aliases organized by category
- `.functions.sh` - Custom shell functions (take, kill_by_port, etc.)
- `.paths.sh` - PATH configuration for all tools and runtimes
- `.env` - Encrypted environment variables (SOPS + age)

#### Application Configs

- `config/ohmyposh/zen.json` - Custom Oh My Posh theme
- `git/.gitconfig` - Modern Git configuration with delta integration
- `tmux/.tmux.conf` - Terminal multiplexer configuration
- `vim/.vimrc` - Vim editor configuration
- `direnv/.direnvrc` - Project environment management

### GitHub Actions CI/CD

#### Validation Workflow

- **Multi-platform testing**: Ubuntu (validate job) + macOS (macos-test job)
- Shellcheck validation for all shell scripts
- shfmt formatting checks for code consistency
- JSON syntax validation (packages.json, zen.json)
- Security scanning for secrets and hardcoded paths
- Zsh syntax testing with zsh -n
- Installation script safety checks

#### Quality Gates

- Runs on push to main/develop branches
- Runs on all pull requests
- Prevents merging with validation failures
- Comprehensive error reporting with actionable messages

### Custom Functions

#### Universal Archive/Repo Handler (`take`)

- Create and enter directories with one command
- Clone git repos (https, ssh, git@ formats) and enter
- Download and extract archives (.tar.gz, .tgz, .tar.bz2, .zip)
- Proper error handling and user feedback
- Multi-format git URL support

#### Process Management (`kill_by_port`)

- Kill processes by port number
- Port validation (1-65535 range)
- Dry-run mode to preview before killing
- Help flag for usage information
- Graceful error handling

#### Other Utilities

- `extract` - Universal archive extractor
- `compress` - Create tar.gz archives
- `checkPort` - See what's running on a port
- `git_ignore_local` - Add files to local git ignore
- `confirm` - Interactive yes/no/quit prompts
- `show_tools` - Discover available modern CLI tools

### Automation

#### Installation Script (init.sh)

- **Interactive installation** with user confirmations
- macOS compatibility checks
- Xcode Command Line Tools installation
- Homebrew installation and setup
- GNU Stow installation for dotfile management
- Tool installation with category-based prompts
- SDKMAN setup for Java ecosystem
- Ballerina installation
- Zinit plugin manager setup
- Environment file encryption with SOPS + age
- Git personal configuration setup
- Automatic backup of existing dotfiles
- Symlink creation via Stow
- Installation validation with test-zsh
- Next steps and usage instructions

#### Package Management

- `manage_packages` - Interactive package configuration CLI
- `generate-brewfile` - Auto-generate Brewfile from packages.json
- Category enable/disable commands
- Individual package enable/disable
- List packages and categories
- Perfect sync between packages.json and Brewfile

### Aliases & Shortcuts

#### Navigation

- `..`, `...`, `....` - Quick directory traversal
- `c` - Clear terminal
- `cls` - Clear and list files
- `z` - Zoxide smart directory jumping

#### File Operations

- `ls`, `ll`, `la`, `lt` - Enhanced file listing with eza
- `cat` - Syntax-highlighted file viewing with bat
- `grep` - Fast search with ripgrep
- `find` - File search with fd

#### Git Workflow

- `gits`, `ga`, `gaa`, `gco`, `gb`, `gp`, `gl` - Common git operations
- `lg` - Open lazygit TUI
- `glog` - Beautiful git log with graph
- `gunstage`, `gundo`, `gcleanup` - Git utilities

#### Development

- `p3` - Python 3
- `v` - Vim
- `gwb` - Gradle build
- `use_java_17`, `use_java_21` - Java version switching

#### Tmux

- `t` - Start new tmux session
- `ta` - Attach to last session
- `tat` - Attach to named session
- `tl` - List all sessions

### Added Files

- `packages.json` - Centralized package configuration
- `Brewfile` - Homebrew package list (generated from packages.json)
- `bin/test-zsh-config` - Validation suite
- `bin/manage-packages` - Package management CLI
- `bin/generate-brewfile` - Brewfile generator
- `bin/profile-startup` - Performance profiling tool
- `lib/package-helpers.sh` - Shared package functions
- `config/ohmyposh/zen.json` - Custom Oh My Posh theme
- `.github/workflows/validate.yml` - CI/CD validation pipeline
- `zsh/.env.example` - Environment variable template
- `CLAUDE.md` - Repository analysis and status

### Changed Files

- `README.md` - Complete rewrite with comprehensive documentation
- `init.sh` - Major improvements with interactive installation
- `zsh/.zshrc` - Performance optimizations and lazy loading
- `zsh/.aliases.sh` - Expanded to 150+ aliases with documentation
- `zsh/.functions.sh` - Enhanced with better error handling
- `zsh/.paths.sh` - Improved portability with $HOME variables

### Performance Metrics

- **Shell startup**: ~0.6s (target: <1.0s) ✅ Excellent
- **Validation suite**: Comprehensive coverage of all tools and configs
- **PATH optimization**: Deduplication prevents slowdowns
- **Plugin loading**: Turbo mode for non-essential plugins

### Breaking Changes

None - This is the initial stable release (v1.0.0)

---

## [Unreleased]

### Planned Features

- Cross-platform support (Linux, WSL)
- Automated testing for custom functions
- IDE integration (VSCode, Cursor settings sync)
- Additional language support (Rust, Go, Deno)
- Cloud provider tools (AWS CLI, GCP SDK, Azure CLI)

---

[1.0.0]: https://github.com/ThisaruGuruge/dotfiles/releases/tag/v1.0.0
