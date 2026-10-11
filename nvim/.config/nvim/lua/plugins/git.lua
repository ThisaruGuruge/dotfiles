return {
  -- Gitsigns: Git gutter signs and hunk actions
  {
    "lewis6991/gitsigns.nvim",
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      require("gitsigns").setup({
        signs = {
          add = { text = "│" },
          change = { text = "│" },
          delete = { text = "_" },
          topdelete = { text = "‾" },
          changedelete = { text = "~" },
          untracked = { text = "┆" },
        },
        current_line_blame = true, -- Enable inline blame
        current_line_blame_opts = {
          virt_text = true,
          virt_text_pos = "eol", -- 'eol' | 'overlay' | 'right_align'
          delay = 500, -- Delay in ms before showing blame
          ignore_whitespace = false,
        },
        current_line_blame_formatter = "<author>, <author_time:%Y-%m-%d> - <summary>",
        on_attach = function(bufnr)
          local gs = package.loaded.gitsigns

          local function map(mode, l, r, opts)
            opts = opts or {}
            opts.buffer = bufnr
            vim.keymap.set(mode, l, r, opts)
          end

          -- Navigation
          map("n", "]c", function()
            if vim.wo.diff then
              return "]c"
            end
            vim.schedule(function()
              gs.next_hunk()
            end)
            return "<Ignore>"
          end, { expr = true, desc = "Next git hunk" })

          map("n", "[c", function()
            if vim.wo.diff then
              return "[c"
            end
            vim.schedule(function()
              gs.prev_hunk()
            end)
            return "<Ignore>"
          end, { expr = true, desc = "Previous git hunk" })

          -- Actions
          map("n", "<leader>gs", gs.stage_hunk, { desc = "Stage hunk" })
          map("n", "<leader>gr", gs.reset_hunk, { desc = "Reset hunk" })
          map("v", "<leader>gs", function()
            gs.stage_hunk({ vim.fn.line("."), vim.fn.line("v") })
          end, { desc = "Stage hunk" })
          map("v", "<leader>gr", function()
            gs.reset_hunk({ vim.fn.line("."), vim.fn.line("v") })
          end, { desc = "Reset hunk" })
          map("n", "<leader>gS", gs.stage_buffer, { desc = "Stage buffer" })
          map("n", "<leader>gu", gs.undo_stage_hunk, { desc = "Undo stage hunk" })
          map("n", "<leader>gR", gs.reset_buffer, { desc = "Reset buffer" })
          map("n", "<leader>gp", gs.preview_hunk, { desc = "Preview hunk" })
          map("n", "<leader>gt", gs.toggle_deleted, { desc = "Toggle deleted lines (inline)" })
          map("n", "<leader>gb", function()
            gs.blame_line({ full = true })
          end, { desc = "Blame line" })
          map("n", "<leader>gd", gs.diffthis, { desc = "Diff this" })
          map("n", "<leader>gD", function()
            gs.diffthis("~")
          end, { desc = "Diff this ~" })
        end,
      })
    end,
  },

  -- Lazygit: Actual lazygit terminal UI in Neovim
  {
    "kdheepak/lazygit.nvim",
    cmd = {
      "LazyGit",
      "LazyGitConfig",
      "LazyGitCurrentFile",
      "LazyGitFilter",
      "LazyGitFilterCurrentFile",
    },
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    config = function()
      -- Refresh gitsigns after closing lazygit
      vim.api.nvim_create_autocmd("TermClose", {
        pattern = "*lazygit*",
        callback = function()
          local ok, gs = pcall(require, "gitsigns")
          if ok then
            vim.schedule(function()
              gs.refresh()
            end)
          end
        end,
      })
    end,
    keys = {
      { "<leader>gg", "<cmd>LazyGit<cr>", desc = "LazyGit" },
    },
  },

  -- Diffview: review a whole branch or a file's history in a tabpage UI.
  -- Gitsigns covers hunks in the buffer you are in; this is for "what does
  -- this branch change" and "how did this file get here".
  {
    "sindrets/diffview.nvim",
    cmd = {
      "DiffviewOpen",
      "DiffviewClose",
      "DiffviewToggleFiles",
      "DiffviewFocusFiles",
      "DiffviewRefresh",
      "DiffviewFileHistory",
    },
    keys = {
      {
        "<leader>gv",
        function()
          -- Three dots = diff against the merge base, i.e. only what this
          -- branch added, not whatever the default branch gained since.
          local ref = vim.fn.systemlist("git symbolic-ref --quiet --short refs/remotes/origin/HEAD")[1]
          if vim.v.shell_error ~= 0 or not ref or ref == "" then
            ref = "origin/main"
          end
          vim.cmd("DiffviewOpen " .. ref .. "...HEAD")
        end,
        desc = "Diffview: branch vs default branch",
      },
      { "<leader>gh", "<cmd>DiffviewFileHistory %<cr>", desc = "Diffview: file history" },
      { "<leader>gH", "<cmd>DiffviewFileHistory<cr>", desc = "Diffview: repo history" },
    },
    opts = function()
      local close = { "n", "q", "<cmd>DiffviewClose<cr>", { desc = "Close Diffview" } }
      return {
        enhanced_diff_hl = true,
        keymaps = {
          view = { close },
          file_panel = { close },
          file_history_panel = { close },
        },
      }
    end,
  },
}
