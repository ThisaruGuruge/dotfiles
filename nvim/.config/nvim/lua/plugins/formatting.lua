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
                    require("conform").format({ async = true, lsp_fallback = true })
                end,
                mode = "",
                desc = "Format buffer",
            },
        },
        config = function()
            require("conform").setup({
                formatters_by_ft = {
                    lua = { "stylua" },
                    python = { "isort", "black" },
                    javascript = { "prettierd", "prettier", stop_after_first = true },
                    typescript = { "prettierd", "prettier", stop_after_first = true },
                    javascriptreact = { "prettierd", "prettier", stop_after_first = true },
                    typescriptreact = { "prettierd", "prettier", stop_after_first = true },
                    json = { "prettierd", "prettier", stop_after_first = true },
                    yaml = { "prettierd", "prettier", stop_after_first = true },
                    markdown = { "prettierd", "prettier", stop_after_first = true },
                    go = { "gofmt", "goimports" },
                    java = { "google_java_format" },
                    rust = { "rustfmt" },
                    sh = { "shfmt" },
                    ["*"] = { "trim_whitespace" },
                },
                format_on_save = function(bufnr)
                    if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
                        return
                    end
                    return { timeout_ms = 3000, lsp_fallback = true }
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
