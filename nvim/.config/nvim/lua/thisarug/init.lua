local opt = vim.opt

-- Line numbers
opt.number = true
opt.relativenumber = true

-- Indentation
opt.tabstop = 4
opt.shiftwidth = 4
opt.softtabstop = 4
opt.expandtab = true

-- Search
opt.ignorecase = true
opt.smartcase = true
opt.hlsearch = false
opt.incsearch = true

-- UI
opt.termguicolors = true
opt.signcolumn = "yes"
opt.scrolloff = 20
opt.wrap = false

-- System integration
opt.clipboard = "unnamedplus"
opt.mouse = "a"

-- Persistence
opt.undofile = true
opt.swapfile = false
opt.backup = false

-- Performance
opt.updatetime = 50

-- Ruler
opt.colorcolumn = "80,120"

-- Folding (treesitter-based)
opt.foldmethod = "expr"
opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
opt.foldlevel = 99
opt.foldlevelstart = 99
opt.foldenable = true

opt.fixendofline = true

-- Note: All keybindings are now managed by which-key in plugins/editor.lua
