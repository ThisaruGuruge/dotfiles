# Thisaru's Dotfiles

A macOS-focused developer workstation built around Zsh, Starship, modern CLI tools, and battle-tested automation. Everything is wired together with GNU Stow, encrypted secrets, and a centralized package manifest so each new machine behaves exactly like the last one.

## Highlights

- **Fast Zsh environment** – zinit-managed plugins, fzf-tab completion, syntax highlighting, autosuggestions, zoxide (via `z` command), Atuin history (Ctrl+Alt+R), and WezTerm/iTerm compatible key bindings
- **Starship prompt** – contextual Git state, Java/Node/Python/Ballerina indicators, battery/time segments, and sub-second rendering (see `PROMPT_GUIDE.md` for visuals)
- **Modern CLI stack** – eza, bat, ripgrep, fd, lazygit, tmux, direnv, atuin, gh, git-delta, git-flow, and curated helper aliases/functions (`take`, `kill_by_port`, `show_tools`, etc.)
- **Smart aliases** – Single-letter shortcuts for modern tools (`v` for bat, `g` for ripgrep, `f` for fd, `z` for zoxide) while keeping original commands for scripts
- **Language runtimes** – pyenv, rbenv, nvm, SDKMAN, and Ballerina with lazy-loading shell glue so heavy managers don't slow startup
- **Secrets handled correctly** – SOPS + age encryption, `edit_secrets` workflow, and automatic `.env` handling inside `init.sh`
- **Single source of truth** – `packages.json` powers the installer, `manage_packages` CLI, and the generated `Brewfile`
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
- Read enabled packages from `packages.json` and install them with Brew
- Offer opt-in categories (development, databases, terminals, editors, etc.)
- Install SDKMAN + Java 21 (optional) and brew-based Ballerina
- Configure Atuin, direnv, tmux, git delta, lazygit, aliases, and helper functions
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
stow zsh git tmux vim direnv .config

# Copy the env template (will be encrypted later by init/edit_secrets)
cp zsh/.env.example zsh/.env

# Reload configuration
source ~/.zshrc
```

Edit `packages.json` or use `manage_packages` (see next section) before running `brew bundle` if you want to toggle packages.

### Option 3 – Brewfile only

Already have a preferred dotfiles strategy but want the curated tools? Run `brew bundle --file=Brewfile` and manually pick pieces (Starship config, aliases, etc.). The Brewfile is 100% generated from `packages.json`, so edit the JSON + regenerate when you need changes.

## Package Management System

`packages.json` describes taps, categories, and each package (type, description, enabled flag). It keeps `init.sh`, `manage_packages`, and the Brewfile perfectly in sync.

### CLI helpers

```bash
manage_packages list                    # Show every package and status
manage_packages categories              # Show categories with counts
manage_packages enable cursor           # Toggle a single package
manage_packages enable-category editors # Toggle an entire category
./bin/generate-brewfile                 # Rebuild Brewfile from JSON
```

### Categories available

- `core` – starship, zoxide, eza, bat, ripgrep, lazygit, tmux, direnv, atuin, gh, etc.
- `security` – sops + age for encrypted secrets (always enabled)
- `development` – pyenv, rbenv, nvm (optional)
- `database` – PostgreSQL 16, Redis
- `aws`, `gcp` – cloud CLIs and helpers
- `editors` – Cursor, VS Code
- `terminals` – WezTerm, iTerm2 (casks)
- `containers` – Docker Desktop, Rancher Desktop
- `productivity` – Raycast, Rectangle, TablePlus, Alfred, Postman

Disable what you do not need, regenerate the Brewfile, then rerun the installer or `brew bundle`.

## Repository Layout & Stow Packages

| Path | Notes |
| --- | --- |
| `zsh/` | `.zshrc`, aliases, functions, paths, `.env.example` |
| `.config/` | XDG configs (`starship.toml`, `wezterm`, `lazygit`, `nvim`, `ripgrep`) |
| `git/` | `.gitconfig`, ignore rules, delta settings |
| `tmux/` | Modern tmux config + keybinds |
| `direnv/` | Project-specific environment automation |
| `bin/` | Helper scripts (`manage-packages`, `generate-brewfile`, profilers, tests) |
| `lib/` | Shared shell helpers sourced by scripts |

### WezTerm Configuration

WezTerm is configured with:
- Option key for word navigation (Option+Left/Right)
- Catppuccin Mocha theme
- FiraCode Nerd Font with ligatures
- Comprehensive keyboard shortcuts
- See `.config/wezterm/README.md` for full details

### Stow Usage & Known Issues

⚠️ **Known Bug**: GNU Stow 2.4.1 has a bug where it reports creating directory symlinks but doesn't actually create them for new directories in `.config/`. The `init.sh` script includes a workaround that manually creates these symlinks for `nvim`, `vim`, and `wezterm`.

```bash
stow zsh              # Shell config
stow .config          # Starship, lazygit, nvim, wezterm, ripgrep
stow git tmux direnv  # Git/Tmux/Direnv packages

# Remove a package
stow -D zsh
```

**Alternative**: Consider migrating to [Chezmoi](./DOTFILE_MANAGER_ALTERNATIVES.md) for a more robust dotfile management solution without symlink bugs.

## Quick Start Commands

```bash
test-zsh                                   # Full validation (tools, PATH, runtimes)
profile_startup                            # 3-run average for shell startup time
./bin/profile-zsh-startup                  # Deep component timing (Starship, zinit, SDKMAN, etc.)
help                                      # Alias documentation entry point
docs                                      # Interactive alias browser (alias_docs)
show_tools                                # Overview of installed CLI upgrades
alias_search git                          # Search for aliases by keyword
manage_packages list                      # Review package enablement
manage_packages enable-category development
edit_secrets                              # Safely edit encrypted ~/.env via SOPS
take my-service && code .                 # Smart project bootstrap / clone helper
kill_by_port 3000                         # Kill whatever binds to port 3000
lg                                         # Launch lazygit with our config
Ctrl+Alt+R                                 # Atuin search UI (history across terminals)
```

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
~/dotfiles on main [!2 +1] via ☕ 21.0.5 ⬢ v22.2.0 🐍 3.12 🩰 2201 at 18:08
❯
```

What you see:

- **Directory** – Git-aware truncation (repo root highlighted, read-only indicator for unwritable dirs)
- **Git branch/status** – Ahead/behind arrows, modified/staged counts (`!`, `+`, `?`, `📦` for stashes)
- **Runtime indicators** – Java, Node.js, Python, and Ballerina only appear inside matching projects
- **Battery/Time** – Battery icons colored by percentage and a 24h clock
- **Prompt character** – Green `❯` on success, red on failure, yellow `❮` in vim mode

Customize Starship at `~/.config/starship.toml` (stowed from `.config/starship.toml`):

```bash
code ~/.config/starship.toml      # or vim/nvim
starship explain                  # Inspect how segments render for current dir
```

The config already includes directory substitutions, repo-root formatting, and a custom Ballerina detector that stops walking at depth 5 for speed. See `PROMPT_GUIDE.md` for screenshots, troubleshooting steps, and tips on fzf-tab + Atuin integrations.

## Validation, Performance & Troubleshooting

- `test-zsh` – Runs syntax checks, ensures required tools exist (driven by `packages.json`), inspects PATH/env vars, and prints a summary with pass/warn/fail counts
- `profile_startup` – Calls `zsh -i -c exit` three times and reports average startup time with recommendations
- `./bin/profile-zsh-startup` – Detailed profiler that times individual components (Homebrew shellenv, Starship init, zinit plugins, SDKMAN, pyenv, compinit, sourcing files)
- `zsh -n ~/.zshrc` – Quick syntax validation if you edit the config
- `starship explain` – Debug what each segment is doing if the prompt looks odd
- `manage_packages list` – Confirm Brew dependencies match what you expect before running Bundle again

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
manage_packages list   # adjust packages if necessary
./bin/generate-brewfile
brew bundle --file=Brewfile
test-zsh               # sanity check after upgrades
```

Remember to `stow -D` packages you no longer want and re-run `stow` after pulling to ensure new configs are linked.

## Contributing

Bug reports and PRs are welcome! Please run `test-zsh` plus any relevant profilers before opening a pull request. See `CONTRIBUTING.md` for commit conventions, scopes (including `prompt` for Starship changes), and validation expectations.

Happy hacking! 🚀
