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

1. Create config in dotfiles (one top-level package per tool):
   ```bash
   mkdir -p ~/dotfiles/myapp/.config/myapp
   # Create your config files
   vim ~/dotfiles/myapp/.config/myapp/config.toml
   ```

2. Stow it:
   ```bash
   cd ~/dotfiles
   bestow stow myapp
   ```

3. Commit:
   ```bash
   git add myapp/.config/myapp
   git commit -m "Add myapp configuration"
   ```

### Method 2: Adopt existing config (for current machine)

If you already have a config at `~/.config/myapp`:

```bash
./bin/adopt-config myapp
```

This will:
- Move `~/.config/myapp` to `~/dotfiles/myapp/.config/myapp`
- Create `.bestowignore` to exclude sensitive files
- Create a symlink back to the original location
- Prompt you to review and commit

## What Should Be In Dotfiles?

### Include (User Preferences)
- Shell configs (fish, zsh)
- Editor configs (nvim, vim)
- Terminal configs (ghostty, alacritty)
- CLI tool configs (git, htop, ripgrep)
- Development tool configs (lazygit)

### Exclude (Credentials/Generated)
- Cloud provider credentials (gcloud, aws)
- Authentication tokens (github-copilot)
- Application caches
- Build artifacts
- Session data
- Large binary files

## Protecting Sensitive Data

Each package can have a `.bestowignore` file, at the **package root** (`<pkg>/.bestowignore`,
not nested inside `.config/<pkg>/` — bestow only reads it from the package root):

```bash
# Example: myapp/.bestowignore
*.log
*.cache
cache/**
*.token
*.key
credentials*
secrets*
session*
*.db
*.db-*
```

Patterns use glob syntax (`*`, `**`, `?`, `[abc]`, `{a,b}`), matched against either the file's
full relative path within the package or its basename — not regex, and not gitignore semantics.
There's no negation (`!pattern`), and only files are ever tested (never directories), so a
directory-only pattern like `cache/` matches nothing — write `cache/**` to exclude everything
under it. Files matching any pattern — from the repo-root `.bestowignore`, the global
`~/.config/bestow/.bestowignore`, or the package's own — won't be symlinked by bestow.

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
mkdir -p ~/dotfiles/bat/.config/bat
echo "--theme=TwoDark" > ~/dotfiles/bat/.config/bat/config

# Stow it
cd ~/dotfiles
bestow stow bat

# Verify
ls -la ~/.config/bat
# Should show: bat -> ../dotfiles/bat/.config/bat

# Commit
git add bat/.config/bat
git commit -m "Add bat configuration"
git push
```

### Scenario 3: Existing config you want to manage

You've been using `fish` and have configs:

```bash
# Before: ~/.config/fish is a real directory
./bin/adopt-config fish

# After: ~/.config/fish is a symlink to dotfiles
# Review the .bestowignore
vim ~/dotfiles/fish/.bestowignore

# Commit
git add fish/.config/fish fish/.bestowignore
git commit -m "Adopt fish shell configuration"
git push
```

## Directory Structure

```
~/dotfiles/
  myapp/                     ← Package name for bestow (one per tool)
    .bestowignore            ← Ignore sensitive files (package root, not nested)
    .config/                 ← Actual .config directory
      myapp/
        config.toml
```

When you run `bestow stow myapp`, it creates:
```
~/.config/myapp -> ~/dotfiles/myapp/.config/myapp/...  (per-file symlinks)
```

## Troubleshooting

### Config not being picked up

```bash
# Check if it's symlinked
ls -la ~/.config/myapp

# If not, restow
cd ~/dotfiles
bestow stow myapp
```

### Symlink conflicts

```bash
# If you have an existing real directory that conflicts
./bin/adopt-config myapp

# Or manually move and restow
mv ~/.config/myapp ~/dotfiles/myapp/.config/
cd ~/dotfiles
bestow stow myapp
# Or, to overwrite/back up existing files automatically:
bestow stow myapp --backup
```

### Accidentally committed sensitive data

```bash
# Add to .bestowignore (at the package root)
echo "secrets.txt" >> ~/dotfiles/myapp/.bestowignore

# Remove from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch myapp/.config/myapp/secrets.txt' \
  --prune-empty --tag-name-filter cat -- --all

# Or use git-filter-repo (recommended)
git filter-repo --path myapp/.config/myapp/secrets.txt --invert-paths
```

## Tools

- `./bin/audit-configs` - Show managed vs unmanaged configs
- `./bin/adopt-config <app>` - Migrate existing config to dotfiles
- `bestow stow <pkg>` - Stow a package (idempotent; safe to re-run)
- `bestow unstow <pkg>` - Remove a package's symlinks

## Best Practices

1. **Always review before committing** - Check for passwords, tokens, keys
2. **Use .bestowignore liberally** - Better safe than sorry
3. **Test on a fresh VM/container** - Ensure `./init.sh` works
4. **Document dependencies** - Update Brewfile when adding new tools
5. **Keep secrets separate** - Use SOPS, age, or environment variables
