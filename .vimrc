set nocompatible
set number
set visualbell
set noerrorbells
set textwidth=120
set laststatus=2
set tabstop=4
set shiftwidth=4
set expandtab
filetype plugin indent on
syntax on

filetype indent on
set smartindent
autocmd BufRead,BufWritePre *.sh normal gg=G

set statusline=
set statusline+=\ %f
set statusline+=\ Line: 
set statusline+=\ %l
set statusline+=\ Char: 
set statusline+=\ %c

set backspace=indent,eol,start
set noshowmode
set noshowcmd
set shortmess+=F
syntax on
