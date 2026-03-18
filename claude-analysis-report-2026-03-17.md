# Dotfiles Repository Analysis Report

**Date:** 2026-03-17
**Analyzer:** Claude Opus 4.6
**Repository:** ~/dotfiles (macOS, Zsh, GNU Stow)
**Branch:** dev

---

## 1. Best Features

### Architecture & Organization
- **Modular numbered-file loading** in `.zshrc.d/` and `.functions.d/` is excellent. Files load in deterministic order, each has a clear responsibility, and new modules can be inserted without touching existing ones.
- **Stow with `--no-folding`** prevents the common pitfall of Stow replacing directories with symlinks. This is a deliberate, correct choice.
- **Separation of concerns** between prompt (p10k = command context) and tmux status bar (session context) with no duplication is well thought out.

### Performance
- **Powerlevel10k instant prompt** at the very top of `.zshrc` gives immediate visual feedback.
- **Cached tool initialization** (`_cache_tool_init()`) avoids re-running `fzf --zsh`, `zoxide init`, and `atuin init` on every shell start.
- **Lazy-loaded runtimes** — NVM, SDKMAN, pyenv, and rbenv all defer their heavy initialization until first use. NVM is particularly well done: the highest installed Node version is added to PATH immediately (zero subprocesses), and full NVM only loads when `nvm` is called.
- **compinit optimization** — only regenerates the completion dump every 20 hours, with `compinit -C` on the fast path. The dump is zcompiled in the background.
- **Homebrew shellenv hardcoded** in `.zprofile` — avoids the ~50ms `eval "$(brew shellenv)"` on every login shell.
- **Tmux vim-aware pane switching** uses `if-shell -F` with format strings instead of spawning subprocesses, avoiding ~250ms endpoint security overhead per pane switch.

### Security
- **SOPS + age encryption** for secrets with automatic decrypt-on-source and safe export validation that blocks command injection characters (`$(`, backticks, `;`, `&`, `|`, `<`, `>`).
- **Touch ID for sudo** with tmux support via `pam-reattach`, using `/etc/pam.d/sudo_local` which persists across macOS updates.

### Developer Experience
- **IDE context detection** — skips heavy initialization for VS Code/IntelliJ env probes, only loading PATH and env vars.
- **`take()` smart function** — handles directories, git repos, and archive URLs with a single command.
- **`kill_by_port()`** with dry-run support, port validation, and detailed error reporting.
- **`edit_secrets()` workflow** — decrypt, edit, detect changes, re-encrypt, with backups at every step.
- **Suffix aliases** for automatic file opening by extension — `.md` -> glow, `.json` -> jless, etc.
- **Tmux auto-project sessions** on `cd` into git repos, with user confirmation prompt.
- **Custom tmux status scripts** (`tmux-status-battery`, `tmux-status-sysinfo`) are efficient — single system calls parsed in awk.
- **`init.sh`** is impressively thorough: conflict resolution with diff viewing, per-package confirmation, backup creation, and Touch ID setup.
- **Built-in documentation system** — `alias_help`, `alias_docs`, `show_tools`, `alias_categories`.

### Tmux Configuration
- The tmux config is comprehensive and well-organized: smart vim-aware pane switching, Catppuccin Mocha theme matching the prompt, session groups for independent window selection, lazygit popup, and sensible plugin choices (resurrect, continuum, yank).

---

## 2. Bugs & Issues

### Critical

**B1: Duplicate Rancher Desktop PATH entries in `.zshrc`** (lines 101-106)
```zsh
# Line 101-102: conditional
[[ -d "$HOME/.rd/bin" ]] && export PATH="$HOME/.rd/bin:$PATH"
# Line 104-106: unconditional (managed by Rancher Desktop)
export PATH="/Users/thisaru/.rd/bin:$PATH"
```
The second block uses a hardcoded absolute path and adds to PATH unconditionally. This means PATH gets the entry even if Rancher Desktop is not installed. The same duplication exists in `06-environment.zsh` (line 118).

**B2: `DOCKER_DEFAULT_PLATFORM` set in two places**
Set in both `.paths.sh` (line 6) and `06-environment.zsh` (line 76). Harmless but confusing — pick one canonical location.

**B3: `packages.json` is referenced but does not exist**
`bin/test-zsh-config` (line 36) references `$DOTFILES_DIR/packages.json`, and the test script heavily relies on it for package validation. The file does not exist in the repo. The Brewfile header says "Generated automatically from packages.json" (line 3), but there's no `packages.json` present. The test script gracefully falls back to manual tests, but much of the test infrastructure is dead code without this file.

**B4: `edit-functions` alias points to wrong file**
```zsh
alias edit-functions="nvim ~/.functions.sh"   # line 72
alias edit_functions='nvim ~/.functions.sh'    # line 229
```
Functions are in `.functions.d/` (directory), not `.functions.sh` (file). These aliases will open a non-existent file.

**B5: Direnv lazy-load hook never cleans itself up**
In `05-shell-integrations.zsh`, `_direnv_check` is added to `chpwd_functions` but is never removed after `_direnv_lazy_load` fires. After direnv initializes, `_direnv_check` still runs on every `cd`, checking for `.envrc` even though direnv's own hook is now active and handles this.

**B6: `start_file_server` alias uses Python 2 API**
```zsh
alias start_file_server='python -m SimpleHTTPServer 8000'
```
`SimpleHTTPServer` is Python 2 only. Should be `python3 -m http.server 8000`.

### Moderate

**B7: `grepbal` and `searchbal` aliases use incorrect ripgrep type names**
```zsh
alias grepbal='rg --type ballerina'
alias searchbal='rg --type bal'
```
Neither `ballerina` nor `bal` are built-in ripgrep types. These will error with "Unknown file type". Use `rg --type-add 'bal:*.bal' --type bal` or use glob: `rg -g '*.bal'`.

**B8: `init.sh` backup step runs *after* stow**
`backup_existing_files()` is called at line 1118, but `stow_packages()` runs at line 1119. If Stow replaces a file before backup runs, the backup contains the symlink, not the original file. The stow function has its own backup logic, but `backup_existing_files()` is essentially a no-op at that point.

**B9: `init.sh` tests `.functions.sh` with `bash -n`**
```bash
if bash -n "$HOME/.functions.sh" >/dev/null 2>&1; then  # line 926
```
Two problems: (a) functions are in `.functions.d/`, not `.functions.sh`, and (b) `bash -n` is the wrong linter for zsh files (zsh syntax differs from bash).

**B10: `confirm()` duplicated between `init.sh` and `01-core.zsh`**
Identical logic exists in both places but can diverge over time.

**B11: `cd()` override may cause infinite recursion**
In `01-core.zsh`, the custom `cd()` calls `__zoxide_z` in interactive mode. If `__zoxide_z` internally calls `cd`, it would recurse. Currently safe because zoxide uses `builtin cd`, but fragile. Consider using `z` alias instead.

**B12: Duplicate alias sets for editing config files**
Both hyphenated (`edit-zsh`, `edit-aliases`, lines 70-83) and underscored (`edit_zsh`, `edit_aliases`, lines 226-230) versions exist. Maintaining two sets invites drift.

---

## 3. What Can Be Done Better

### Shell Configuration

**I1: Consolidate environment setup into fewer files**
`DOCKER_DEFAULT_PLATFORM`, Rancher Desktop PATH, and various PATH additions are scattered across `.paths.sh`, `.zshenv`, `.zprofile`, and `06-environment.zsh`. A single source of truth for each setting would reduce confusion.

**I2: Remove `_direnv_check` from `chpwd_functions` after initialization**
```zsh
_direnv_lazy_load() {
    eval "$(direnv hook zsh)"
    unset -f _direnv_lazy_load
    chpwd_functions=(${chpwd_functions:#_direnv_check})  # ADD THIS
    unset -f _direnv_check                                # ADD THIS
    _direnv_hook
}
```

**I3: Guard eza aliases behind command check properly**
The eza aliases (lines 20-28) are defined unconditionally. The fallback check at line 30 only replaces `ls`, `ll`, and `la` — but `lt`, `ls_x`, `ls_k`, `ls_t`, `ls_old` remain pointing to non-existent `eza` if it's not installed.

**I4: `rm="rm -r"` is dangerous**
Aliasing `rm` to include `-r` means `rm somefile` will recursively delete if `somefile` happens to be a directory. Consider removing this or adding `-i` for safety: `alias rm="rm -rI"`.

**I5: `.="pwd"` alias conflicts with source shorthand**
In zsh, `.` is an alias for `source`. Overriding it to `pwd` breaks `. ~/.zshrc` style sourcing. Use `alias cwd="pwd"` instead.

**I6: Color variables pollute global namespace**
`00-colors.zsh` exports `RED`, `GREEN`, `YELLOW`, etc. as global variables. These could collide with environment variables expected by other tools. Prefix them (e.g., `_CLR_RED`) or use them only locally in functions.

**I7: NVM lazy-loading defines stubs for `node`, `npm`, `npx`, `yarn` but never creates them**
In `02-completion.zsh` line 40, `unset -f nvm node npm npx yarn _load_nvm` unsets functions that were never defined (only `nvm` was). The intent was probably to create lazy stubs for `node`, `npm`, `npx`, and `yarn` too, so they also trigger `_load_nvm`. Without those stubs, calling `node` directly uses the PATH-shimmed version without NVM's full environment.

**I8: `XDG_CACHE_HOME` set to non-standard location**
In `.zprofile`: `export XDG_CACHE_HOME="$HOME/Library/Caches"`. The XDG spec expects `$HOME/.cache`. While macOS convention uses `~/Library/Caches`, this may confuse XDG-aware tools that expect the standard path. Note that `_cache_tool_init` uses `$HOME/.cache/zsh/` — not `$XDG_CACHE_HOME`, creating an inconsistency.

**I9: `rehash` at end of `06-environment.zsh` is unnecessary overhead**
Zsh automatically discovers new commands in PATH directories. The explicit `rehash` forces a full PATH scan, adding ~10-20ms on every shell startup. This should only be needed in rare circumstances.

### Init Script

**I10: `init.sh` should install in dependency order**
Currently `backup_existing_files` runs after `stow_packages` in the `main()` function. Reorder to: backup -> stow -> test.

**I11: Add `bin` to the stow packages list**
`bin/` scripts are stowed separately to `~/bin`, but the `stow_packages()` function doesn't include `bin` in the `packages` array and handles it as a special case at the end. This works but is inconsistent with the pattern.

### Tmux

**I12: `tmux new-session -t main` exits when that session closes**
In `.zshrc` line 77, when a grouped session is created, closing the last window in that grouped session kills the shell. Consider adding `\; set-option destroy-unattached` to auto-cleanup while keeping the main session alive.

**I13: `@resurrect-processes '~nvim'` uses wrong syntax**
The `~` prefix means "restore the program but don't do anything special". To *exclude* nvim from restoration (as the comment says), it should not be listed at all, or use a whitelist approach.

---

## 4. Performance Analysis

### Current Startup Characteristics

**Fast path (< 50ms):**
- p10k instant prompt (cached, immediate display)
- Homebrew shellenv (hardcoded in `.zprofile`, zero subprocess)
- Completion system (20-hour cached `.zcompdump` with `-C` skip)

**Medium path (~50-200ms):**
- `_cache_tool_init` for fzf, zoxide, atuin (file timestamp check + source)
- Node.js shimming (glob + PATH prepend, no subprocess)
- SDKMAN candidate PATH prepend (glob, no subprocess)

**Potential slow spots:**
- `zinit light` for powerlevel10k, zsh-completions, fzf-tab — synchronous loads
- `zsh-syntax-highlighting` and `zsh-autosuggestions` in turbo mode (deferred but still load)
- `source "$HOME/.aliases.sh"` — 280 lines parsed on every startup
- `06-environment.zsh` sources many files, runs `rehash`
- `for file in "$HOME/.functions.d"/*.zsh` — 9 files sourced sequentially
- Decrypting `.env` via SOPS on cache miss (subprocess + crypto)

### Improvement Opportunities

1. **Compile frequently-sourced files** — Run `zcompile` on `.aliases.sh`, `.paths.sh`, and the `.functions.d/` files. Zsh loads `.zwc` files ~2-3x faster than text.

2. **Remove the explicit `rehash`** at the end of `06-environment.zsh` — saves ~10-20ms.

3. **Consider turbo-loading fzf-tab** — It's currently loaded synchronously. Since tab completion isn't needed in the first 100ms, `wait"0"` turbo mode could work.

4. **Combine small function files** — The 9 function files in `.functions.d/` are individually small (5-30 lines each for colors, git, archives, system). The overhead is per-file `source` calls, not content size. Merging rarely-changed files would save ~10ms.

5. **Cache the SOPS decryption** — Already implemented via `env_cache_file`. Verify the cache invalidation logic works (currently checks `-nt` which is correct).

6. **Profile `_is_ide_context()`** — The function checks 4 conditions on every shell start. These checks are fast (string comparisons), but the function is called even in tmux/terminal contexts where it will always return false. Consider only defining it when the conditions could possibly be true.

---

## 5. Documentation Analysis

### What Is Well Documented
- **README.md** — Comprehensive, covering installation (3 methods), package management, Stow usage, suffix aliases, secret management, Touch ID, prompt design, and troubleshooting.
- **CLAUDE.md** — Excellent AI-agent context file with directory structure, conventions, common tasks, and file-purpose mapping.
- **Inline comments** — Shell files are well-commented with section headers and explanations.
- **docs/** directory has keybinding docs for tmux, yazi, and nvim.

### Documentation Issues

**D1: `CLAUDE.md` references `config/.config/starship.toml` but it has been deleted**
Git status shows `D starship/.config/starship.toml` — the starship config was removed (presumably when switching to Powerlevel10k). CLAUDE.md's directory structure and "Important Files" table still list `starship.toml`.

**D2: `CLAUDE.md` directory structure is out of date**
- Lists `starship/.config/starship.toml` under `config/.config/` — deleted
- Does not list `zsh/.p10k.zsh` — newly added
- Does not list `bin/tmux-status-battery` or `bin/tmux-status-sysinfo` — newly added
- Does not list `zsh/completions/` directory
- Lists `bin/cleanup-chezmoi-files` which has been deleted

**D3: CLAUDE.md says "Prompt configuration" maps to `config/.config/starship.toml`**
The prompt is now Powerlevel10k (`zsh/.p10k.zsh`), not Starship. The "Important Files" table and "Current Tool Stack" need updating.

**D4: README mentions `edit_secrets` is "defined in `.functions.sh`"**
It's actually in `.functions.d/06-dotfiles.zsh`. The monolithic `.functions.sh` no longer exists.

**D5: README mentions `profile_startup` but the alias/function has inconsistent naming**
README says `profile_startup`, the function in `07-docs.zsh` is `profile_startup()`, but the test script in bin is `profile-zsh-startup`. The `profile_startup` function delegates to `bin/profile-startup` which is a different script.

**D6: `docs/CONFIG_MANAGEMENT.md` and `docs/PROMPT_GUIDE.md` may reference starship**
These likely need updates for the p10k migration.

**D7: Brewfile header says "Generated automatically from packages.json"**
But `packages.json` does not exist in the repo. This suggests a workflow that was planned or partially implemented but never completed.

**D8: `CLAUDE.md` directory tree doesn't show `bash/` directory**
The repo contains `bash/.bash_profile` and `bash/.bashrc` (visible in git status), but CLAUDE.md doesn't mention the bash stow package.

**D9: `list_dotfiles_tools()` includes legacy tools that may not apply**
Lists Apache Tomcat 9.0.8, Maven 3.5.3, Ant 1.10.3, MySQL 5.7, and JMeter with hardcoded version numbers. These appear to be leftover from an earlier setup and may not be installed.

**D10: `gffs` command referenced in `init.sh` final instructions (line 1056) but no alias defined**
`gffs` (git-flow feature start) is mentioned in the final instructions but there's no corresponding alias in `.aliases.sh`.

---

## 6. Summary

| Area | Rating | Notes |
|------|--------|-------|
| **Architecture** | Excellent | Modular, well-structured, clear conventions |
| **Performance** | Very Good | Smart lazy-loading and caching; minor room for improvement |
| **Security** | Very Good | SOPS+age, injection protection, Touch ID; solid practices |
| **Developer Experience** | Excellent | Rich aliases, functions, documentation system |
| **Code Quality** | Good | Clean code overall; some duplication and dead references |
| **Documentation** | Good | Comprehensive but partially out of date after p10k migration |
| **Bugs** | Moderate | 12 bugs identified, 3 critical (wrong file paths, missing file, dangerous PATH) |
| **Init Script** | Very Good | Thorough, interactive, with conflict resolution; minor ordering issues |

### Priority Fixes (Quick Wins)
1. Fix `edit-functions` / `edit_functions` aliases to point to `.functions.d/` directory
2. Fix `start_file_server` alias to use Python 3
3. Fix `grepbal` / `searchbal` to use valid ripgrep glob patterns
4. Remove duplicate Rancher Desktop PATH entry from `.zshrc`
5. Update CLAUDE.md directory structure for p10k migration (remove starship refs, add p10k/new scripts)
6. Remove or update the "Generated from packages.json" Brewfile header
7. Fix the `.="pwd"` alias that overrides the source command

### Recommended Next Steps
1. Remove redundant `rehash` from `06-environment.zsh`
2. Clean up the direnv lazy-load hook (remove `_direnv_check` after init)
3. Consolidate duplicate alias sets (hyphenated vs underscored)
4. Consolidate `DOCKER_DEFAULT_PLATFORM` to a single location
5. Fix `init.sh` ordering: backup before stow, fix syntax check targets
6. Consider `zcompile` for frequently-sourced files
7. Audit `list_dotfiles_tools()` for accuracy
