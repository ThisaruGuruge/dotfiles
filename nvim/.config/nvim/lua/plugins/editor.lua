return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    event = { "BufReadPost", "BufNewFile" },
    config = function()
      -- Install parsers (run :TSInstall manually or use this list)
      local parsers = {
        "lua",
        "vim",
        "vimdoc",
        "bash",
        "json",
        "yaml",
        "markdown",
        "markdown_inline",
        "typescript",
        "javascript",
        "go",
        "rust",
        "python",
      }

      -- Auto-install missing parsers when entering a buffer
      vim.api.nvim_create_autocmd("FileType", {
        callback = function()
          local ft = vim.bo.filetype
          local lang = vim.treesitter.language.get_lang(ft) or ft
          if vim.tbl_contains(parsers, lang) then
            pcall(function()
              if not pcall(vim.treesitter.language.inspect, lang) then
                vim.cmd("TSInstall " .. lang)
              end
            end)
          end
          -- Enable treesitter highlighting
          pcall(vim.treesitter.start)
        end,
      })

      -- Incremental selection keymaps using built-in treesitter API
      local function get_node_range(node)
        local sr, sc, er, ec = node:range()
        return sr, sc, er, ec
      end

      local function select_node(node)
        if not node then
          return
        end
        local sr, sc, er, ec = get_node_range(node)
        vim.api.nvim_buf_set_mark(0, "<", sr + 1, sc, {})
        vim.api.nvim_buf_set_mark(0, ">", er + 1, ec - 1, {})
        vim.cmd("normal! gv")
      end

      local selection_stack = {}

      vim.keymap.set("n", "<CR>", function()
        local node = vim.treesitter.get_node()
        if node then
          selection_stack = { node }
          select_node(node)
        end
      end, { desc = "Init treesitter selection" })

      vim.keymap.set("x", "<CR>", function()
        local current = selection_stack[#selection_stack]
        if current then
          local parent = current:parent()
          if parent then
            table.insert(selection_stack, parent)
            select_node(parent)
          end
        end
      end, { desc = "Increment treesitter selection" })

      vim.keymap.set("x", "<BS>", function()
        if #selection_stack > 1 then
          table.remove(selection_stack)
          select_node(selection_stack[#selection_stack])
        end
      end, { desc = "Decrement treesitter selection" })
    end,
  },

  {
    "nvim-lualine/lualine.nvim",
    event = "VeryLazy",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function()
      local json_path = require("thisarug.json_path")

      require("lualine").setup({
        options = {
          icons_enabled = true,
          theme = "auto",
          component_separators = { left = "|", right = "|" },
          section_separators = { left = "", right = "" },
          globalstatus = true,
        },
        sections = {
          -- Left: mode | macro recording | branch | diff | diagnostics
          lualine_a = {
            "mode",
            {
              function()
                local reg = vim.fn.reg_recording()
                if reg ~= "" then
                  return "Recording @" .. reg
                end
                return ""
              end,
              color = { fg = "#1e1e2e", bg = "#f38ba8", gui = "bold" },
            },
          },
          lualine_b = {
            "branch",
            { "diff", symbols = { added = "✚ ", modified = "● ", removed = "✖ " } },
            {
              "diagnostics",
              sources = { "nvim_diagnostic" },
              symbols = { error = " ", warn = " ", info = " ", hint = "󰌵 " },
            },
          },
          -- Center: relative file path | aerial breadcrumb | json path (json files only)
          lualine_c = {
            { "filename", path = 1, symbols = { modified = " [+]", readonly = " [-]", unnamed = "[No Name]" } },
            { "aerial", sep = " › ", depth = 3 },
            {
              json_path.get,
              cond = function()
                return vim.bo.filetype == "json"
              end,
              icon = "{}",
            },
          },
          -- Right: search count | lsp | indent | word count | file size | encoding | format | filetype
          lualine_x = {
            {
              function()
                if vim.v.hlsearch == 0 then
                  return ""
                end
                local ok, result = pcall(vim.fn.searchcount, { maxcount = 999 })
                if not ok or result.total == 0 then
                  return ""
                end
                return string.format("[%d/%d]", result.current, result.total)
              end,
            },
            {
              function()
                local clients = vim.lsp.get_clients({ bufnr = 0 })
                if #clients == 0 then
                  return ""
                end
                local names = {}
                for _, client in ipairs(clients) do
                  table.insert(names, client.name)
                end
                return " " .. table.concat(names, ", ")
              end,
            },
            {
              function()
                if vim.bo.expandtab then
                  return "Spaces: " .. vim.bo.shiftwidth
                else
                  return "Tabs: " .. vim.bo.tabstop
                end
              end,
            },
            {
              function()
                local ft = vim.bo.filetype
                if ft == "markdown" or ft == "text" or ft == "plaintex" or ft == "tex" then
                  return vim.fn.wordcount().words .. " words"
                end
                return ""
              end,
            },
            {
              function()
                local file = vim.fn.expand("%:p")
                if file == "" or file == nil then
                  return ""
                end
                local size = vim.fn.getfsize(file)
                if size <= 0 then
                  return ""
                end
                if size < 1024 then
                  return size .. "B"
                end
                if size < 1048576 then
                  return string.format("%.1fK", size / 1024)
                end
                return string.format("%.1fM", size / 1048576)
              end,
            },
            {
              function()
                local updates = require("lazy.status").updates()
                if updates then
                  return "󰏔 " .. updates
                end
                return ""
              end,
              cond = function()
                return package.loaded["lazy"] and require("lazy.status").has_updates()
              end,
            },
            "encoding",
            "fileformat",
            "filetype",
          },
          lualine_y = { "progress" },
          lualine_z = { "%l/%L:%c" },
        },
      })
    end,
  },

  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    config = function()
      local wk = require("which-key")
      wk.setup({
        plugins = {
          marks = true,
          registers = true,
          spelling = {
            enabled = false,
          },
          presets = {
            operators = true,
            motions = true,
            text_objects = true,
            windows = true,
            nav = true,
            z = true,
            g = true,
          },
        },
        win = {
          border = "rounded",
          padding = { 1, 2 },
        },
        icons = {
          breadcrumb = "»",
          separator = "→",
          group = "+",
        },
        show_help = true,
        show_keys = true,
        triggers = {
          { "<leader>", mode = "n" },
          { "<auto>", mode = "nxsot" },
        },
        -- Expand groups by default
        expand = 1,
        -- Show keybindings faster
        delay = 200,
      })

      -- Register keybindings with which-key (includes both binding and description)
      wk.add({
        -- Leader groups (with clear visual indicators)
        { "<leader>c", group = " Copy...", icon = "" },
        { "<leader>f", group = "󰍉 Find/Search...", icon = "" },
        { "<leader>g", group = " Git...", icon = "" },
        { "<leader>l", group = " LSP...", icon = "" },
        { "<leader>z", group = " Spell/Grammar...", icon = "" },
        { "<leader>t", group = " Toggle...", icon = "" },
        { "<leader>x", group = " Trouble/Diagnostics...", icon = "" },

        -- Find/Telescope mappings (with commands)
        { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find Files", icon = "" },
        { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Find Buffers", icon = "" },
        { "<leader>fh", "<cmd>Telescope help_tags<cr>", desc = "Find Help", icon = "" },
        { "<leader>fr", "<cmd>Telescope oldfiles<cr>", desc = "Recent Files", icon = "" },
        { "<leader>fw", "<cmd>Telescope grep_string<cr>", desc = "Find Word Under Cursor", icon = "" },
        { "<leader>fk", "<cmd>Telescope keymaps<cr>", desc = "Find Keymaps", icon = "" },
        {
          "<leader>fs",
          "<cmd>Telescope current_buffer_fuzzy_find<cr>",
          desc = "Search in Buffer",
          icon = "",
        },
        {
          "<leader>fS",
          "<cmd>Telescope lsp_dynamic_workspace_symbols<cr>",
          desc = "Search Symbols (Workspace)",
          icon = "",
        },
        { "<leader>fy", "<cmd>Telescope neoclip<cr>", desc = "Clipboard History", icon = "" },

        -- File explorer (yazi)
        { "<leader>or", "<cmd>Yazi cwd<cr>", desc = " File Explorer (cwd)", icon = "" },
        { "<leader>oc", "<cmd>Yazi<cr>", desc = " File Explorer (current file)", icon = "" },

        -- Ctrl mappings
        { "<C-p>", "<cmd>Telescope git_files<cr>", desc = "Find Git Files", icon = "" },

        -- Git mappings (will be registered by gitsigns, these are placeholders)
        { "<leader>gs", desc = "Stage Hunk", icon = "" },
        { "<leader>gr", desc = "Reset Hunk", icon = "" },
        { "<leader>gS", desc = "Stage Buffer", icon = "" },
        { "<leader>gu", desc = "Undo Stage Hunk", icon = "" },
        { "<leader>gR", desc = "Reset Buffer", icon = "" },
        { "<leader>gp", desc = "Preview Hunk", icon = "" },
        { "<leader>gt", desc = "Toggle Deleted Lines (inline)", icon = "" },
        { "<leader>gb", desc = "Blame Line", icon = "" },
        { "<leader>gd", desc = "Diff This", icon = "" },
        { "<leader>gD", desc = "Diff This ~", icon = "" },
        { "<leader>gg", desc = "LazyGit", icon = "" },

        -- LSP mappings (will be set in LspAttach, these help which-key)
        { "<leader>lr", desc = "Rename Symbol", icon = "" },
        { "<leader>la", desc = "Code Action", icon = "" },
        { "<leader>lf", desc = "Format Buffer", icon = "" },
        { "<leader>ld", desc = "Show Diagnostics", icon = "" },
        { "<leader>lq", desc = "Buffer Diagnostics to Quickfix", icon = "" },
        { "<leader>lW", desc = "Workspace Diagnostics to Quickfix", icon = "" },
        { "<leader>ll", desc = "Lint Buffer", icon = "" },

        -- Spell/grammar mappings (set in lsp.lua, registered here for which-key)
        { "<leader>zn", desc = "Next Spell Issue", icon = "" },
        { "<leader>zp", desc = "Previous Spell Issue", icon = "" },
        { "<leader>zf", desc = "Fix Spell/Typo", icon = "" },
        { "<leader>zu", desc = "Add to User Dictionary", icon = "" },
        { "<leader>zw", desc = "Add to Workspace Dictionary", icon = "" },
        { "<leader>zi", desc = "Ignore this Harper Lint", icon = "" },

        -- Toggle mappings
        { "<leader>tt", desc = "Toggle Terminal", icon = "" },
        { "<leader>tm", desc = "Toggle Markdown Render", icon = "" },
        { "<leader>tw", "<cmd>set wrap!<cr>", desc = "Toggle Wrap", icon = "" },
        { "<leader>u", desc = "Toggle Undotree", icon = "" },
        { "<leader>a", desc = "Toggle Outline", icon = "" },

        -- Trouble mappings
        { "<leader>xx", desc = "Diagnostics (Trouble)", icon = "" },
        { "<leader>xX", desc = "Buffer Diagnostics (Trouble)", icon = "" },
        { "<leader>xs", desc = "Symbols (Trouble)", icon = "" },
        { "<leader>xr", desc = "LSP References (Trouble)", icon = "" },
        { "<leader>xl", desc = "Location List (Trouble)", icon = "" },
        { "<leader>xq", desc = "Quickfix List (Trouble)", icon = "" },

        -- Flash (jump/motion)
        { "s", desc = "Flash Jump", icon = "⚡" },
        { "S", desc = "Flash Treesitter", icon = "⚡" },

        -- Navigation group (g prefix)
        { "g", group = " Go to / Navigate..." },
        { "gd", desc = "Go to Definition", icon = "" },
        { "gD", desc = "Go to Declaration", icon = "" },
        { "gr", desc = "Find References", icon = "" },
        { "gi", desc = "Go to Implementation", icon = "" },

        -- Diagnostics navigation
        { "[d", desc = "Previous Diagnostic", icon = "" },
        { "]d", desc = "Next Diagnostic", icon = "" },
        { "[c", desc = "Previous Git Hunk", icon = "" },
        { "]c", desc = "Next Git Hunk", icon = "" },
        { "[t", desc = "Previous TODO Comment", icon = "" },
        { "]t", desc = "Next TODO Comment", icon = "" },

        -- Quickfix navigation
        { "[q", desc = "Previous Quickfix item", icon = "" },
        { "]q", desc = "Next Quickfix item", icon = "" },

        -- Location list navigation (e.g. gO document symbols)
        { "[l", desc = "Previous Location-list item", icon = "" },
        { "]l", desc = "Next Location-list item", icon = "" },

        -- Move selected lines up/down in visual mode
        { "J", ":move '>+1<CR>gv=gv", desc = "Move Selection Down", mode = "v" },
        { "K", ":move '<-2<CR>gv=gv", desc = "Move Selection Up", mode = "v" },

        -- Copy file path/name
        {
          "<leader>cy",
          function()
            local path = vim.fn.expand("%:.")
            vim.fn.setreg("+", path)
            vim.notify("Copied: " .. path)
          end,
          desc = "Copy Relative Path",
          icon = "",
        },
        {
          "<leader>cY",
          function()
            local path = vim.fn.expand("%:p")
            vim.fn.setreg("+", path)
            vim.notify("Copied: " .. path)
          end,
          desc = "Copy Absolute Path",
          icon = "",
        },
        {
          "<leader>cn",
          function()
            local name = vim.fn.expand("%:t")
            vim.fn.setreg("+", name)
            vim.notify("Copied: " .. name)
          end,
          desc = "Copy Filename",
          icon = "",
        },

        -- Other useful mappings
        { "K", desc = "Hover Documentation", icon = "" },
        {
          "<leader>?",
          function()
            require("telescope.builtin").keymaps()
          end,
          desc = " Search All Keybindings",
          icon = "",
        },
        {
          "<leader><leader>",
          function()
            require("which-key").show({ keys = "<leader>", loop = false })
          end,
          desc = " Show This Menu",
          icon = "",
        },
      })
    end,
  },

  {
    "saghen/blink.cmp",
    version = "*",
    dependencies = {
      "L3MON4D3/LuaSnip",
      "rafamadriz/friendly-snippets",
    },
    opts = {
      keymap = {
        preset = "default",
        ["<Tab>"] = { "select_next", "snippet_forward", "fallback" },
        ["<S-Tab>"] = { "select_prev", "snippet_backward", "fallback" },
        ["<CR>"] = { "accept", "fallback" },
        ["<C-e>"] = { "cancel", "fallback" },
        ["<C-b>"] = { "scroll_documentation_up", "fallback" },
        ["<C-f>"] = { "scroll_documentation_down", "fallback" },
      },
      appearance = {
        nerd_font_variant = "mono",
      },
      sources = {
        default = { "lsp", "path", "snippets", "buffer", "lazydev" },
        providers = {
          lazydev = {
            name = "LazyDev",
            module = "lazydev.integrations.blink",
            score_offset = 100,
          },
        },
      },
      snippets = { preset = "luasnip" },
      -- Auto-show signature help as you type inside function args
      signature = {
        enabled = true,
        window = { border = "rounded" },
      },
      completion = {
        -- Auto-show documentation popup alongside completions
        documentation = {
          auto_show = true,
          auto_show_delay_ms = 200,
          window = { border = "rounded" },
        },
      },
    },
  },

  {
    "akinsho/toggleterm.nvim",
    version = "*",
    keys = {
      { "<leader>tt", "<cmd>ToggleTerm<cr>", desc = "Toggle terminal" },
    },
    config = function()
      require("toggleterm").setup({
        size = 12,
        open_mapping = [[<c-\>]],
        shade_terminals = true,
        direction = "float",
        float_opts = {
          border = "curved",
        },
      })
    end,
  },
}
