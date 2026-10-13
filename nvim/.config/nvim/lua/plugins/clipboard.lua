return {
  {
    "AckslD/nvim-neoclip.lua",
    dependencies = { "nvim-telescope/telescope.nvim" },
    event = "TextYankPost",
    config = function()
      require("neoclip").setup({
        history = 100,
        enable_persistent_history = false,
        keys = {
          telescope = {
            i = {
              select = "<CR>",
              -- <C-p> and <C-k> stay Telescope's own keys (move up / scroll
              -- the preview). neoclip merges these tables over its defaults,
              -- so paste_behind must be disabled with `false` rather than
              -- omitted; use P in normal mode instead.
              paste = "<C-y>",
              paste_behind = false,
              delete = "<C-d>",
            },
            n = {
              select = "<CR>",
              paste = "p",
              paste_behind = "P",
              delete = "dd",
            },
          },
        },
      })

      require("telescope").load_extension("neoclip")
    end,
  },
}
