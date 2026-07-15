return {
  {
    "MeanderingProgrammer/render-markdown.nvim",
    ft = { "markdown" },
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
    opts = {
      heading = { sign = false },
      code = { style = "full" },
      bullet = { icons = { "●", "○", "◆", "◇" } },
    },
    keys = {
      { "<leader>tm", "<cmd>RenderMarkdown toggle<cr>", desc = "Toggle Markdown Render" },
    },
  },
}
