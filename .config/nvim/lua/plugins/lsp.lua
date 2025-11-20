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
        dependencies = { "williamboman/mason.nvim" },
        event = { "BufReadPre", "BufNewFile" },
        config = function()
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
            })
        end,
    },

    -- LSP Config
    {
        "neovim/nvim-lspconfig",
        dependencies = {
            "williamboman/mason-lspconfig.nvim",
            "hrsh7th/cmp-nvim-lsp",
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

            local lspconfig = require("lspconfig")
            local capabilities = require("cmp_nvim_lsp").default_capabilities()

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

            -- Remove this - lua_ls will be configured by the handler below

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

            -- Setup handlers for all servers
            local mason_lspconfig = require("mason-lspconfig")
            mason_lspconfig.setup_handlers({
                -- Default handler for all servers
                function(server_name)
                    local config = {
                        capabilities = capabilities,
                    }

                    -- Lua-specific settings (neodev handles workspace/diagnostics)
                    if server_name == "lua_ls" then
                        config.settings = {
                            Lua = {
                                completion = {
                                    callSnippet = "Replace",
                                },
                                telemetry = {
                                    enable = false,
                                },
                            },
                        }
                    end

                    lspconfig[server_name].setup(config)
                end,
            })

            -- Ballerina LSP (manual setup - not in Mason)
            -- Install: Download from https://ballerina.io/downloads/
            -- The LSP server comes bundled with Ballerina
            lspconfig.ballerina.setup({
                capabilities = capabilities,
                cmd = { "bal", "start-language-server" },
                filetypes = { "ballerina" },
                root_dir = lspconfig.util.root_pattern("Ballerina.toml", ".git"),
            })
        end,
    },
}
