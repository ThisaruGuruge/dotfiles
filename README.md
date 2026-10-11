# Thisaru's Dotfiles

A macOS-focused developer workstation built around Zsh, Powerlevel10k, modern CLI tools, and battle-tested automation. Everything is wired together with [`bestow`](https://github.com/redpierrot/bestow) (a Go-based GNU Stow successor), encrypted secrets, and a centralized package manifest so each new machine behaves exactly like the last one.

## Highlights

- **Fast Zsh environment** – zinit-managed plugins, fzf-tab completion, syntax highlighting, autosuggestions, zoxide (via `z` command), Atuin history (Ctrl+R and up-arrow), and Ghostty compatible key bindings
- **Powerlevel10k prompt** – pure-Zsh rendering (no binary subprocess per draw), instant prompt on startup, contextual Git state, Go/Java/Python/Ballerina indicators, transient prompt for clean scrollback, full Catppuccin Mocha theme matching the tmux status bar
- **Modern CLI stack** – eza, bat, dust, ripgrep, fd, yazi (with inline image previews in Ghostty/iTerm2, chafa fallback for other terminals), jless, lazygit, lazydocker, tmux, direnv, atuin, gh, git-delta, gng (`gw`), and curated helper aliases/functions (`take`, `kill_by_port`, `show_tools`, etc.)
- **Debugging in Neovim** – nvim-dap with a DAP UI, inline variable values while stepping, and one keymap set (`<leader>d…` plus `F5`/`F10`/`F11`) shared by every language. Go (delve) supports debugging the test under the cursor, launching the program with arguments, and attaching to a remote `dlv --headless`; Python, Java, and Ballerina are wired in too. Adding another debugger is a single drop-in file — see [Adding a Debugger](CLAUDE.md#adding-a-debugger-nvim-dap)
- **Go tooling in Neovim** – gopls with inlay hints and codelenses, `<leader>G…` for code generation (`if err != nil` guards, struct tags, interface stubs, test and doc-comment generation), and `<leader>T…` to run tests from the buffer with a summary tree and watch mode (Go, plus pytest and Vitest via neotest adapters)
- **Sessions and branch review in Neovim** – persistence.nvim restores a project's buffers and layout on demand (`<leader>qs`, or `s` on the dashboard), and diffview.nvim reviews a branch against the default branch (`<leader>gv`) or walks a file's history (`<leader>gh`)
- **Smart aliases** – Single-letter shortcuts for modern tools (`v` for nvim, `g` for ripgrep, `f` for fd, `z` for zoxide) while keeping original commands for scripts
- **Suffix aliases** – Automatically open files with the right tool based on extension (`.md` → mdcat, `.json`/`.yaml` → jless, `.py`/`.sh`/`.bal` → $EDITOR)
- **Language runtimes** – pyenv, rbenv, nvm, SDKMAN, and Ballerina with lazy-loading shell glue so heavy managers don't slow startup
- **Touch ID for sudo** – Use your fingerprint instead of typing passwords in the terminal (works inside tmux too via `pam-reattach`)
- **Caps Lock remap** – Hammerspoon + `ControlEscape.spoon`: tap Caps Lock for Escape, hold for Control — a Karabiner alternative that needs only Accessibility/Input Monitoring permissions, no blockable system extension
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

4. **Terminal** – Ghostty (recommended and configured), iTerm2, or Terminal.app all work
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

- Validate macOS + Xcode CLT, install Homebrew, jq, Go (needed to install `bestow`)
- Install core packages from `Brewfile` with Brew
- Offer opt-in categories (development, terminals, editors, etc.)
- Install SDKMAN + Java 21 (optional) and brew-based Ballerina
- Enable Touch ID for sudo (with tmux support via `pam-reattach`, loaded from a root-owned copy in `/opt/pam`)
- Configure Atuin, direnv, tmux, git delta, lazygit, lazydocker, aliases, and helper functions
- Generate/restore encrypted `.env` with SOPS + age (keys stored at `~/.config/sops/age/keys.txt`, per-machine `~/.sops.yaml`)
- Create Nerd Font + terminal integrations
- Back up existing dotfiles and symlink everything via `bestow`
- Install TPM (pinned release) and the tmux plugins
- Check that the SSH commit-signing key exists (offers to create it)
- Test the install with `test-zsh` and show next steps

### Option 2 – Manual setup

```bash
git clone https://github.com/ThisaruGuruge/dotfiles.git ~/dotfiles
cd ~/dotfiles

# Install everything that is currently enabled in Brewfile
brew bundle --file=Brewfile

# Install bestow (requires Go)
go install github.com/redpierrot/bestow@latest

# Bootstrap bestow's own config (source: this repo, destination: $HOME)
bestow init --source ~/dotfiles --destination ~/

# Symlink the packages you need (add/remove as desired)
bestow stow zsh git tmux direnv bash
bestow stow bin -d ~/bin   # bin links into ~/bin, not ~

# Secrets: an age key and this machine's own sops config (not tracked)
mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt
sed "s/AGE_PUBLIC_KEY/$(grep '^# public key:' ~/.config/sops/age/keys.txt | cut -d' ' -f4)/g" \
  bash/.sops.yaml.example > ~/.sops.yaml

# Reload configuration, then create the encrypted ~/.env
source ~/.zshrc
edit_secrets
```

Git signs every commit with SSH (`gpgSign = true`), so set `user.signingkey` in `~/.gitconfig.local` (see `git/.gitconfig.local.example`) and create the key it names (`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_signing`) before your first commit.

Edit the `Brewfile` directly or use category Brewfiles in `packages/` before running `brew bundle` if you want to customize packages.

### Option 3 – Brewfile only

Already have a preferred dotfiles strategy but want the curated tools? Run `brew bundle --file=Brewfile` and manually pick pieces (aliases, functions, etc.). Edit the Brewfile directly or use the category files in `packages/` to customize your installation.

## Package Management

The main `Brewfile` contains core packages that are always installed. Optional packages are organized into category files in `packages/`:

```bash
packages/
├── cloud.brewfile       # AWS, GCP CLIs
├── containers.brewfile  # colima, Docker CLI + Compose + credential helper
├── development.brewfile # pyenv, rbenv, nvm, flutter
├── editors.brewfile     # Cursor, VS Code
├── productivity.brewfile # Raycast, Rectangle, etc.
└── terminals.brewfile   # iTerm2
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
- `development` – pyenv, rbenv, nvm, flutter (optional)
- `aws`, `gcp` – cloud CLIs and helpers
- `editors` – Cursor, VS Code
- `terminals` – iTerm2 (casks)
- `containers` – colima (container runtime), Docker CLI + Compose + credential helper
- `productivity` – Raycast, Rectangle, TablePlus, Alfred, Postman

Comment out what you do not need in the Brewfile, then rerun `brew bundle`.

## Repository Layout & Symlink Packages

| Path                     | Notes                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `zsh/`                   | `.zshrc`, `.zshrc.d/` (modular shell config), `.functions.d/` (modular functions), aliases, paths |
| `zsh/.zshrc.d/`          | 7 modules: plugins, completion, keybindings, history, integrations, environment, tmux             |
| `zsh/.functions.d/`      | 9 modules: colors, core, navigation, archives, git, system, dotfiles, docs, packages              |
| `<tool>/.config/<tool>/` | XDG configs, one stow package per tool (`ghostty`, `lazygit`, `nvim`, `yazi`, `ripgrep`, `typos`) |
| `zsh/.p10k.zsh`          | Powerlevel10k prompt config (Catppuccin Mocha, stowed to `~/.p10k.zsh`)                           |
| `git/`                   | `.gitconfig`, ignore rules, delta settings                                                        |
| `tmux/`                  | Modern tmux config + keybinds, project session layout, Claude state in status bar                 |
| `direnv/`                | Project-specific environment automation                                                           |
| `packages/`              | Optional category Brewfiles (cloud, containers, development, etc.)                                |
| `bin/`                   | Helper scripts (`test-zsh-config`, `profile-zsh-startup`, `audit-configs`, `adopt-config`)        |
| `docs/`                  | Additional documentation (prompt guide, tmux keybindings, config management)                      |

### Ghostty Configuration

Ghostty is configured with:

- Option+Left/Right for word navigation (sent as Alt+b / Alt+f, so it works inside tmux too) and Cmd+Delete for delete-to-end-of-line (sent as Alt+k)
- Catppuccin Mocha theme
- FiraCode Nerd Font with ligatures
- Tmux-aware keybindings for window/pane navigation (they send the tmux prefix `Ctrl+a`; `test-zsh` fails if the prefix changes)

### Containers (colima)

The optional `containers` category (`packages/containers.brewfile`) installs [colima](https://colima.run) as the local container runtime, paired with the plain `docker`, `docker-compose`, and `docker-credential-helper` CLI formulae — no Docker Desktop app/VM required.

```bash
brew bundle --file=packages/containers.brewfile  # colima + docker CLI + compose + credential helper
colima-start                                     # boots the VM, sets the `colima` docker context
docker ps                                        # talks to colima automatically
lzd                                               # lazydocker also works unchanged — it just follows the active docker context
```

Colima lifecycle aliases (`zsh/.aliases.sh`, only defined if `colima` is installed):

| Alias            | Command          |
| ---------------- | ---------------- |
| `colima-start`   | `colima start`   |
| `colima-stop`    | `colima stop`    |
| `colima-restart` | `colima restart` |
| `colima-status`  | `colima status`  |
| `colima-list`    | `colima list`    |
| `colima-ssh`     | `colima ssh`     |

Homebrew's `docker-compose` formula installs as a CLI plugin, and `docker-credential-helper` installs `docker-credential-osxkeychain` to store registry credentials in the macOS Keychain instead of plaintext — but Docker only picks either up if `~/.docker/config.json` says so:

```json
{
  "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"],
  "credsStore": "osxkeychain"
}
```

`init.sh` does not currently write these keys automatically — add them by hand (or merge into an existing `~/.docker/config.json`) after installing `docker-compose` / `docker-credential-helper`.

### Symlink Management (bestow)

Day-to-day package management (adding/removing symlinks after the initial install) uses `bestow` — a Go-based successor to GNU Stow — instead of `stow` directly. It replicates `stow --no-folding` behavior (always on, no flag needed) but is idempotent and conflict-safe with pre-existing absolute symlinks.

```bash
bestow stow zsh                    # Shell config (includes .p10k.zsh)
bestow stow nvim ghostty lazygit ripgrep yazi typos  # Per-tool packages
bestow stow git tmux direnv        # Git/Tmux/Direnv packages

# Remove a package
bestow unstow zsh
```

`init.sh` (the fresh-machine installer) installs bestow with `go install github.com/redpierrot/bestow@latest` and runs the same `bestow stow` commands per package. `@latest` resolves to bestow's newest tagged release once it publishes tags (until then, the newest commit on its default branch).

> **`bin` is the exception**: it links into `~/bin`, so always stow it as `bestow stow bin -d ~/bin`. Don't run a bare `bestow stow` across every package — with the single `$HOME` destination in bestow's config it would link `bin/*` straight into `~`.

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
dotdoctor                                  # Health check (changes nothing): unlinked files, dangling links, secrets, mods (--full adds brew + plugin validation)
prs                                        # Browse PRs with fzf: enter=checkout, ctrl-o=browser, ctrl-d=diff via delta
prw                                        # Watch the current PR's checks, then notify with the result
envrc work|personal|status|off             # Pin the Claude Code + gws account for this directory via direnv
lg                                         # Launch lazygit with our config
lzd                                        # Launch lazydocker for Docker management
gw build                                   # Run Gradle build from any subdirectory
gwt                                        # Alias for: gw test
gwc                                        # Alias for: gw clean
gwcb                                       # Alias for: gw clean build
Ctrl+R                                     # Atuin search UI (fuzzy search all history)
Up arrow                                   # Atuin prefix search (as you type)
```

### Per-project accounts (`envrc`)

`envrc work` (enterprise) or `envrc personal` writes a `.envrc` in the current directory that pins `CLAUDE_CONFIG_DIR` and `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` (plus the gws `file` keyring backend), creates the account's gws directory with mode 700, runs `direnv allow` and applies the pin to the current shell straight away. Plain `claude` and `gws` then use the right account anywhere under that directory, including subdirectories and new shells or tmux panes opened inside the tree (direnv stays lazy-loaded: it is only loaded once a `.envrc` exists in the current directory or any parent). The file is added to the repo's local exclude (`info/exclude`, also from a linked worktree; `envrc` confirms with `git check-ignore`) and inherits parent pins through `source_up_if_exists`.

- `envrc status` shows which pin applies (and whether it is inherited from a parent directory)
- `envrc off` removes a pin written by `envrc` (it never touches a `.envrc` it did not write)
- Replacing an existing `.envrc` (not written by `envrc`, or edited by hand since) asks first and keeps a copy as `.envrc.bak`; a symlinked `.envrc` is refused rather than written through

**What overrides what**

| Command | `CLAUDE_CONFIG_DIR` | `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` |
| --- | --- | --- |
| plain `claude` in a pinned tree | pinned account | pinned account (inherited) |
| `ccp`/`ccpr`/`ccpc`, `cce`/`ccer`/`ccec` | the account you typed | blanked for that `claude`, so a pin never leaks the other account's gws into it |
| `gwsp`/`gwse` | unchanged | the account you typed |
| bare `gws` in a pinned tree | unchanged | pinned account: **the `bin/gws` guard lets it through** because the pin supplies the account context |
| bare `gws` anywhere else | unchanged | blocked (exit 64) |

Inside a pinned tree a bare `gws` therefore acts on the pinned account instead of being refused; that is the point of the pin. Plain `claude` outside any pinned directory uses `~/.claude`, which should be a symlink to `~/.claude-personal` (`dotdoctor` checks this: `ln -s ~/.claude-personal ~/.claude`).

### GitHub PR helpers (`prs`, `prw`)

- `prs [gh pr list flags]` – fzf over the repo's PRs with a `gh pr view` preview. `enter` checks the PR out, `ctrl-o` opens it in the browser, `ctrl-d` shows the full diff through delta. Example: `prs --author @me`
- `prw [pr]` – `gh pr checks --watch` for the current branch's PR (or the given number/URL), then a macOS notification with the result; the exit status mirrors `gh pr checks`

Both need `gh` and `jq`; `prs` also needs `fzf`. PR titles are untrusted text: control characters (including ESC) are replaced with spaces before they are shown, and `prw` prints titles verbatim (no backslash interpretation). `prw` says whether the checks failed, were cancelled or are still pending, or that gh reported no result (no checks, or gh could not be reached), instead of calling every non-zero exit "failed".

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

| Extension                  | Tool       | Purpose                                |
| -------------------------- | ---------- | -------------------------------------- |
| `.md`                      | `mdcat -p` | View rendered Markdown with paging     |
| `.json`                    | `jless`    | Interactive JSON browsing with folding |
| `.yaml`, `.yml`            | `jless`    | Interactive YAML browsing              |
| `.py`                      | `$EDITOR`  | Edit Python files                      |
| `.sh`, `.bash`, `.zsh`     | `$EDITOR`  | Edit shell scripts                     |
| `.bal`                     | `$EDITOR`  | Edit Ballerina files                   |
| `.conf`, `.config`, `.ini` | `$EDITOR`  | Edit configuration files               |

The default editor is set to `nvim` via the `$EDITOR` environment variable in `.zshenv`.

## Secret Management (SOPS + age)

- Keys live at `~/.config/sops/age/keys.txt` and are created by `init.sh`. Backup that file somewhere safe.
- `~/.sops.yaml` names the age recipient new secrets are encrypted to, so it is **per machine**: `init.sh` writes it from `bash/.sops.yaml.example` with this machine's public key. It is not tracked or stowed (machines set up before this change had it as a symlink into the repo; re-run `./init.sh` to replace the link with a real file).
- Secrets live in `~/.env` (outside the repo). They stay encrypted on disk. On startup the shell decrypts them once into a private cache (`~/.cache/zsh/env_cache`, mode 600 in a 700 directory) until `~/.env` changes, and reads `KEY=value` lines from it without sourcing or eval'ing anything. Values can be `'single quoted'` (literal), `"double quoted"` (`$NAME`/`${NAME}` expand, nothing else does) or plain words; lines with `$(...)`, backticks or reserved names such as `PATH`/`PS1` are skipped and named (never shown) on stderr.
- Use `edit_secrets` (wrapper defined in `.functions.d/06-dotfiles.zsh`) to decrypt, open your `$EDITOR`, and re-encrypt on save. The plaintext only exists in a private temp directory that is removed on exit or Ctrl-C, vim/nvim run without swap/undo/backup files, and the new file must decrypt back to your edits before it replaces `~/.env`. The previous version is kept as `~/.env.backup.<timestamp>` (encrypted; the newest 3 are kept).
- Manual commands:

  ```bash
  sops -d ~/.env | less            # View decrypted env
  sops ~/.env                      # Edit directly
  export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
  ```

- `zsh/.env.example` lists the keys a new machine needs; copy them in with `edit_secrets`. Nothing reads `zsh/.env`, so never create one in the repo (`test-zsh` warns if it exists, and about plaintext `~/.env.backup*` files).

## Touch ID for sudo

The installer configures macOS to accept Touch ID (fingerprint) for `sudo` prompts in the terminal. This uses `/etc/pam.d/sudo_local`, which persists across macOS system updates (unlike editing `/etc/pam.d/sudo` directly).

**tmux support**: The `pam-reattach` brew package is included so Touch ID also works inside tmux sessions — without it, macOS cannot reach the biometric sensor from a reattached session.

**Root-owned module**: sudo loads `pam_reattach.so` as root, and the Homebrew prefix is writable by your user — so `sudo_local` must never point into it (any process running as you could swap the module and get root on your next `sudo`). `init.sh` copies the module to `/opt/pam/pam_reattach.so` (`root:wheel`, mode 444) and points `sudo_local` there; on machines set up earlier it offers to migrate the old Homebrew path. Re-run `./init.sh` after `brew upgrade pam-reattach` to refresh the copy. `test-zsh` fails if the configured module isn't root-owned.

After running `init.sh`, any `sudo` command will show the Touch ID prompt first and fall back to password if dismissed.

To enable manually (without `init.sh`):

```bash
brew install pam-reattach

# Copy the module somewhere only root can write (requires sudo)
sudo install -d -o root -g wheel -m 755 /opt/pam
sudo install -o root -g wheel -m 444 "$(brew --prefix)/lib/pam/pam_reattach.so" /opt/pam/pam_reattach.so

# Create /etc/pam.d/sudo_local (requires sudo)
sudo tee /etc/pam.d/sudo_local <<'EOF'
# sudo_local: local config for sudo (persists across macOS updates)
auth       optional       /opt/pam/pam_reattach.so
auth       sufficient     pam_tid.so
EOF
```

## Powerlevel10k Prompt

Sample prompt (top line + prompt character on line 2):

```text
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

**Design principle**: The prompt shows _command context_ (where you are, git state, language). The tmux status bar shows _session context_ (session name, sysinfo, battery, time). Nothing is duplicated between the two layers.

Customize the prompt at `~/.p10k.zsh` (stowed from `zsh/.p10k.zsh`):

```bash
nvim ~/dotfiles/zsh/.p10k.zsh     # Edit directly — hot-reloads automatically
p10k configure                    # Interactive wizard (overwrites the file)
```

The Catppuccin Mocha palette used by the prompt matches the tmux status bar exactly — same background (`#1e1e2e`), same blue (`#89b4fa`), same green (`#a6e3a1`), same accent colors throughout.

## Validation, Performance & Troubleshooting

- `test-zsh` – Runs syntax checks, ensures required tools exist, inspects PATH/env vars, and prints a summary with pass/warn/fail counts
- `dotdoctor` (`bin/dotdoctor`) – Drift check that never stows, fixes or deletes anything (✔/⚠/✘, non-zero exit on ✘): files that are not symlinked, dangling links, bestow config, `~/.claude` link, age key and `~/.env` encryption, Claude mod directories, ControlEscape.spoon, tmux plugins, the `gws` guard. `dotdoctor --full` also runs `brew bundle check` (auto-update off) and `claude plugin validate` (throwaway config dir)
- `bin/test-shell-helpers` – Behavioural tests for `dotdoctor`, `envrc`, `git_ignore_local`, `prs`/`prw` and the lazy direnv hook, run in a scratch `HOME` with fake `gh`/`fzf`/`claude`; `test-zsh` runs it
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

Remember to `bestow unstow` packages you no longer want and re-run `bestow stow` after pulling to ensure new configs are linked.

## Contributing

Bug reports and PRs are welcome! Please run `test-zsh` plus any relevant profilers before opening a pull request. See `CONTRIBUTING.md` for commit conventions, scopes (including `prompt` for p10k changes), and validation expectations.

Happy hacking!
