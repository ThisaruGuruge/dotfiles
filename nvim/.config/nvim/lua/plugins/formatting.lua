return {
  -- Auto-pairs: Automatically close brackets, quotes, etc.
  {
    "windwp/nvim-autopairs",
    event = "InsertEnter",
    config = function()
      require("nvim-autopairs").setup({
        check_ts = true,
        ts_config = {
          lua = { "string" },
          javascript = { "template_string" },
        },
      })
    end,
  },

  -- Conform: Formatting
  {
    "stevearc/conform.nvim",
    event = { "BufWritePre" },
    cmd = { "ConformInfo", "FormatDisable", "FormatEnable" },
    keys = {
      {
        "<leader>lf",
        function()
          require("conform").format({ async = true })
        end,
        mode = "",
        desc = "Format buffer",
      },
    },
    config = function()
      require("conform").setup({
        formatters = {
          prettierd = {
            args = function(self, ctx)
              local args = { "--stdin-filepath", ctx.filename }
              if ctx.filetype == "markdown" then
                table.insert(args, 1, "--prose-wrap=preserve")
              end
              return args
            end,
          },
          -- Scoped to indentation only: the default ruleset is CodeNarc's
          -- full application-code rule set (see lsp.lua's Groovy/Gradle
          -- comment for why that's unusable on a build.gradle). Trailing
          -- whitespace is handled by the separate `trim_whitespace` formatter
          -- listed next to it in formatters_by_ft, so it's left out here.
          ["npm-groovy-lint"] = {
            args = { "--fix", "-r", "Indentation,IndentationClosingBraces,IndentationComments", "$FILENAME" },
          },
        },
        formatters_by_ft = {
          lua = { "stylua" },
          -- ruff (Mason, see lsp.lua ensure_installed) is the one Python
          -- formatter and import sorter: isort + black start through pyenv
          -- shims at ~1 s per save, ruff takes ~20 ms.
          python = { "ruff_organize_imports", "ruff_format" },
          javascript = { "prettierd", "prettier", stop_after_first = true },
          typescript = { "prettierd", "prettier", stop_after_first = true },
          javascriptreact = { "prettierd", "prettier", stop_after_first = true },
          typescriptreact = { "prettierd", "prettier", stop_after_first = true },
          json = { "prettierd", "prettier", stop_after_first = true },
          yaml = { "prettierd", "prettier", stop_after_first = true },
          markdown = { "prettierd", "prettier", stop_after_first = true },
          go = { "gofmt", "goimports" },
          -- jdtls formats Java (google_java_format isn't installed). "prefer"
          -- uses only the language server when one is attached.
          java = { lsp_format = "prefer" },
          groovy = { "npm-groovy-lint", "trim_whitespace" },
          rust = { "rustfmt" },
          sh = { "shfmt" },
          -- Every filetype without an entry above (Ballerina, Dockerfile, ...):
          -- the language server formats first when one is attached, then
          -- trailing whitespace is trimmed. Not `["*"]`: a wildcard entry
          -- counts as a formatter for every filetype, so conform would never
          -- fall back to the language server.
          ["_"] = { "trim_whitespace", lsp_format = "first" },
        },
        -- Filetypes with a CLI formatter list use the language server only
        -- when none of those formatters is available. Do not pass
        -- lsp_fallback at the call sites: call-site options override
        -- per-filetype ones and would cancel the java and `_` entries.
        default_format_opts = { lsp_format = "fallback" },
        format_on_save = function(bufnr)
          if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
            return
          end
          -- Big buffers: formatting takes seconds and hits the timeout.
          -- <leader>lf still formats explicitly.
          if require("thisarug.bigfile").is_big(bufnr) then
            return
          end
          return { timeout_ms = 3000 }
        end,
      })

      vim.api.nvim_create_user_command("FormatDisable", function(args)
        if args.bang then
          vim.b.disable_autoformat = true
        else
          vim.g.disable_autoformat = true
        end
      end, { desc = "Disable autoformat-on-save (! for buffer only)", bang = true })

      vim.api.nvim_create_user_command("FormatEnable", function()
        vim.b.disable_autoformat = false
        vim.g.disable_autoformat = false
      end, { desc = "Re-enable autoformat-on-save" })
    end,
  },
}
