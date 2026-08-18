-- Go code generation: if-err guards, struct tags, interface stubs, tests, doc
-- comments. This is only the editing half of Go support — debugging lives in
-- plugins/dap-go.lua, and everything gopls provides (diagnostics, formatting,
-- code actions, inlay hints, codelenses) in plugins/lsp.lua.
--
-- gopher.nvim shells out to five Go binaries. Its own :GoInstallDeps runs
-- `go install` into ~/go/bin, which a fresh clone would have to remember to
-- run; installing them through Mason instead matches how delve is handled and
-- keeps the toolchain nvim-internal. Mason prepends its bin directory to
-- Neovim's PATH, so gopher finds them without any path configuration.
local tools = { "gomodifytags", "impl", "gotests", "iferr", "json-to-struct" }

local function ensure_tools()
  local ok, registry = pcall(require, "mason-registry")
  if not ok then
    return
  end
  registry.refresh(function()
    for _, name in ipairs(tools) do
      local found, pkg = pcall(registry.get_package, name)
      if found and not pkg:is_installed() then
        pkg:install()
      end
    end
  end)
end

local function cmd(lhs, command, desc)
  return { lhs, "<cmd>" .. command .. "<cr>", desc = desc, ft = "go" }
end

return {
  {
    "olexsmir/gopher.nvim",
    ft = "go",
    -- It queries with the built-in vim.treesitter API rather than plenary or
    -- the nvim-treesitter Lua modules, but it still needs the `go` parser that
    -- nvim-treesitter installs.
    dependencies = { "nvim-treesitter/nvim-treesitter" },
    keys = {
      cmd("<leader>Ge", "GoIfErr", "if err != nil guard"),
      -- Struct tags: lowercase adds, uppercase removes, letter names the
      -- format. gomodifytags appends, so <leader>Gj then <leader>Gy leaves a
      -- field carrying both tags.
      cmd("<leader>Gj", "GoTagAdd json", "Add json struct tags"),
      cmd("<leader>GJ", "GoTagRm json", "Remove json struct tags"),
      cmd("<leader>Gy", "GoTagAdd yaml", "Add yaml struct tags"),
      cmd("<leader>GY", "GoTagRm yaml", "Remove yaml struct tags"),
      cmd("<leader>Gt", "GoTagAdd toml", "Add toml struct tags"),
      cmd("<leader>GT", "GoTagRm toml", "Remove toml struct tags"),
      cmd("<leader>Gi", "GoImpl", "Implement interface"),
      cmd("<leader>Gc", "GoCmt", "Doc comment"),
      cmd("<leader>Ga", "GoTestAdd", "Generate test for function"),
      cmd("<leader>GA", "GoTestsAll", "Generate tests for file"),
      cmd("<leader>Gs", "GoJson", "JSON to struct"),
      cmd("<leader>Gm", "GoMod tidy", "go mod tidy"),
    },
    config = function()
      require("gopher").setup({})
      ensure_tools()
    end,
  },
}
