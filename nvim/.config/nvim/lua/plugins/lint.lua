local PROJECT_CONFIG_NAMES = {
  ".markdownlint-cli2.jsonc",
  ".markdownlint-cli2.yaml",
  ".markdownlint-cli2.cjs",
  ".markdownlint.json",
  ".markdownlint.jsonc",
  ".markdownlint.yaml",
  ".markdownlint.yml",
}

local function markdownlint_config()
  local project_config = vim.fs.find(PROJECT_CONFIG_NAMES, {
    upward = true,
    path = vim.fn.expand("%:p:h"),
  })[1]
  return project_config or (vim.fn.stdpath("config") .. "/markdownlint.yaml")
end

return {
  {
    "mfussenegger/nvim-lint",
    event = { "BufReadPost", "BufWritePost", "InsertLeave" },
    keys = {
      {
        "<leader>ll",
        function()
          require("lint").try_lint()
        end,
        desc = "Lint Buffer",
      },
    },
    config = function()
      local lint = require("lint")

      lint.linters_by_ft = {
        markdown = { "markdownlint-cli2" },
      }

      lint.linters["markdownlint-cli2"].args = { "--config", markdownlint_config, "-" }

      vim.api.nvim_create_autocmd({ "FileType", "BufWritePost", "InsertLeave" }, {
        group = vim.api.nvim_create_augroup("nvim-lint", { clear = true }),
        callback = function()
          lint.try_lint()
        end,
      })

      vim.schedule(function()
        lint.try_lint()
      end)
    end,
  },
}
