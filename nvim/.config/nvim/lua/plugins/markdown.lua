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
    config = function(_, opts)
      require("render-markdown").setup(opts)

      -- Default code block/inline highlights link to ColorColumn, which is
      -- too close to the rose-pine background to read as a distinct block
      -- in dark mode. Use higher-contrast rose-pine surfaces instead.
      local ok, palette = pcall(require, "rose-pine.palette")
      if ok then
        vim.api.nvim_set_hl(0, "RenderMarkdownCode", { bg = palette.overlay })
        vim.api.nvim_set_hl(0, "RenderMarkdownCodeInline", { bg = palette.highlight_med, fg = palette.text })
        vim.api.nvim_set_hl(0, "RenderMarkdownCodeInfo", { fg = palette.iris, bg = palette.overlay, italic = true })
      end
    end,
    keys = {
      { "<leader>tm", "<cmd>RenderMarkdown toggle<cr>", desc = "Toggle Markdown Render" },
    },
  },
}
