#!/bin/zsh
# ============================================================================
# Functions Loader (Backward Compatibility Wrapper)
# ============================================================================
# This file is kept for backward compatibility. Functions have been modularized
# into .functions.d/ directory for better organization and maintainability.
#
# Module structure:
#   .functions.d/
#   ├── 00-colors.zsh     # Color variables
#   ├── 01-core.zsh       # cd(), confirm()
#   ├── 02-navigation.zsh # take(), takedir(), takegit(), takeurl()
#   ├── 03-archives.zsh   # compress(), extract()
#   ├── 04-git.zsh        # git_ignore_local()
#   ├── 05-system.zsh     # checkPort(), kill_by_port()
#   ├── 06-dotfiles.zsh   # edit_secrets(), edit_dotfiles(), update_dotfiles()
#   ├── 07-docs.zsh       # show_tools(), alias_help(), alias_docs()
#   └── 08-packages.zsh   # manage_packages(), install_lazygit_latest()

# Source all modular function files
for file in "$HOME/.functions.d"/*.zsh; do
    [[ -r "$file" ]] && source "$file"
done
