-- Session persistence: the open buffers, window layout, cwd and folds are
-- written on exit and can be restored later. There is one session per working
-- directory (and per git branch), so reopening a project on a different
-- branch does not drag in the other branch's buffers.
--
-- Nothing is restored automatically — a plain `nvim file` must stay a plain
-- `nvim file`. Restore on demand with <leader>qs, or press `s` on the
-- dashboard (plugins/dashboard.lua).
return {
  "folke/persistence.nvim",
  -- Loaded before the first buffer is read so the autocmd that saves on exit
  -- is in place for every session, including one that only ever opens a file.
  event = "BufReadPre",
  init = function()
    -- Diffview tabs hold scratch buffers that restore as empty windows.
    vim.api.nvim_create_autocmd("User", {
      pattern = "PersistenceSavePre",
      callback = function()
        pcall(vim.cmd, "DiffviewClose")
      end,
    })
  end,
  opts = {
    -- Skip `terminal` and `blank` so toggleterm shells and empty windows are
    -- not saved (they come back respawned or empty).
    options = { "buffers", "curdir", "tabpages", "winsize", "help", "globals", "skiprtp", "folds" },
    -- A quick `nvim README.md` (one buffer) must not overwrite the project's
    -- saved session, so only write one when at least two real buffers are open.
    need = 2,
  },
  keys = {
    {
      "<leader>qs",
      function()
        require("persistence").load()
      end,
      desc = "Restore session (cwd)",
    },
    {
      "<leader>ql",
      function()
        require("persistence").load({ last = true })
      end,
      desc = "Restore last session",
    },
    {
      "<leader>qd",
      function()
        require("persistence").stop()
      end,
      desc = "Don't save current session",
    },
  },
}
