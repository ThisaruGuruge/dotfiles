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
                    "jdtls", -- Java LSP
                    "ruff", -- Python linter/formatter with code actions
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
                    -- Python-specific settings
                    ["pyright"] = function()
                        require("lspconfig").pyright.setup({
                            capabilities = capabilities,
                            settings = {
                                pyright = {
                                    -- Using Ruff's import organizer
                                    disableOrganizeImports = true,
                                },
                                python = {
                                    analysis = {
                                        autoSearchPaths = true,
                                        useLibraryCodeForTypes = true,
                                        diagnosticMode = "workspace",
                                        typeCheckingMode = "basic",
                                        -- Enable all language features
                                        autoImportCompletions = true,
                                    },
                                },
                            },
                            on_attach = function(client, bufnr)
                                -- Ensure Pyright provides navigation features
                                client.server_capabilities.definitionProvider = true
                                client.server_capabilities.referencesProvider = true
                                client.server_capabilities.declarationProvider = true
                                client.server_capabilities.implementationProvider = true
                            end,
                        })
                    end,
                    -- Ruff LSP for Python linting and code actions
                    ["ruff"] = function()
                        require("lspconfig").ruff.setup({
                            capabilities = capabilities,
                            init_options = {
                                settings = {
                                    -- Ruff configuration
                                    args = {},
                                },
                            },
                            on_attach = function(client, bufnr)
                                -- Disable Ruff's hover in favor of Pyright
                                client.server_capabilities.hoverProvider = false
                                -- Ruff doesn't provide navigation, only code actions
                                client.server_capabilities.definitionProvider = false
                                client.server_capabilities.referencesProvider = false
                            end,
                        })
                    end,
                    -- Java-specific settings
                    ["jdtls"] = function()
                        local jdtls_path = require("mason-registry").get_package("jdtls"):get_install_path()
                        local jdtls_launcher = vim.fn.glob(jdtls_path .. "/plugins/org.eclipse.equinox.launcher_*.jar")
                        local jdtls_config = vim.fn.glob(jdtls_path .. "/config_mac")

                        require("lspconfig").jdtls.setup({
                            capabilities = capabilities,
                            cmd = {
                                "java",
                                "-Declipse.application=org.eclipse.jdt.ls.core.id1.JavaLanguageServerImpl",
                                "-Dosgi.bundles.defaultStartLevel=4",
                                "-Declipse.product=org.eclipse.jdt.ls.core.product",
                                "-Dlog.protocol=true",
                                "-Dlog.level=ALL",
                                "-Xms1g",
                                "--add-modules=ALL-SYSTEM",
                                "--add-opens",
                                "java.base/java.util=ALL-UNNAMED",
                                "--add-opens",
                                "java.base/java.lang=ALL-UNNAMED",
                                "-jar",
                                jdtls_launcher,
                                "-configuration",
                                jdtls_config,
                                "-data",
                                vim.fn.stdpath("cache") .. "/jdtls-workspace/" .. vim.fn.fnamemodify(vim.fn.getcwd(), ":p:h:t"),
                            },
                            -- Here you can configure project-specific settings, like runtimes
                            -- See: https://github.com/mfussenegger/nvim-jdtls#project-specific-runtimes
                            root_dir = require("lspconfig").util.root_pattern {
                                ".git",
                                "mvnw",
                                "gradlew",
                                "pom.xml",
                                "build.gradle",
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
                    local client = vim.lsp.get_client_by_id(args.data.client_id)
                    local opts = { buffer = bufnr, silent = true }

                    -- Use Telescope for LSP features if available, otherwise fall back to built-in
                    local has_telescope = pcall(require, "telescope.builtin")

                    vim.keymap.set("n", "gd", vim.lsp.buf.definition,
                        vim.tbl_extend("force", opts, { desc = "Go to definition" }))
                    vim.keymap.set("n", "gD", vim.lsp.buf.declaration,
                        vim.tbl_extend("force", opts, { desc = "Go to declaration" }))

                    if has_telescope then
                        vim.keymap.set("n", "gr", "<cmd>Telescope lsp_references<cr>",
                            vim.tbl_extend("force", opts, { desc = "Find references" }))
                        vim.keymap.set("n", "gi", "<cmd>Telescope lsp_implementations<cr>",
                            vim.tbl_extend("force", opts, { desc = "Go to implementation" }))
                    else
                        vim.keymap.set("n", "gr", vim.lsp.buf.references,
                            vim.tbl_extend("force", opts, { desc = "Find references" }))
                        vim.keymap.set("n", "gi", vim.lsp.buf.implementation,
                            vim.tbl_extend("force", opts, { desc = "Go to implementation" }))
                    end

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
        end,
    },
}
