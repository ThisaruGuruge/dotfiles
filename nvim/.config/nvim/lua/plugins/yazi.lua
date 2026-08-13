return {
  {
    "mikavilpas/yazi.nvim",
    event = "VeryLazy",
    keys = {
      { "<c-up>", "<cmd>Yazi toggle<cr>", desc = "Resume last yazi session" },
    },
    opts = {
      open_for_directories = true,
      floating_window_scaling_factor = 0.9,
      yazi_floating_window_border = "rounded",
    },
    init = function()
      -- Disable netrw since yazi handles directories
      vim.g.loaded_netrwPlugin = 1
    end,
  },
}
