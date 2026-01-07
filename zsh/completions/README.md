# ZSH Custom Completions

This directory contains custom ZSH completion functions that provide descriptions and enhanced tab completion for aliases and functions.

## How It Works

- Completion files start with `_` (ZSH convention)
- They are automatically loaded when `compinit` runs
- The directory is added to `fpath` in `.zshrc`

## Current Completions

- `_edit_commands` - Provides descriptions for all `edit-*` aliases
- `_reload` - Description for the `reload` alias

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
