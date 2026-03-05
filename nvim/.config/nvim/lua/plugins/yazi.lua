return {
    {
        "mikavilpas/yazi.nvim",
        event = "VeryLazy",
        keys = {
            { "<leader>-", mode = { "n", "v" }, "<cmd>Yazi<cr>", desc = "Open yazi at current file" },
            { "<leader>cw", "<cmd>Yazi cwd<cr>", desc = "Open yazi in working directory" },
            { "<c-up>", "<cmd>Yazi toggle<cr>", desc = "Resume last yazi session" },
        },
        opts = {
            open_for_directories = true,
            floating_window_scaling_factor = 0.9,
            yazi_floating_window_border = "rounded",
        },
        init = function()
            -- Disable netrw since yazi handles directories
            vim.g.loaded_netrwPlugin = 1
        end,
    },
}
