# ZSH Custom Completions

This directory contains custom ZSH completion functions that provide descriptions and enhanced tab completion for aliases and functions.

## How It Works

- Completion files start with `_` (ZSH convention)
- The directory is stowed to `~/completions/` and added to `fpath` by
  `.zshrc.d/02-completion.zsh` (before `compinit` runs), so they load with the
  rest of the completion system
- bestow links per file, not per directory: after adding a new `_file`, run
  `bestow stow zsh` so it is linked into `~/completions/`
- `compinit` caches its results in `~/.zcompdump*`; after adding a new `_file`,
  delete the dump once (`rm ~/.zcompdump*`) and open a new shell, or the new
  completion is not picked up until the dump is regenerated

## Current Completions

- `_extract` - `extract <TAB>` offers only archive files (zip, tar.*, rar, 7z, ...)
- `_kill_by_port` - `kill_by_port <TAB>` lists the TCP ports something is listening on, with the owning command
- `_awake` - `awake <TAB>` offers the subcommands, durations after `for`, and PIDs
- `_envrc` - `envrc <TAB>` offers `work`, `personal`, `status` and `off`
- `_install_lazygit_latest` - `install_lazygit_latest <TAB>` offers `install`, `update` and `check`
- `_dotdoctor` - `dotdoctor <TAB>` offers `--full` and `-h`/`--help`

Completions attach to the command name the user types, and an alias expands
before completion runs (`complete_aliases` is unset), so do not add a `#compdef`
for an alias name such as `reload` or `edit-*`: it would never fire. Complete
the function or script the alias points at instead.

## Adding New Completions

To add a new completion:

1. Create a file named `_commandname` in this directory
2. Use `#compdef commandname` at the top
3. Define completion logic using `_describe` or other ZSH completion functions
4. Reload shell with `reload` or start a new shell

## Testing

After creating a new completion file:

```bash
# Clear completion cache
rm ~/.zcompdump*

# Reload shell
reload

# Test with TAB
your-command <TAB>
```

## Resources

- [ZSH Completion System](https://zsh.sourceforge.io/Doc/Release/Completion-System.html)
- [Writing ZSH Completions](https://github.com/zsh-users/zsh-completions/blob/master/zsh-completions-howto.org)
