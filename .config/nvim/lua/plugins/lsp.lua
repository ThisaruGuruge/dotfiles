return {
    -- Mason: LSP installer
    {
        "williamboman/mason.nvim",
        cmd = "Mason",
        build = ":MasonUpdate",
        config = function()
            require("mason").setup({
                ui = {
                    border = "rounded",
                    icons = {
                        package_installed = "✓",
                        package_pending = "➜",
                        package_uninstalled = "✗",
                    },
                },
            })
        end,
    },

    -- Mason LSP Config: Bridge between mason and lspconfig
    {
        "williamboman/mason-lspconfig.nvim",
        dependencies = {
            "williamboman/mason.nvim",
            "neovim/nvim-lspconfig",
            "hrsh7th/cmp-nvim-lsp",
        },
        lazy = false,
        config = function()
            local capabilities = require("cmp_nvim_lsp").default_capabilities()

            require("mason-lspconfig").setup({
                ensure_installed = {
                    "lua_ls",
                    "gopls",
                    "pyright",
                    "ts_ls",
                    "rust_analyzer",
                    "bashls",
                    "jsonls",
                    "yamlls",
                    "marksman", -- Markdown LSP
                },
                automatic_installation = true,
                handlers = {
                    -- Default handler for all servers
                    function(server_name)
                        require("lspconfig")[server_name].setup({
                            capabilities = capabilities,
                        })
                    end,
                    -- Lua-specific settings
                    ["lua_ls"] = function()
                        require("lspconfig").lua_ls.setup({
                            capabilities = capabilities,
                            settings = {
                                Lua = {
                                    completion = {
                                        callSnippet = "Replace",
                                    },
                                    telemetry = {
                                        enable = false,
                                    },
                                },
                            },
                        })
                    end,
                },
            })
        end,
    },

    -- LSP Config
    {
        "neovim/nvim-lspconfig",
        dependencies = {
            "williamboman/mason-lspconfig.nvim",
            "folke/neodev.nvim",
        },
        event = { "BufReadPre", "BufNewFile" },
        config = function()
            -- Setup neodev BEFORE lspconfig for Neovim Lua API completion
            require("neodev").setup({
                library = {
                    enabled = true, -- Enable neodev for all lua files
                    plugins = true, -- Include plugin definitions
                },
            })

            -- LSP keybindings using LspAttach autocmd (Neovim 0.11+)
            vim.api.nvim_create_autocmd("LspAttach", {
                callback = function(args)
                    local bufnr = args.buf
                    local opts = { buffer = bufnr, silent = true }

                    vim.keymap.set("n", "gd", vim.lsp.buf.definition,
                        vim.tbl_extend("force", opts, { desc = "Go to definition" }))
                    vim.keymap.set("n", "gD", vim.lsp.buf.declaration,
                        vim.tbl_extend("force", opts, { desc = "Go to declaration" }))
                    vim.keymap.set("n", "gr", vim.lsp.buf.references,
                        vim.tbl_extend("force", opts, { desc = "Find references" }))
                    vim.keymap.set("n", "gi", vim.lsp.buf.implementation,
                        vim.tbl_extend("force", opts, { desc = "Go to implementation" }))
                    vim.keymap.set("n", "K", vim.lsp.buf.hover,
                        vim.tbl_extend("force", opts, { desc = "Hover documentation" }))
                    vim.keymap.set("n", "<leader>lr", vim.lsp.buf.rename,
                        vim.tbl_extend("force", opts, { desc = "Rename symbol" }))
                    vim.keymap.set("n", "<leader>la", vim.lsp.buf.code_action,
                        vim.tbl_extend("force", opts, { desc = "Code action" }))
                    -- Formatting is handled by conform.nvim (see formatting.lua)
                    vim.keymap.set("n", "<leader>ld", vim.diagnostic.open_float,
                        vim.tbl_extend("force", opts, { desc = "Show diagnostics" }))
                    vim.keymap.set("n", "[d", vim.diagnostic.goto_prev,
                        vim.tbl_extend("force", opts, { desc = "Previous diagnostic" }))
                    vim.keymap.set("n", "]d", vim.diagnostic.goto_next,
                        vim.tbl_extend("force", opts, { desc = "Next diagnostic" }))
                end,
            })

            -- Configure diagnostic display
            vim.diagnostic.config({
                virtual_text = true,
                signs = true,
                update_in_insert = false,
                underline = true,
                severity_sort = true,
                float = {
                    border = "rounded",
                    source = "always",
                },
            })

            -- Ballerina LSP (manual setup - not in Mason)
            -- Install: Download from https://ballerina.io/downloads/
            -- The LSP server comes bundled with Ballerina
            local capabilities = require("cmp_nvim_lsp").default_capabilities()

            vim.lsp.config("ballerina", {
                capabilities = capabilities,
                cmd = { "bal", "start-language-server" },
                filetypes = { "ballerina" },
                root_markers = { "Ballerina.toml", ".git" },
            })
            vim.lsp.enable("ballerina")
        end,
    },
}
