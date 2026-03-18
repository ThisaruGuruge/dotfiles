# Powerlevel10k Prompt Guide

## Understanding Your Prompt

### What You See

```
 ~/dotfiles  main !+   Go 1.23.4
❯
```

**Breakdown:**
- ` ~/dotfiles` – Current directory (truncated, lock icon for read-only dirs)
- ` main` – Git branch (only shown inside git repos)
- `!+` – Git status icons (see legend below)
- `Go 1.23.4` – Language version (only shown inside matching projects)
- `❯` – Prompt character (green = success, red = error; `❮` in Vim normal mode)

### Git Status Icons

| Icon | Meaning |
|------|---------|
| `!`  | Modified files |
| `+`  | Staged files |
| `?`  | Untracked files |
| `*`  | Stashed changes |
| `⇣`  | Commits behind remote |
| `⇡`  | Commits ahead of remote |

### Language Version Indicators

These **only show when inside relevant projects**:

| Language | Shows When |
|----------|------------|
| Go       | Dir contains `go.mod` or `*.go` files |
| Java     | Dir contains `pom.xml`, `build.gradle`, etc. |
| Python   | Dir contains `.python-version`, `pyproject.toml`, etc. |
| Ballerina | Dir contains `Ballerina.toml` |

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

### Keybindings

| Key | Action |
|-----|--------|
| `TAB` | Trigger completion |
| `↑/↓` or `Ctrl-J/K` | Navigate options |
| `Ctrl-Space` | Toggle selection |
| `Enter` | Accept selection |
| `Esc` or `Ctrl-C` | Cancel |
| `<` / `>` | Switch groups |

---

## Atuin - Smart Shell History

### Keybindings

| Key | Description |
|-----|-------------|
| `Ctrl+R` | Open Atuin interactive search |
| `↑` | Atuin prefix search as you type |
| `Tab` | Copy selected command to command line |
| `Enter` | Execute selected command |

### Filter Modes (Tab in search to cycle)

| Mode | Description |
|------|-------------|
| `global` | Search all history (default) |
| `host` | This machine only |
| `session` | Current terminal session only |
| `directory` | Commands run in current directory |

### Atuin Aliases

```bash
hs        # atuin search
hstats    # atuin stats
hsync     # atuin sync
```

---

## Performance

- **Prompt render:** ~1ms (pure Zsh, no subprocess per draw)
- **Shell startup:** ~500ms
- **Tab completion:** Instant with fzf-tab

Powerlevel10k uses gitstatus (a compiled daemon) for instant, non-blocking git state — no shell subprocess is spawned per prompt draw.

---

## Customization

### Edit Prompt Config

```bash
nvim ~/dotfiles/zsh/.p10k.zsh     # Edit directly — hot-reloads automatically
p10k configure                    # Interactive wizard (overwrites the file)
```

The config is stowed from `zsh/.p10k.zsh` to `~/.p10k.zsh`.

### Transient Prompt

After a command runs, the previous prompt collapses to just `❯` in scrollback. This is configured in `.p10k.zsh` under `POWERLEVEL9K_TRANSIENT_PROMPT`.

### Adding/Removing Segments

Edit `POWERLEVEL9K_LEFT_PROMPT_ELEMENTS` and `POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS` in `~/.p10k.zsh`.

---

## Troubleshooting

### Prompt looks wrong or shows boxes

```bash
# Restart shell
source ~/.zshrc

# Re-run the interactive wizard
p10k configure

# Check font - ensure your terminal uses a Nerd Font
# Recommended: FiraCode Nerd Font
```

### Icons not rendering

Make sure your terminal profile uses **FiraCode Nerd Font** (or another Nerd Font). Boxes instead of icons = font missing Nerd Font glyphs.

### Tab completion not working

```bash
# Check fzf-tab loaded
zinit list | grep fzf

# Reload completions
autoload -Uz compinit && compinit

# Restart shell
exec zsh
```

### Ballerina segment not showing

Make sure you're in a directory with `Ballerina.toml`:

```bash
cd your-ballerina-project
ls Ballerina.toml    # Must exist
```

### Language version shows when it shouldn't

Powerlevel10k shows language segments based on file detection in the current directory tree. To disable a segment entirely, comment it out in `POWERLEVEL9K_LEFT_PROMPT_ELEMENTS` inside `~/.p10k.zsh`.

---

## Resources

- **Powerlevel10k Docs:** https://github.com/romkatv/powerlevel10k
- **Atuin Docs:** https://github.com/atuinsh/atuin
- **fzf-tab:** https://github.com/Aloxaf/fzf-tab
- **Your p10k Config:** `~/.p10k.zsh` (stowed from `zsh/.p10k.zsh`)

---

## Quick Help

```bash
# See all aliases
aliases

# Get help on a specific alias category
help git

# List all dotfiles tools
list_dotfiles_tools

# Test your zsh configuration
test-zsh
```
