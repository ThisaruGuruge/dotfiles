# Thisaru's Dotfiles

A macOS-focused developer workstation built around Zsh, Powerlevel10k, modern CLI tools, and battle-tested automation. Everything is wired together with GNU Stow, encrypted secrets, and a centralized package manifest so each new machine behaves exactly like the last one.

## Highlights

- **Fast Zsh environment** – zinit-managed plugins, fzf-tab completion, syntax highlighting, autosuggestions, zoxide (via `z` command), Atuin history (Ctrl+R and up-arrow), and WezTerm compatible key bindings
- **Powerlevel10k prompt** – pure-Zsh rendering (no binary subprocess per draw), instant prompt on startup, contextual Git state, Go/Java/Python/Ballerina indicators, transient prompt for clean scrollback, full Catppuccin Mocha theme matching the tmux status bar
- **Modern CLI stack** – eza, bat, ripgrep, fd, yazi (with inline image previews in WezTerm/iTerm2, chafa fallback for other terminals), jless, lazygit, lazydocker, tmux, direnv, atuin, gh, git-delta, gng (`gw`), and curated helper aliases/functions (`take`, `kill_by_port`, `show_tools`, etc.)
- **Smart aliases** – Single-letter shortcuts for modern tools (`v` for bat, `g` for ripgrep, `f` for fd, `z` for zoxide) while keeping original commands for scripts
- **Suffix aliases** – Automatically open files with the right tool based on extension (`.md` → mdcat, `.json`/`.yaml` → jless, `.py`/`.sh`/`.bal` → $EDITOR)
- **Language runtimes** – pyenv, rbenv, nvm, SDKMAN, and Ballerina with lazy-loading shell glue so heavy managers don't slow startup
- **Touch ID for sudo** – Use your fingerprint instead of typing passwords in the terminal (works inside tmux too via `pam-reattach`)
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
5. **Nerd Font** – Needed for icons in Powerlevel10k/lazygit:
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
- Enable Touch ID for sudo (with tmux support via `pam-reattach`)
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

Already have a preferred dotfiles strategy but want the curated tools? Run `brew bundle --file=Brewfile` and manually pick pieces (aliases, functions, etc.). Edit the Brewfile directly or use the category files in `packages/` to customize your installation.

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

- `core` – powerlevel10k, zoxide, eza, bat, ripgrep, lazygit, lazydocker, tmux, direnv, atuin, gh, etc.
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
| `config/.config/` | XDG configs (`wezterm`, `lazygit`, `nvim`, `yazi`, `ripgrep`) |
| `zsh/.p10k.zsh` | Powerlevel10k prompt config (Catppuccin Mocha, stowed to `~/.p10k.zsh`) |
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
stow --no-folding zsh              # Shell config (includes .p10k.zsh)
stow --no-folding config           # lazygit, nvim, wezterm, ripgrep, yazi
stow --no-folding git tmux direnv  # Git/Tmux/Direnv packages

# Remove a package
stow -D zsh
```

**Alternative**: For cross-platform dotfile management, consider [Chezmoi](https://www.chezmoi.io/).

## Quick Start Commands

```bash
test-zsh                                   # Full validation (tools, PATH, runtimes)
./bin/profile-zsh-startup                  # Deep component timing (zinit plugins, SDKMAN, p10k, etc.)
help                                       # Alias documentation entry point
docs                                       # Interactive alias browser (alias_docs)
show_tools                                 # Overview of installed CLI upgrades
alias_search git                           # Search for aliases by keyword
edit_secrets                               # Safely edit encrypted ~/.env via SOPS
take my-service && code .                  # Smart project bootstrap / clone helper
kill_by_port 3000                          # Kill whatever binds to port 3000
lg                                         # Launch lazygit with our config
lzd                                        # Launch lazydocker for Docker management
gw build                                   # Run Gradle build from any subdirectory
gwt                                        # Alias for: gw test
gwc                                        # Alias for: gw clean
gwcb                                       # Alias for: gw clean build
Ctrl+R                                     # Atuin search UI (fuzzy search all history)
Up arrow                                   # Atuin prefix search (as you type)
```

## Suffix Aliases

Zsh suffix aliases automatically open files based on their extension. Just type the filename and press Enter:

```bash
# Viewing files (rendered markdown)
README.md                                  # Opens in mdless with rendered Markdown
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
| `.md` | `mdcat -p` | View rendered Markdown with paging |
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
- Use `edit_secrets` (wrapper defined in `.functions.d/06-dotfiles.zsh`) to decrypt, open your `$EDITOR`, and re-encrypt on save.
- Manual commands:
  ```bash
  sops -d ~/.env | less            # View decrypted env
  sops ~/.env                      # Edit directly
  export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
  ```
- The template at `zsh/.env.example` is copied when you first run `init.sh`; extend it if you need new keys for future machines.

## Touch ID for sudo

The installer configures macOS to accept Touch ID (fingerprint) for `sudo` prompts in the terminal. This uses `/etc/pam.d/sudo_local`, which persists across macOS system updates (unlike editing `/etc/pam.d/sudo` directly).

**tmux support**: The `pam-reattach` brew package is included so Touch ID also works inside tmux sessions — without it, macOS cannot reach the biometric sensor from a reattached session.

After running `init.sh`, any `sudo` command will show the Touch ID prompt first and fall back to password if dismissed.

To enable manually (without `init.sh`):

```bash
brew install pam-reattach

# Create /etc/pam.d/sudo_local (requires sudo)
sudo tee /etc/pam.d/sudo_local <<'EOF'
# sudo_local: local config for sudo (persists across macOS updates)
auth       optional       /opt/homebrew/lib/pam/pam_reattach.so
auth       sufficient     pam_tid.so
EOF
```

> **Note**: On Intel Macs, replace `/opt/homebrew/lib/pam/pam_reattach.so` with `/usr/local/lib/pam/pam_reattach.so`.

## Powerlevel10k Prompt

Sample prompt (top line + prompt character on line 2):

```
 ~/dotfiles  main !+   Go 1.23.4
❯
```

What you see:

- **Directory** – truncated to last component, lock icon for read-only dirs
- **Git branch/status** – always blue; dirty state shown by icons (`!` modified, `+` staged, `?` untracked, `*` stash, `⇣⇡` ahead/behind) — no colour change on dirty, no blocking git subprocess
- **Runtime indicators** – Go, Java, Python, and Ballerina only appear inside matching projects; all read versions via async gitstatus-style checks, never blocking the prompt
- **Command duration** – shown on the right only when the previous command took > 2 seconds
- **Prompt character** – `❯` green on success, red on failure; `❮` in Vim normal mode
- **Transient prompt** – after a command runs, the previous prompt collapses to just `❯` in scrollback

**Design principle**: The prompt shows *command context* (where you are, git state, language). The tmux status bar shows *session context* (session name, sysinfo, battery, time). Nothing is duplicated between the two layers.

Customize the prompt at `~/.p10k.zsh` (stowed from `zsh/.p10k.zsh`):

```bash
nvim ~/dotfiles/zsh/.p10k.zsh     # Edit directly — hot-reloads automatically
p10k configure                    # Interactive wizard (overwrites the file)
```

The Catppuccin Mocha palette used by the prompt matches the tmux status bar exactly — same background (`#1e1e2e`), same blue (`#89b4fa`), same green (`#a6e3a1`), same accent colors throughout.

## Validation, Performance & Troubleshooting

- `test-zsh` – Runs syntax checks, ensures required tools exist, inspects PATH/env vars, and prints a summary with pass/warn/fail counts
- `./bin/profile-zsh-startup` – Detailed profiler that times individual components (Homebrew shellenv, zinit plugins, SDKMAN, pyenv, compinit, sourcing files)
- `zsh -n ~/.zshrc` – Quick syntax validation if you edit the config
- `zsh -n ~/.p10k.zsh` – Validate prompt config syntax without sourcing it
- `brew bundle check` – Confirm Brew dependencies match Brewfile before running Bundle again

Common fixes:

```bash
source ~/.zshrc                               # Reload everything after edits
rm -rf ~/.local/share/zinit && bash -c "$(curl -fsSL https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"  # Reinstall zinit if plugins fail
which fzf zoxide atuin direnv                 # Confirm core binaries are on PATH
p10k configure                                # Re-run the interactive prompt wizard
```

Fonts missing? Re-open the terminal and ensure your profile uses a Nerd Font. Icons rendering as boxes means the font doesn't include Nerd Font glyphs — install a patched font (e.g. FiraCode Nerd Font) and set it in your terminal profile.

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

Bug reports and PRs are welcome! Please run `test-zsh` plus any relevant profilers before opening a pull request. See `CONTRIBUTING.md` for commit conventions, scopes (including `prompt` for p10k changes), and validation expectations.

Happy hacking!
