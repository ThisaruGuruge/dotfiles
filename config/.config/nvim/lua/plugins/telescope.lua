return {
    {
        "nvim-telescope/telescope.nvim",
        branch = "0.1.x",
        dependencies = { "nvim-lua/plenary.nvim" },
        cmd = "Telescope",
        config = function()
            require("telescope").setup({
                defaults = {
                    mappings = {
                        i = {
                            ["<C-u>"] = false,
                            ["<C-d>"] = false,
                        },
                    },
                    file_ignore_patterns = { "node_modules", ".git/", "%.lock" },
                    layout_config = {
                        horizontal = {
                            preview_width = 0.55,
                        },
                    },
                },
            })
        end,
    },
}
