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
opt.linebreak = true -- when wrap is on, break at word boundaries instead of mid-word

-- System integration
opt.clipboard = "unnamedplus"
opt.mouse = "a"

-- Persistence
opt.undofile = true
opt.swapfile = false
opt.backup = false

-- Secrets never get an undo file: undofile saves the buffer's text, unencrypted, under
-- ~/.local/state/nvim/undo, so editing a .env, key or credentials file would leave a
-- readable copy behind. The option is set per buffer before the file is read.
vim.api.nvim_create_autocmd({ "BufReadPre", "BufNewFile" }, {
  group = vim.api.nvim_create_augroup("thisarug_no_secret_undo", { clear = true }),
  pattern = {
    ".env",
    ".env.*",
    "*.env",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "id_rsa*",
    "id_ed25519*",
    "*.tfvars",
    "credentials*",
    "*.secrets.*",
    "secrets.*",
    ".netrc",
    ".npmrc",
    ".pypirc",
    ".git-credentials",
    "gradle.properties",
    "Config.toml", -- Ballerina: configurable values often hold API keys
  },
  callback = function(args)
    vim.bo[args.buf].undofile = false
  end,
})

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
