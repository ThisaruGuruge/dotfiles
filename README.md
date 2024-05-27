# The `dotfiles` repository contains the dotfiles I use on my personal machines.

## Pre-requisites

1. Install [git](https://git-scm.com/).
2. Install [GNU Stow](https://www.gnu.org/software/stow/).
3. Install [iTerm2](https://iterm2.com/).
4. Install [zsh](https://www.zsh.org/).
5. Install [nerd fonts](https://github.com/ryanoasis/nerd-fonts).
6. Install [zinit](https://github.com/zdharma-continuum/zinit).
7. Install [fzf](https://github.com/Aloxaf/fzf-tab).

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/ThisaruGuruge/dotfiles.git ~/.dotfiles
    ```

2. Change the directory to the repository:

    ```bash
    cd ~/.dotfiles
    ```

3. Run the `stow` command to create symlinks:

    ```bash
    stow .
    ```
