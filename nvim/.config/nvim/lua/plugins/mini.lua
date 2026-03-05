return {
  {
    "echasnovski/mini.ai",
    version = "*",
    event = "VeryLazy",
    config = function()
      require("mini.ai").setup({
        -- Search up to 500 lines away for text objects
        n_lines = 500,
      })
    end,
  },
}
