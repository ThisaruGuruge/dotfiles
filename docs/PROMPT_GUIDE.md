# Starship Prompt & Terminal Guide

## Understanding Your New Prompt

### What You See

```
~/dotfiles on  main [STASH:2 !6 ?3] BAT:65% at 18:08
>
```

**Breakdown:**
- `~/dotfiles` - Current directory (cyan, truncated to 3 levels)
- `on  main` - Git branch (purple, only in git repos)
- `[STASH:2 !6 ?3]` - Git status (red, see legend below)
- `BAT:65%` - Battery status (color changes based on %)
- `at 18:08` - Current time (24h format)
- `>` - Prompt symbol (green = success, red = error)

### Git Status Icons

| Icon | Meaning | Example |
|------|---------|---------|
| `?3` | 3 untracked files | New files not in git |
| `!6` | 6 modified files | Changed files |
| `+2` | 2 staged files | Ready to commit |
| `STASH:2` | 2 stashed changes | Saved for later |
| `X1` | 1 deleted file | Removed files |
| `UP:2` | 2 commits ahead | Push needed |
| `DOWN:1` | 1 commit behind | Pull needed |
| `CONFLICT` | Merge conflict | Needs resolution |

### Language Version Indicators

These **only show when in relevant projects**:

| Icon | Language | Shows When |
|------|----------|------------|
| `JAVA 21.0.5` | Java | In dir with pom.xml, build.gradle, etc. |
| `NODE v22.2.0` | Node.js | In dir with package.json, node_modules, etc. |
| `PY 3.11` | Python | In dir with .py files, requirements.txt, etc. |
| `BAL 2201.10.0` | Ballerina | In dir with Ballerina.toml |

**Why they don't always show:**
- Starship only shows language versions when you're in a project that uses that language
- This keeps the prompt clean and fast
- No more "8 8 2" - that was a config bug, now fixed!

---

## FZF Tab Completion

### How to Use

1. **Basic completion:**
   ```bash
   cd doc<TAB>
   ```
   - Shows list of matching directories
   - Use arrow keys or Ctrl-J/K to navigate
   - Press Enter to select

2. **Preview window:**
   - Right side shows directory contents
   - Updates as you navigate
   - Uses `eza` for colorized output

3. **Navigate groups:**
   - `<` and `>` to switch between completion groups
   - Useful when multiple types match (files, dirs, commands)

### Keybindings

| Key | Action |
|-----|--------|
| `TAB` | Trigger completion |
| `↑/↓` or `Ctrl-J/K` | Navigate options |
| `Ctrl-Space` | Toggle selection |
| `Enter` | Accept selection |
| `Esc` or `Ctrl-C` | Cancel |
| `<` / `>` | Switch groups |

### Examples

```bash
# Navigate to directory
cd pro<TAB>              # Shows "Projects" with preview

# Git commands
git checkout fea<TAB>    # Shows feature branches

# Kill process
kill <TAB>               # Shows running processes

# Environment variables
echo $HO<TAB>            # Shows $HOME, $HOSTNAME, etc.
```

---

## Atuin - Smart Shell History

### What is Atuin?

Atuin replaces your shell history with a smart, searchable, syncable database.

### Keybindings

| Key | Command | Description |
|-----|---------|-------------|
| `Ctrl+R` | Search history | Opens Atuin interactive search |
| `↑` | Prefix search | Atuin shows matches as you type |
| `↓` | Next in history | Navigate forward in history |
| `Tab` | Edit command | Copy to command line for editing |
| `Enter` | Execute | Run the selected command |

### Using Atuin Search (Ctrl+R)

1. Press `Ctrl+R` to open interactive search
2. Type to filter commands (fuzzy matching)
3. Use arrow keys to navigate results
4. Press `Tab` to copy to command line (for editing)
5. Press `Enter` to execute directly

### Filter Modes (press Tab in search to cycle)

| Mode | Description |
|------|-------------|
| `global` | Search all history (default) |
| `host` | Search history from this machine only |
| `session` | Search current terminal session only |
| `directory` | Search commands run in current directory |

### Atuin Commands

```bash
# Search history interactively
hs                      # alias for: atuin search

# View statistics
hstats                  # alias for: atuin stats

# Sync history (if configured)
hsync                   # alias for: atuin sync
```

### Pro Tips

- **Directory context**: Use `directory` filter mode when you want commands specific to current project
- **Statistics**: Run `hstats` to see your most used commands and patterns
- **Secrets**: Atuin automatically filters out commands containing secrets (AWS keys, tokens, etc.)

---

## Performance Tips

### Current Speed

- **Prompt render:** ~30-50ms (was 4000ms with Oh My Posh!)
- **Shell startup:** ~500ms
- **Tab completion:** Instant with fzf-tab

### Why It's Fast

1. **Starship** - Written in Rust, compiled
2. **Context-aware** - Only shows relevant info
3. **Caching** - Tool init scripts cached
4. **Smart detection** - Doesn't check for tools in every dir

---

## Troubleshooting

### Prompt looks wrong

```bash
# Restart shell
source ~/.zshrc

# Check Starship config
starship config

# Test prompt manually
starship prompt
```

### Tab completion not working

```bash
# Check fzf-tab loaded
zinit list | grep fzf

# Reload completions
autoload -Uz compinit && compinit

# Restart shell
exec zsh
```

### Ballerina not showing

Make sure you're in a directory with `Ballerina.toml`:

```bash
cd your-ballerina-project
touch Ballerina.toml  # Create if needed
```

### Language versions showing when they shouldn't

This is normal! Starship shows versions when:
- You have the relevant files in current/parent directories
- OR you're in a git repo that uses that language

To hide a language completely, edit `~/.config/starship.toml`:

```toml
[nodejs]
disabled = true  # Never show Node version
```

---

## Customization

### Edit Starship Config

```bash
vim ~/.config/starship.toml
```

### Common Customizations

**Change prompt symbol:**
```toml
[character]
success_symbol = "[>](bold green)"
error_symbol = "[x](bold red)"
```

**Change directory truncation:**
```toml
[directory]
truncation_length = 5  # Show more levels
```

**Add more languages:**
```toml
[rust]
disabled = false
format = "via [$symbol($version)]($style) "
```

**Change git status icons:**
```toml
[git_status]
modified = "M"  # Use 'M' instead of '!'
untracked = "U" # Use 'U' instead of '?'
```

### Apply Changes

```bash
# Changes take effect immediately in new prompts
# OR restart shell
source ~/.zshrc
```

---

## Resources

- **Starship Docs:** https://starship.rs/config/
- **Atuin Docs:** https://github.com/atuinsh/atuin
- **fzf-tab:** https://github.com/Aloxaf/fzf-tab
- **Your Config:** `~/.config/starship.toml`

---

## Quick Help

```bash
# See all aliases
aliases

# Get help on specific alias category
help git

# List all dotfiles tools
list_dotfiles_tools

# Test your zsh configuration
test-zsh
```
