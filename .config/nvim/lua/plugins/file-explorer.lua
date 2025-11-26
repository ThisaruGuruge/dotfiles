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
        keys = {
            { "<leader>e", "<cmd>Neotree toggle<cr>", desc = "Toggle file explorer" },
            {
                "<leader>o",
                function()
                    if vim.bo.filetype == "neo-tree" then
                        vim.cmd("wincmd p")
                    else
                        vim.cmd("Neotree focus")
                    end
                end,
                desc = "Toggle focus: file explorer <-> editor",
            },
        },
        config = function()
            require("neo-tree").setup({
                close_if_last_window = true,
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
        end,
    },
}
