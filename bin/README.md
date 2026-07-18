# Dotfiles Management Scripts

Helper scripts to manage your dotfiles setup.

## Scripts

### `audit-configs`
Audit your `~/.config` directory to see what's managed by dotfiles vs what's not.

**Usage:**
```bash
./bin/audit-configs
```

**Output:**
- Lists all symlinked configs (managed by dotfiles)
- Lists all real directories (not managed)
- Highlights likely user configs
- Provides recommendations

### `adopt-config <app-name>`
Migrate an existing config from `~/.config/<app>` into your dotfiles repo.

**Usage:**
```bash
./bin/adopt-config fish
```

**What it does:**
1. Checks if config exists and isn't already a symlink
2. Shows size and warns about sensitive data
3. Moves config to `~/dotfiles/<app>/.config/<app>` (a new top-level bestow package)
4. Creates `.bestowignore` for sensitive files
5. Stows the package to create the symlink back
6. Prompts you to review and commit

**Example:**
```bash
# Adopt fish shell config
./bin/adopt-config fish

# Review the ignore file
vim ~/dotfiles/fish/.bestowignore

# Commit
git add fish/.config/fish fish/.bestowignore
git commit -m "Adopt fish shell configuration"
```

### `sync-brewfile`
Update your Brewfile with all currently installed Homebrew packages.

**Usage:**
```bash
./bin/sync-brewfile
```

**What it does:**
1. Creates backup of current Brewfile
2. Generates new Brewfile from installed packages
3. Shows diff of changes
4. Prompts you to review and commit

**Use this when:**
- You installed a new package with `brew install`
- You want to sync your Brewfile with current state
- Setting up dotfiles and want to capture all installed tools

## Workflow Examples

### Adding a new tool to your setup

```bash
# 1. Install the tool
brew install bat

# 2. Configure it
mkdir -p ~/dotfiles/bat/.config/bat
echo "--theme=TwoDark" > ~/dotfiles/bat/.config/bat/config

# 3. Stow it
cd ~/dotfiles && bestow stow bat

# 4. Update Brewfile
./bin/sync-brewfile

# 5. Commit everything
git add bat/.config/bat Brewfile
git commit -m "Add bat with custom config"
git push
```

### Adopting existing configs

```bash
# 1. Audit what's not managed yet
./bin/audit-configs

# 2. Adopt configs you want to manage
./bin/adopt-config fish
./bin/adopt-config sops

# 3. Review and commit
git add fish/.config/fish sops/.config/sops
git commit -m "Adopt fish and sops configurations"
git push
```

### Fresh machine setup

On a new machine, everything just works:
```bash
git clone https://github.com/yourusername/dotfiles.git ~/dotfiles
cd ~/dotfiles
./init.sh
# All configs are symlinked automatically!
```

## Tips

- Run `./bin/audit-configs` periodically to catch new configs
- Use `./bin/sync-brewfile` after installing new tools
- Always review `.bestowignore` files before committing
- Test your init.sh on a fresh VM/container periodically
