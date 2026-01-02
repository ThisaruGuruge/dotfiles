return {
    -- Neo-tree: Modern file explorer
    {
        "nvim-neo-tree/neo-tree.nvim",
        branch = "v3.x",
        dependencies = {
            "nvim-lua/plenary.nvim",
            "nvim-tree/nvim-web-devicons",
            "MunifTanjim/nui.nvim",
        },
        -- Keybindings moved to which-key config for better integration
        lazy = false, -- Load immediately, not lazily
        priority = 1000, -- Load before other plugins
        config = function()
            require("neo-tree").setup({
                close_if_last_window = false, -- Keep neo-tree open
                popup_border_style = "rounded",
                enable_git_status = true,
                enable_diagnostics = true,
                default_component_configs = {
                    indent = {
                        padding = 0,
                        with_markers = true,
                    },
                    icon = {
                        folder_closed = "",
                        folder_open = "",
                        folder_empty = "",
                    },
                    git_status = {
                        symbols = {
                            added = "✚",
                            modified = "",
                            deleted = "✖",
                            renamed = "➜",
                            untracked = "★",
                            ignored = "◌",
                            unstaged = "✗",
                            staged = "✓",
                            conflict = "",
                        },
                    },
                },
                window = {
                    position = "left",
                    width = 30,
                    mappings = {
                        ["<space>"] = "none",
                        ["n"] = "add",
                        ["N"] = "add_directory",
                        ["q"] = "none", -- Disable q mapping to allow macro recording
                    },
                },
                filesystem = {
                    follow_current_file = {
                        enabled = true,
                    },
                    use_libuv_file_watcher = true,
                    filtered_items = {
                        hide_dotfiles = false,
                        hide_gitignored = false,
                    },
                },
            })

            -- Auto-open Neo-tree when starting Neovim
            vim.api.nvim_create_autocmd("VimEnter", {
                callback = function()
                    -- Only open if no files were specified on command line
                    if vim.fn.argc() == 0 then
                        vim.cmd("Neotree show")
                        -- Focus back to the main window
                        vim.cmd("wincmd l")
                    else
                        -- Files were opened, show neo-tree but keep focus on file
                        vim.cmd("Neotree show")
                        vim.cmd("wincmd l")
                    end
                end,
            })
        end,
    },
}
