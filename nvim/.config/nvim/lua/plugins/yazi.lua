return {
  {
    "mikavilpas/yazi.nvim",
    event = "VeryLazy",
    keys = {
      -- Not <C-Up>: macOS Mission Control owns Ctrl+Up, so it never reaches the
      -- terminal. <leader>o is the "open" group (or/oc live in editor.lua).
      { "<leader>oy", "<cmd>Yazi toggle<cr>", desc = "Resume last yazi session" },
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
