# Thisaru's Dotfiles

A macOS-focused developer workstation built around Zsh, Starship, modern CLI tools, and battle-tested automation. Everything is wired together with GNU Stow, encrypted secrets, and a centralized package manifest so each new machine behaves exactly like the last one.

## Highlights

- **Fast Zsh environment** – zinit-managed plugins, fzf-tab completion, syntax highlighting, autosuggestions, zoxide (via `z` command), Atuin history (Ctrl+R and up-arrow), and WezTerm compatible key bindings
- **Starship prompt** – contextual Git state, Java/Node/Python/Ballerina indicators, battery/time segments, and sub-second rendering (see `PROMPT_GUIDE.md` for visuals)
- **Modern CLI stack** – eza, bat, ripgrep, fd, jless, lazygit, lazydocker, tmux, direnv, atuin, gh, git-delta, git-flow, and curated helper aliases/functions (`take`, `kill_by_port`, `show_tools`, etc.)
- **Smart aliases** – Single-letter shortcuts for modern tools (`v` for bat, `g` for ripgrep, `f` for fd, `z` for zoxide) while keeping original commands for scripts
- **Suffix aliases** – Automatically open files with the right tool based on extension (`.md` → bat, `.json`/`.yaml` → jless, `.py`/`.sh`/`.bal` → $EDITOR)
- **Language runtimes** – pyenv, rbenv, nvm, SDKMAN, and Ballerina with lazy-loading shell glue so heavy managers don't slow startup
- **Secrets handled correctly** – SOPS + age encryption, `edit_secrets` workflow, and automatic `.env` handling inside `init.sh`
- **Brewfile-driven** – Curated `Brewfile` with optional category files in `packages/` for modular installation
- **Validation + profiling** – `test-zsh` integration tests, `profile_startup` quick timing, and `bin/profile-zsh-startup` for deep dives

## Prerequisites

1. **macOS** – Tested on Sonoma/Ventura (Apple Silicon friendly)
2. **Git** – Already on macOS, confirm with `git --version`
3. **Homebrew** – Install if missing:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
4. **Terminal** – WezTerm (recommended and configured), iTerm2, or Terminal.app all work
5. **Nerd Font** – Needed for icons in Starship/lazygit:
   ```bash
   brew install --cask font-fira-code-nerd-font
   ```
   Set the font once inside your terminal profile (Appearance/Text settings).

## Installation

### Option 1 – Automated (`init.sh`)

```bash
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
cd ~/dotfiles
./init.sh
```

The script is interactive; it will:

- Validate macOS + Xcode CLT, install Homebrew, jq, GNU Stow
- Install core packages from `Brewfile` with Brew
- Offer opt-in categories (development, databases, terminals, editors, etc.)
- Install SDKMAN + Java 21 (optional) and brew-based Ballerina
- Configure Atuin, direnv, tmux, git delta, lazygit, lazydocker, aliases, and helper functions
- Generate/restore encrypted `.env` with SOPS + age (keys stored at `~/.config/sops/age/keys.txt`)
- Create Nerd Font + terminal integrations
- Back up existing dotfiles and symlink everything via Stow
- Test the install with `test-zsh` and show next steps

### Option 2 – Manual setup

```bash
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Install everything that is currently enabled in Brewfile
brew bundle --file=Brewfile

# Stow the packages you need (add/remove as desired)
stow --no-folding zsh git tmux vim direnv config

# Copy the env template (will be encrypted later by init/edit_secrets)
cp zsh/.env.example zsh/.env

# Reload configuration
source ~/.zshrc
```

Edit the `Brewfile` directly or use category Brewfiles in `packages/` before running `brew bundle` if you want to customize packages.

### Option 3 – Brewfile only

Already have a preferred dotfiles strategy but want the curated tools? Run `brew bundle --file=Brewfile` and manually pick pieces (Starship config, aliases, etc.). Edit the Brewfile directly or use the category files in `packages/` to customize your installation.

## Package Management

The main `Brewfile` contains core packages that are always installed. Optional packages are organized into category files in `packages/`:

```bash
packages/
├── cloud.brewfile       # AWS, GCP CLIs
├── containers.brewfile  # Docker, Rancher Desktop
├── databases.brewfile   # PostgreSQL, Redis
├── development.brewfile # pyenv, rbenv, nvm
├── editors.brewfile     # Cursor, VS Code
├── productivity.brewfile # Raycast, Rectangle, etc.
└── terminals.brewfile   # WezTerm, iTerm2
```

### Installing optional categories

```bash
brew bundle --file=Brewfile                      # Core packages
brew bundle --file=packages/development.brewfile # Add dev tools
brew bundle --file=packages/editors.brewfile     # Add editors
```

### Categories available

- `core` – starship, zoxide, eza, bat, ripgrep, lazygit, lazydocker, tmux, direnv, atuin, gh, etc.
- `security` – sops + age for encrypted secrets (always enabled)
- `development` – pyenv, rbenv, nvm (optional)
- `database` – PostgreSQL 16, Redis
- `aws`, `gcp` – cloud CLIs and helpers
- `editors` – Cursor, VS Code
- `terminals` – WezTerm, iTerm2 (casks)
- `containers` – Docker Desktop, Rancher Desktop
- `productivity` – Raycast, Rectangle, TablePlus, Alfred, Postman

Comment out what you do not need in the Brewfile, then rerun `brew bundle`.

## Repository Layout & Stow Packages

| Path | Notes |
| --- | --- |
| `zsh/` | `.zshrc`, `.zshrc.d/` (modular shell config), `.functions.d/` (modular functions), aliases, paths |
| `zsh/.zshrc.d/` | 7 modules: plugins, completion, keybindings, history, integrations, environment, tmux |
| `zsh/.functions.d/` | 9 modules: colors, core, navigation, archives, git, system, dotfiles, docs, packages |
| `config/.config/` | XDG configs (`starship.toml`, `wezterm`, `lazygit`, `nvim`, `ripgrep`) |
| `git/` | `.gitconfig`, ignore rules, delta settings |
| `tmux/` | Modern tmux config + keybinds |
| `direnv/` | Project-specific environment automation |
| `packages/` | Optional category Brewfiles (cloud, containers, databases, etc.) |
| `bin/` | Helper scripts (`test-zsh-config`, `profile-zsh-startup`, `audit-configs`, `adopt-config`) |
| `docs/` | Additional documentation (prompt guide, tmux keybindings, config management) |

### WezTerm Configuration

WezTerm is configured with:
- Option key for word navigation (Option+Left/Right)
- Catppuccin Mocha theme
- FiraCode Nerd Font with ligatures
- Comprehensive keyboard shortcuts (Cmd+D for split, vim-style copy mode)
- Tmux integration for pane splitting

### Stow Usage

This repo uses GNU Stow with the `--no-folding` flag to ensure reliable symlink creation. This prevents directory folding issues where Stow might replace directories with symlinks.

```bash
stow --no-folding zsh              # Shell config
stow --no-folding config           # Starship, lazygit, nvim, wezterm, ripgrep
stow --no-folding git tmux direnv  # Git/Tmux/Direnv packages

# Remove a package
stow -D zsh
```

**Alternative**: For cross-platform dotfile management, consider [Chezmoi](https://www.chezmoi.io/).

## Quick Start Commands

```bash
test-zsh                                   # Full validation (tools, PATH, runtimes)
./bin/profile-zsh-startup                  # Deep component timing (Starship, zinit, SDKMAN, etc.)
help                                       # Alias documentation entry point
docs                                       # Interactive alias browser (alias_docs)
show_tools                                 # Overview of installed CLI upgrades
alias_search git                           # Search for aliases by keyword
edit_secrets                               # Safely edit encrypted ~/.env via SOPS
take my-service && code .                  # Smart project bootstrap / clone helper
kill_by_port 3000                          # Kill whatever binds to port 3000
lg                                         # Launch lazygit with our config
lzd                                        # Launch lazydocker for Docker management
Ctrl+R                                     # Atuin search UI (fuzzy search all history)
Up arrow                                   # Atuin prefix search (as you type)
```

## Suffix Aliases

Zsh suffix aliases automatically open files based on their extension. Just type the filename and press Enter:

```bash
# Viewing files (read-only, syntax-highlighted)
README.md                                  # Opens in bat with Markdown highlighting
data.json                                  # Opens in jless (interactive JSON viewer)
config.yaml                                # Opens in jless (interactive YAML viewer)

# Editing files (opens in $EDITOR/nvim)
script.py                                  # Opens Python files in nvim
setup.sh                                   # Opens shell scripts in nvim
service.bal                                # Opens Ballerina files in nvim
app.conf                                   # Opens config files in nvim
```

**Supported extensions:**

| Extension | Tool | Purpose |
|-----------|------|---------|
| `.md` | `bat` | View Markdown with syntax highlighting |
| `.json` | `jless` | Interactive JSON browsing with folding |
| `.yaml`, `.yml` | `jless` | Interactive YAML browsing |
| `.py` | `$EDITOR` | Edit Python files |
| `.sh`, `.bash`, `.zsh` | `$EDITOR` | Edit shell scripts |
| `.bal` | `$EDITOR` | Edit Ballerina files |
| `.conf`, `.config`, `.ini` | `$EDITOR` | Edit configuration files |

The default editor is set to `nvim` via the `$EDITOR` environment variable in `.zshenv`.

## Secret Management (SOPS + age)

- Keys live at `~/.config/sops/age/keys.txt` and are created by `init.sh`. Backup that file somewhere safe.
- Secrets live in `~/.env` (ignored by git). They remain encrypted on disk and are transparently decrypted by the shell when sourced.
- Use `edit_secrets` (wrapper defined in `.functions.sh`) to decrypt, open your `$EDITOR`, and re-encrypt on save.
- Manual commands:
  ```bash
  sops -d ~/.env | less            # View decrypted env
  sops ~/.env                      # Edit directly
  export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
  ```
- The template at `zsh/.env.example` is copied when you first run `init.sh`; extend it if you need new keys for future machines.

## Starship Prompt

Sample prompt:

```
~/dotfiles on main [!2 +1] via JAVA 21.0.5 NODE v22.2.0 PY 3.12 BAL 2201 at 18:08
>
```

What you see:

- **Directory** – Git-aware truncation (repo root highlighted, read-only indicator for unwritable dirs)
- **Git branch/status** – Ahead/behind arrows, modified/staged counts (`!`, `+`, `?`, stash indicator)
- **Runtime indicators** – Java, Node.js, Python, and Ballerina only appear inside matching projects
- **Battery/Time** – Battery icons colored by percentage and a 24h clock
- **Prompt character** – Green `>` on success, red on failure, yellow `<` in vim mode

Customize Starship at `~/.config/starship.toml` (stowed from `.config/starship.toml`):

```bash
code ~/.config/starship.toml      # or vim/nvim
starship explain                  # Inspect how segments render for current dir
```

The config already includes directory substitutions, repo-root formatting, and a custom Ballerina detector that stops walking at depth 5 for speed. See `PROMPT_GUIDE.md` for screenshots, troubleshooting steps, and tips on fzf-tab + Atuin integrations.

## Validation, Performance & Troubleshooting

- `test-zsh` – Runs syntax checks, ensures required tools exist, inspects PATH/env vars, and prints a summary with pass/warn/fail counts
- `./bin/profile-zsh-startup` – Detailed profiler that times individual components (Homebrew shellenv, Starship init, zinit plugins, SDKMAN, pyenv, compinit, sourcing files)
- `zsh -n ~/.zshrc` – Quick syntax validation if you edit the config
- `starship explain` – Debug what each segment is doing if the prompt looks odd
- `brew bundle check` – Confirm Brew dependencies match Brewfile before running Bundle again

Common fixes:

```bash
source ~/.zshrc                               # Reload everything after edits
rm -rf ~/.local/share/zinit && bash -c "$(curl -fsSL https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"  # Reinstall zinit if plugins fail
starship --version                            # Verify Starship is installed
which starship fzf zoxide atuin direnv        # Confirm core binaries are on PATH
defaults write com.googlecode.iterm2 PrefsCustomFolder -string "$HOME" # Re-apply terminal font settings if needed
```

Fonts missing? Re-open the terminal and ensure your profile uses a Nerd Font. Prompt misaligned? Run `starship explain` or `starship prompt` to inspect errors (most often caused by missing fonts or malformed config).

## Keeping Dotfiles Updated

```bash
cd ~/dotfiles
git pull origin main
brew bundle --file=Brewfile  # Install any new packages
test-zsh                     # Sanity check after upgrades
source ~/.zshrc              # Reload shell config
```

Remember to `stow -D` packages you no longer want and re-run `stow` after pulling to ensure new configs are linked.

## Contributing

Bug reports and PRs are welcome! Please run `test-zsh` plus any relevant profilers before opening a pull request. See `CONTRIBUTING.md` for commit conventions, scopes (including `prompt` for Starship changes), and validation expectations.

Happy hacking!
