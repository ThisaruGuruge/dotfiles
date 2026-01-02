# Configuration Management Guide

This guide explains how to manage application configs in your dotfiles repository.

## Philosophy

**Everything in `~/.config` should either be:**
1. **Managed by dotfiles** (symlinked from repo) - user preferences, settings
2. **Explicitly ignored** (real directory) - credentials, cache, generated files

## Current Status

Run this to see what's managed vs unmanaged:
```bash
./bin/audit-configs
```

## Adding New Application Configs

### Method 1: Add to dotfiles FIRST (recommended for new machines)

1. Create config in dotfiles:
   ```bash
   mkdir -p ~/dotfiles/config/.config/myapp
   # Create your config files
   vim ~/dotfiles/config/.config/myapp/config.toml
   ```

2. Stow it:
   ```bash
   cd ~/dotfiles
   stow -R config
   ```

3. Commit:
   ```bash
   git add config/.config/myapp
   git commit -m "Add myapp configuration"
   ```

### Method 2: Adopt existing config (for current machine)

If you already have a config at `~/.config/myapp`:

```bash
./bin/adopt-config myapp
```

This will:
- Move `~/.config/myapp` to `~/dotfiles/config/.config/myapp`
- Create `.stow-local-ignore` to exclude sensitive files
- Create a symlink back to the original location
- Prompt you to review and commit

## What Should Be In Dotfiles?

### Include (User Preferences)
- Shell configs (fish, zsh)
- Editor configs (nvim, vim)
- Terminal configs (wezterm, alacritty)
- CLI tool configs (git, htop, ripgrep, starship)
- Development tool configs (lazygit)

### Exclude (Credentials/Generated)
- Cloud provider credentials (gcloud, aws)
- Authentication tokens (github-copilot)
- Application caches
- Build artifacts
- Session data
- Large binary files

## Protecting Sensitive Data

Each config directory can have a `.stow-local-ignore` file:

```bash
# Example: config/.config/myapp/.stow-local-ignore
*.log
*.cache
cache/
*.token
*.key
credentials*
secrets*
session*
*.db
*.db-*
```

Files matching these patterns won't be symlinked by stow.

## Workflow Examples

### Scenario 1: Setting up a fresh machine

```bash
git clone https://github.com/yourusername/dotfiles.git ~/dotfiles
cd ~/dotfiles
./init.sh
```

All configs will be symlinked automatically!

### Scenario 2: Adding a new tool

You install `bat` and want to customize it:

```bash
# Create config in dotfiles first
mkdir -p ~/dotfiles/config/.config/bat
echo "--theme=TwoDark" > ~/dotfiles/config/.config/bat/config

# Stow it
cd ~/dotfiles
stow -R config

# Verify
ls -la ~/.config/bat
# Should show: bat -> ../dotfiles/config/.config/bat

# Commit
git add config/.config/bat
git commit -m "Add bat configuration"
git push
```

### Scenario 3: Existing config you want to manage

You've been using `fish` and have configs:

```bash
# Before: ~/.config/fish is a real directory
./bin/adopt-config fish

# After: ~/.config/fish is a symlink to dotfiles
# Review the .stow-local-ignore
vim ~/dotfiles/config/.config/fish/.stow-local-ignore

# Commit
git add config/.config/fish
git commit -m "Adopt fish shell configuration"
git push
```

## Directory Structure

```
~/dotfiles/
  config/                    ← Package name for stow
    .config/                 ← Actual .config directory
      nvim/                  ← Managed app configs
      wezterm/
      fish/
      myapp/
        .stow-local-ignore   ← Ignore sensitive files
        config.toml
```

When you run `stow config`, it creates:
```
~/.config/nvim -> ../dotfiles/config/.config/nvim
~/.config/wezterm -> ../dotfiles/config/.config/wezterm
```

## Troubleshooting

### Config not being picked up

```bash
# Check if it's symlinked
ls -la ~/.config/myapp

# If not, restow
cd ~/dotfiles
stow -R config
```

### Stow conflicts

```bash
# If you have an existing real directory that conflicts
./bin/adopt-config myapp

# Or manually move and restow
mv ~/.config/myapp ~/dotfiles/config/.config/
cd ~/dotfiles
stow -R config
```

### Accidentally committed sensitive data

```bash
# Add to .stow-local-ignore
echo "secrets.txt" >> ~/dotfiles/config/.config/myapp/.stow-local-ignore

# Remove from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch config/.config/myapp/secrets.txt' \
  --prune-empty --tag-name-filter cat -- --all

# Or use git-filter-repo (recommended)
git filter-repo --path config/.config/myapp/secrets.txt --invert-paths
```

## Tools

- `./bin/audit-configs` - Show managed vs unmanaged configs
- `./bin/adopt-config <app>` - Migrate existing config to dotfiles
- `stow -R config` - Restow all configs
- `stow -D config` - Remove all config symlinks

## Best Practices

1. **Always review before committing** - Check for passwords, tokens, keys
2. **Use .stow-local-ignore liberally** - Better safe than sorry
3. **Test on a fresh VM/container** - Ensure `./init.sh` works
4. **Document dependencies** - Update Brewfile when adding new tools
5. **Keep secrets separate** - Use SOPS, age, or environment variables
