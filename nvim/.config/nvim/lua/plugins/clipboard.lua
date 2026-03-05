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
              paste = "<C-p>",
              paste_behind = "<C-k>",
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
