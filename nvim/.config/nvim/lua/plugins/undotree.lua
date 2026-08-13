return {
  "mbbill/undotree",
  keys = {
    { "<leader>u", "<cmd>UndotreeToggle<cr>", desc = "Toggle Undotree" },
  },
  config = function()
    -- Focus undotree window when opened
    vim.g.undotree_SetFocusWhenToggle = 1
    -- Use short timestamps
    vim.g.undotree_ShortIndicators = 1
    -- Set window layout (tree on left, diff below)
    vim.g.undotree_WindowLayout = 2
    -- Set tree width
    vim.g.undotree_SplitWidth = 30

    -- Undotree only refreshes the diff panel when you actually step to a
    -- state, not when the cursor merely moves over a tree line (which can
    -- also land on branch/connector art, not a real entry). It already
    -- ships J/K for stepping through states one at a time via earlier/
    -- later, positioning the cursor on the correct entry itself either
    -- way. Alias lowercase j/k to the same actions for normal j/k muscle
    -- memory, giving a live diff preview as you step through history.
    vim.api.nvim_create_autocmd("FileType", {
      pattern = "undotree",
      callback = function(args)
        vim.keymap.set("n", "j", "<Plug>UndotreePreviousState", { buffer = args.buf, silent = true, remap = true })
        vim.keymap.set("n", "k", "<Plug>UndotreeNextState", { buffer = args.buf, silent = true, remap = true })
      end,
    })
  end,
}
