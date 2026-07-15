# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Documented built-in `]l`/`[l` (and `]L`/`[L`) location-list navigation, with which-key labels in `plugins/editor.lua` — clarifies that `gO` (LSP document symbols) opens a location list, not the quickfix list, so `]q`/`[q` don't apply to it
- Added `<leader>fS` for project-wide symbol search (`Telescope lsp_dynamic_workspace_symbols`) — look up a struct/function/class by name across the whole workspace and jump straight to its definition
- Set `gopls` `symbolScope = "workspace"` — restricts `<leader>fS` in Go projects to the current module's own packages, excluding dependencies and the stdlib

### Changed

- Repointed the `v` alias from the `bat`/`mdcat` wrapper function to `nvim` — the wrapper saw little use; `bat` remains available directly under its own name

## [2.0.0] - 2026-07-14

### Added

- Added **Powerlevel10k** as the shell prompt (replaces Starship); loaded as the first zinit plugin for correct instant-prompt initialization
- Added `zsh/.p10k.zsh` — full Catppuccin Mocha themed prompt config with Catppuccin Mocha palette matching the tmux status bar
- Added Go version segment (`go_version`) to the prompt — only appears inside Go projects
- Added custom Ballerina segment (`p10k_ballerina`) — reads version from `~/.ballerina/ballerina-version` using zsh builtins only (zero subprocesses), shows only when `Ballerina.toml` is present in `$PWD`
- Added **transient prompt** (`POWERLEVEL9K_TRANSIENT_PROMPT=always`): previous prompts collapse to a single `❯` in scrollback, keeping the terminal history clean
- Added `bin/tmux-status-sysinfo` — lightweight tmux helper that reports 1-minute load average and RAM usage (`used/total`) using `sysctl` + `vm_stat`
- Added `bin/tmux-status-battery` — smart battery script with per-level Nerd Font icons and charging indicator, using a single `pmset` call
- Added `mini.ai` for enhanced text objects: smarter `a`/`i` with identifiers for function calls (`f`), arguments (`a`), any bracket (`b`), any quote (`q`), HTML tags (`t`), and interactive pairs (`?`)
- Added `nvim-neoclip.lua` for clipboard/yank history: browse and paste from history via Telescope (`<leader>fy`)
- Replaced `nvim-cmp` with `blink.cmp` for completions: faster Rust-based fuzzy matching, built-in signature help (auto-shows parameter info when typing inside function args), and auto-show documentation popup alongside completions
- Added `trouble.nvim` diagnostics panel (`<leader>xx` for workspace diagnostics, `<leader>xs` for symbols, `<leader>xr` for LSP references)
- Added aerial.nvim breadcrumb component to lualine statusline (shows current function/symbol path)
- Added `todo-comments.nvim` for highlighted TODO/FIXME/HACK/NOTE comments with Telescope search (`<leader>ft`) and Trouble integration (`<leader>xt`), plus `]t`/`[t` navigation
- Added `flash.nvim` for lightning-fast jump/motion navigation (`s` to jump, `S` for treesitter select, enhances `/` search and `f`/`t` motions with labels)
- Added `alpha-nvim` dashboard as Neovim start screen with quick-action buttons (Find File, Recent Files, Grep, Explorer, Lazy)
- Added `aerial.nvim` code outline sidebar (`<leader>a` to toggle, `{`/`}` to navigate symbols)
- Added Ballerina language support: tree-sitter syntax highlighting (`tree-sitter-ballerina`) and LSP via `bal start-language-server`
- Improved Neovim lualine: relative file path, git diff stats, LSP diagnostics, LSP server name, search count, encoding/format, macro recording indicator, indent style, word count (markdown/text), file size, Lazy update count
- Added tmux quality-of-life settings: `detach-on-destroy off`, OSC 52 clipboard, 50k scrollback, faster status refresh
- Added tmux keybindings: quick window/session toggle, pane swapping, break-pane, lazygit popup
- Added tmux plugins: `tmux-open` (open files/URLs from copy mode), `tmux-sessionist` (session management), `tmux-fzf` (fuzzy finder)
- Added `undotree` Neovim plugin for visual undo history navigation (`<leader>u`)
- Added Touch ID for sudo authentication via `/etc/pam.d/sudo_local` (persists across macOS updates)
- Added `pam-reattach` to Brewfile for Touch ID support inside tmux sessions
- Added Touch ID validation checks to `test-zsh-config`
- Added `yazi` terminal file manager with full configuration (`yazi.toml`, `keymap.toml`, `theme.toml`, `init.lua`)
- Added `yazi.nvim` as the Neovim file explorer (replaces Neo-tree)
- Added `y()` shell wrapper for yazi with cd-on-exit support
- Added yazi plugins: smart-enter, smart-filter, smart-paste, full-border, git, chmod, diff, jump-to-char, mactag, mime-ext
- Added yazi preview dependencies to Brewfile (ffmpegthumbnailer, poppler, imagemagick, unar)
- Added yazi file-type open rules for common extensions (md, json, yaml, sh, lua, bal, java, py, js, ts, etc.)
- Added `reveal` opener for Reveal in Finder (macOS)
- Added rose-pine flavor for yazi (matches Neovim theme)
- Added tmux `allow-passthrough` for yazi image preview support
- Added `docs/YAZI_KEYBINDINGS.md` with full keybinding reference
- Added `glow` for terminal markdown rendering (Brewfile, suffix aliases, test suite) — later replaced by mdcat, see Changed
- New suffix aliases for `.markdown` and `.mdx` extensions
- `md` alias for quick markdown viewing
- `readme` function to view README in current directory
- `mdp` function for fzf-powered markdown file browsing with live preview
- Added **treesitter-based code folding**: `za` toggle, `zc`/`zo` close/open, `zM`/`zR` collapse/expand all — works across every treesitter language (JSON objects/arrays, functions, classes, blocks, etc.). Folds start open (`foldlevel = 99`)
- Added **JSON path display in statusline**: when editing a JSON file, the lualine center section now shows the treesitter-computed path to the element under the cursor (e.g. `root.packages[4].name`), including array indices — implemented as a custom treesitter tree-walker in `lua/thisarug/json_path.lua`
- Added **chafa** — image-to-text/sixel renderer used by yazi as a fallback image preview backend for terminals that don't support the Kitty or iTerm2 inline image protocols. Native protocols (Kitty in WezTerm, iTerm2 in iTerm2) are preferred and work through tmux via the existing `allow-passthrough on` tmux config
- Added **harper-ls** — grammar and spell checker for prose in code comments and Markdown files (offline, Rust-based, via Mason)
- Added **typos-lsp** — low-false-positive typo detection in identifiers, strings, and comments across all languages (e.g. `getRepsone` → `getResponse`); shown as hints to avoid drowning real errors
- Added `<leader>z` spell/grammar keybinding group: `<leader>zn` (next), `<leader>zp` (previous), `<leader>zf` (fix menu), `<leader>zu` (add to user/global dictionary), `<leader>zw` (add to workspace/project dictionary)
- Added `config/.config/typos/_typos.toml` — global user-level typos config (stow-managed, project `_typos.toml` overrides); wired into typos-lsp via `init_options.config`
- Added **GNG (`gw`)** — Gradle run-anywhere wrapper (`gdubw/gng`): finds `gradlew` anywhere up the directory tree, eliminating the need to `cd` to project root before running Gradle tasks
  - Removed the old `gw='./gradlew --max-workers=6'` alias that shadowed the binary
  - Updated `gwb`, `gwc`, `gwt`, `gwcb` aliases to use `gw` so they work from any subdirectory
- Added **tmux floating popups** for quick access without leaving context:
  - `prefix + t` — floating terminal in current directory
  - `prefix + N` — floating scratchpad (`~/.scratch.md`)
  - `prefix + S` — new session creator (name + directory prompt)
  - `prefix + ?` — command palette: fuzzy search and execute any tmux keybinding (fzf-powered)
  - `Ctrl+f` — upgraded project sessionizer to use popup instead of new window
- Added `tmux/.local/bin/tmux-session-creator` — interactive script for creating named tmux sessions from a popup
- Added `tmux/.local/bin/tmux-palette` + `tmux-palette-entries` — fzf-powered command palette for tmux keybindings (fuzzy search, categorized entries with comments, execute on select)
- Added popup border styling (blue, rounded) matching Catppuccin Mocha theme
- Added **[marks.nvim](https://github.com/chentoast/marks.nvim)** — sign-column indicators and extra navigation for Vim's built-in marks: `m,` set next available mark, `m;` toggle mark, `m]`/`m[` next/previous mark, `m:` preview mark, `dm-`/`dm<space>` delete marks on line/buffer

### Changed

- **Redesigned tmux status bar** for harmony with the new prompt:
  - Removed git branch from status-right (it lives in the prompt — no duplication, no polling subprocess)
  - Replaced ad-hoc battery logic with `bin/tmux-status-battery` (single `pmset` call, smart icons)
  - Replaced ad-hoc sysinfo with `bin/tmux-status-sysinfo` (load avg + RAM, zsh+awk, no Python)
  - Changed date format to `%a %d %b` (e.g. `Thu 13 Mar`) — more human-readable than `%Y-%m-%d`
  - Reduced `status-right-length` from 250 to 120
- **Prompt information architecture**: prompt shows command context (dir, git, language, duration); tmux shows session context (session name, pane count, sysinfo, battery, time) — no duplication between layers
- VCS segment always uses blue background regardless of dirty/clean state — dirty state is shown via icons (`!+?`) rather than a jarring colour change
- Replaced Neo-tree with yazi.nvim for file exploration in Neovim (`<leader>e`, `<leader>o`, `<leader>-`, `<leader>cw`)
- Replaced the legacy Oh My Posh prompt with the current Starship configuration, including new docs and tooling updates
- **Tmux session switcher (`prefix + s`)**: moved the inline fzf one-liner into `tmux/.local/bin/tmux-session-switcher` (replaces the built-in `choose-tree`, which was showing a corrupted/empty popup on resurrected sessions). Sessions are now listed oldest-first by creation time (previously alphabetical), and each of the first 9 sessions gets a number shortcut — pressing `1`-`9` jumps straight to that session, mirroring the bracketed shortcut keys `choose-tree` used to show
- Replaced **glow** with **mdcat** as the terminal markdown renderer: suffix aliases (`.md`, `.markdown`, `.mdx`), `md` alias, `readme()`, and `mdp()` now use `mdcat`/`mdless`; removed the `glow` stow package
- **Migrated Ballerina support to the [ballerina.nvim](https://github.com/redpierrot/ballerina.nvim) plugin**, replacing the ad hoc `vim-ballerina` + custom `lua/thisarug/ballerina.lua` + `after/ftplugin/ballerina.lua` setup (same package-aware `bal format` and brace/paren `indentexpr` logic, now maintained upstream). Also gains `:BallerinaRun`/`:BallerinaTest`/`:BallerinaBuild` with quickfix-integrated diagnostics, automatic nvim-dap debug configs, and `:checkhealth ballerina`. Added buffer-local keymaps `<leader>br`/`bb`/`bt`/`bf`/`bF` for Run/Build/Test/Format/Format-toggle

### Performance

- **Migrated shell prompt from Starship to Powerlevel10k**: eliminates the ~200-280ms per-render cost of spawning a binary process on every prompt draw. p10k is pure Zsh with no subprocess overhead per render
- **Enabled p10k instant prompt**: cached prompt renders immediately on shell startup while the rest of `.zshrc` loads in the background — visually instant shell open
- **Fixed atuin 1-2 second delay on up-arrow**: disabled `update_check` in atuin config to stop the network round-trip that occurred on every atuin invocation
- **Enabled `git core.fsmonitor` and `core.untrackedCache` globally**: reduced `git status` from ~268ms to ~37ms (7× speedup) via macOS FSEvents daemon

### Fixed

- Fixed `<C-f>` clash: tmux project sessionizer moved from `bind-key -n C-f` to `bind-key f` (`prefix + f`) to unblock Neovim's blink.cmp `<C-f>` doc-scroll binding

### Removed

- Removed **tmux auto-project sessions** (`07-tmux-sessions.zsh`) — the `chpwd` hook that prompted on every `cd` into a git repo is replaced by the intentional `prefix + S` session creator popup
- Removed `node_version` from prompt (Node.js is not a primary language in this stack)
- Removed time/clock from the prompt (it lives in the tmux status bar — no duplication)
- Removed the old `config/ohmyposh/zen.json` theme files in favor of `.config/starship.toml`

### Documentation

- Updated `README.md`: replaced Starship prompt section with Powerlevel10k, updated tool stack, troubleshooting commands, and stow package references
- Updated `bin/test-zsh-config`: replaced Starship validation with Powerlevel10k checks
- Rewrote `README.md` to describe the Starship prompt, SOPS workflow, and package manager updates
- Updated helper scripts and contribution guidelines to point to the Starship config instead of the removed Oh My Posh theme

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
- Dynamic testing based on Brewfile configuration
- GitHub Actions CI/CD with shellcheck, shfmt, JSON validation, and security scanning

#### Package Management System

- **Brewfile-based package management** with optional category files
- Category-based organization in `packages/` (cloud, containers, databases, etc.)
- Core packages in main Brewfile, optional packages in category files
- Modular installation: install only what you need

#### Performance Optimizations

- **Fast shell startup** (~0.6s) with lazy loading strategies
- NVM lazy loading - PATH added immediately, full NVM loads on demand
- Zinit turbo mode for non-essential plugins
- PATH deduplication to prevent slow lookups
- Performance profiling tool (bin/profile-startup)

#### Starship Prompt

- **Context-aware prompt** with language runtime indicators
- Java, Node.js, Python, Ballerina version display
- Git status with file changes, staged files, stash count
- Path truncation with git-aware display
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

- **Shell startup**: ~0.6s (target: <1.0s) - Excellent
- **Validation suite**: Comprehensive coverage of all tools and configs
- **PATH optimization**: Deduplication prevents slowdowns
- **Plugin loading**: Turbo mode for non-essential plugins

### Breaking Changes

None - This is the initial stable release (v1.0.0)

---

## Roadmap

Potential future enhancements:

- Cross-platform support (Linux, WSL)
- Automated testing for custom functions
- IDE integration (VSCode, Cursor settings sync)
- Additional language support (Rust, Go, Deno)

---

[2.0.0]: https://github.com/ThisaruGuruge/dotfiles/releases/tag/v2.0.0
[1.0.0]: https://github.com/ThisaruGuruge/dotfiles/releases/tag/v1.0.0
