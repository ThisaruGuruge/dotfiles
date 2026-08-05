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
            "saghen/blink.cmp",
        },
        lazy = false,
        config = function()
            -- mason-lspconfig >= 2.0 dropped the `handlers` setup option in favor
            -- of the native vim.lsp.config()/vim.lsp.enable() API (see :h vim.lsp.config).
            -- Per-server overrides are registered here, then `automatic_enable`
            -- below turns each one on for installed servers.
            local capabilities = require("blink.cmp").get_lsp_capabilities()

            -- Lua-specific settings
            vim.lsp.config("lua_ls", {
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

            -- Python-specific settings
            vim.lsp.config("pyright", {
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

            -- Ruff LSP for Python linting and code actions
            vim.lsp.config("ruff", {
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

            -- Go-specific settings
            vim.lsp.config("gopls", {
                capabilities = capabilities,
                settings = {
                    gopls = {
                        analyses = {
                            unusedparams = true,
                            unusedvariable = true,
                            shadow = true,
                            nilness = true,
                        },
                        staticcheck = true,
                        gofumpt = true,
                        usePlaceholders = true,
                        completeUnimported = true,
                        -- Restrict workspace symbol search (<leader>fS) to this module's
                        -- own packages, excluding dependencies and the stdlib
                        symbolScope = "workspace",
                    },
                },
            })

            -- Harper: grammar + spell in comments and markdown
            vim.lsp.config("harper_ls", {
                capabilities = capabilities,
                settings = {
                    ["harper-ls"] = {
                        linters = {
                            spell_check = true,
                            repeated_words = true,
                            sentence_capitalization = false, -- too noisy in code comments
                            unclosed_quotes = true,
                        },
                    },
                },
            })

            -- Typos: low-false-positive typo detection in identifiers, strings, and comments
            vim.lsp.config("typos_lsp", {
                capabilities = capabilities,
                init_options = {
                    diagnosticSeverity = "Hint",
                    -- Global user-level config; project _typos.toml is merged on top
                    config = vim.fn.expand("~/.config/typos/_typos.toml"),
                },
            })

            -- Java-specific settings
            local jdtls_path = require("mason-registry").get_package("jdtls"):get_install_path()
            local jdtls_launcher = vim.fn.glob(jdtls_path .. "/plugins/org.eclipse.equinox.launcher_*.jar")
            local jdtls_config = vim.fn.glob(jdtls_path .. "/config_mac")

            vim.lsp.config("jdtls", {
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
                root_markers = { ".git", "mvnw", "gradlew", "pom.xml", "build.gradle" },
            })

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
                    "harper_ls", -- Grammar + spell in comments and markdown
                    "typos_lsp", -- Typo detection in identifiers, strings, and comments
                },
                -- Enables every installed server via vim.lsp.enable(), picking up
                -- the vim.lsp.config() overrides registered above.
                automatic_enable = true,
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

            -- Set blink.cmp capabilities globally so native-API servers
            -- (e.g. ballerina) inherit them without extra per-server config.
            vim.lsp.config("*", {
                capabilities = require("blink.cmp").get_lsp_capabilities(),
            })

            -- Build a quickfix list from diagnostics, excluding spell/grammar sources,
            -- then open the window and jump to the first entry.
            local function is_spell_diag(d)
                local s = (d.source or ""):lower()
                return s:find("harper") ~= nil or s:find("typos") ~= nil
            end

            local function open_diag_qf(bufnr)
                local diags = vim.tbl_filter(function(d)
                    return not is_spell_diag(d)
                end, vim.diagnostic.get(bufnr))
                local items = vim.diagnostic.toqflist(diags)
                vim.fn.setqflist({}, "r", {
                    title = bufnr and "Buffer Diagnostics" or "Workspace Diagnostics",
                    items = items,
                })
                vim.cmd("copen")
                if #items > 0 then
                    vim.cmd("cfirst")
                end
            end

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
                    vim.keymap.set("n", "<leader>lq",
                        function() open_diag_qf(0) end,
                        vim.tbl_extend("force", opts, { desc = "Buffer diagnostics to quickfix" }))
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

            vim.keymap.set("n", "<leader>lW",
                function() open_diag_qf(nil) end,
                { noremap = true, silent = true, desc = "Workspace diagnostics to quickfix" })

            -- Spell/grammar navigation: jump between harper-ls and typos-lsp diagnostics only
            local function goto_spell(forward)
                local bufnr = vim.api.nvim_get_current_buf()
                local all = vim.diagnostic.get(bufnr)
                local spell = vim.tbl_filter(function(d)
                    local s = (d.source or ""):lower()
                    return s:find("harper") ~= nil or s:find("typos") ~= nil
                end, all)
                if #spell == 0 then
                    vim.notify("No spell issues in buffer", vim.log.levels.INFO)
                    return
                end
                table.sort(spell, function(a, b)
                    if a.lnum ~= b.lnum then return a.lnum < b.lnum end
                    return a.col < b.col
                end)
                local cursor = vim.api.nvim_win_get_cursor(0)
                local row, col = cursor[1] - 1, cursor[2]
                local target
                if forward then
                    for _, d in ipairs(spell) do
                        if d.lnum > row or (d.lnum == row and d.col > col) then
                            target = d
                            break
                        end
                    end
                    target = target or spell[1]
                else
                    for i = #spell, 1, -1 do
                        local d = spell[i]
                        if d.lnum < row or (d.lnum == row and d.col < col) then
                            target = d
                            break
                        end
                    end
                    target = target or spell[#spell]
                end
                vim.api.nvim_win_set_cursor(0, { target.lnum + 1, target.col })
                vim.diagnostic.open_float()
            end

            vim.keymap.set("n", "<leader>zn", function() goto_spell(true) end,
                { desc = "Next spell/typo issue", silent = true })
            vim.keymap.set("n", "<leader>zp", function() goto_spell(false) end,
                { desc = "Previous spell/typo issue", silent = true })
            vim.keymap.set("n", "<leader>zf", vim.lsp.buf.code_action,
                { desc = "Fix spell/typo", silent = true })

            -- Filter code actions by title patterns and auto-apply when unambiguous.
            -- harper-ls: "Add "word" to the user/workspace/file dictionary."
            -- typos-lsp: "Ignore `word` in the project / in the configuration file"
            local function spell_action(patterns)
                return function()
                    vim.lsp.buf.code_action({
                        filter = function(action)
                            local t = action.title:lower()
                            for _, p in ipairs(patterns) do
                                if t:find(p, 1, true) then return true end
                            end
                            return false
                        end,
                        apply = true,
                    })
                end
            end

            -- User/global: harper "user dictionary" + typos "configuration file"
            vim.keymap.set("n", "<leader>zu",
                spell_action({ "user dictionary", "configuration file" }),
                { desc = "Add to user dictionary", silent = true })
            -- Workspace/project: harper "workspace dictionary" + typos "in the project"
            vim.keymap.set("n", "<leader>zw",
                spell_action({ "workspace dictionary", "in the project" }),
                { desc = "Add to workspace dictionary", silent = true })
            -- Ignore lint: harper "Ignore Harper error." → persisted to ignored_lints file
            vim.keymap.set("n", "<leader>zi",
                spell_action({ "ignore harper error" }),
                { desc = "Ignore this Harper lint", silent = true })
        end,
    },
}
