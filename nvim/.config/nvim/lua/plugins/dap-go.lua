-- Go debugging via delve. Tier 2: a dedicated dap extension plugin.
--
-- nvim-dap-go supplies two things worth having: the `dap.adapters.go` adapter
-- (which spawns `dlv dap` on a free port) and the treesitter-based
-- "debug the test under the cursor" helpers. Its *configurations*, though, are
-- a hardcoded table with no hook for pre-filling the argument prompt and no
-- remote-attach entry, so this file keeps the adapter and replaces the list.

-- Remembered between runs so re-debugging a CLI with the same flags is one
-- Enter. nvim-dap calls config functions inside a coroutine and waits for the
-- resume, which is how the prompt can be async.
local last_args = ""

local function prompt_args()
  return coroutine.create(function(dap_run_co)
    vim.ui.input({ prompt = "Program arguments: ", default = last_args }, function(input)
      if input == nil then -- cancelled: run with no arguments
        coroutine.resume(dap_run_co, {})
        return
      end
      last_args = input
      coroutine.resume(dap_run_co, vim.split(input, " +", { trimempty = true }))
    end)
  end)
end

-- Resolving what to launch.
--
-- The obvious `program = "${fileDirname}"` is wrong for anything but a
-- single-package toy: you set a breakpoint in a library file (say
-- internal/engine/operations.go) and delve dutifully builds *that* package.
-- `go build -o` on a non-main package writes a compiled archive rather than a
-- binary, so the launch dies with "not an executable file". What you almost
-- always mean is "run the program that reaches this breakpoint", so resolve
-- the module's main package instead of the current file's directory.
local main_pkgs_cache = {} -- module root -> { dir, ... }
local last_main = {} -- module root -> last chosen dir

local function module_root()
  local dir = vim.fn.expand("%:p:h")
  local gomod = vim.fs.find("go.mod", { upward = true, path = dir })[1]
  return gomod and vim.fs.dirname(gomod) or dir
end

local function main_packages(root)
  if main_pkgs_cache[root] then
    return main_pkgs_cache[root]
  end
  local res = vim
    .system({ "go", "list", "-f", '{{if eq .Name "main"}}{{.Dir}}{{end}}', "./..." }, { cwd = root, text = true })
    :wait(10000)
  local dirs = {}
  for _, line in ipairs(vim.split(res.stdout or "", "\n", { trimempty = true })) do
    table.insert(dirs, line)
  end
  main_pkgs_cache[root] = dirs
  return dirs
end

-- Returns a coroutine because picking between several `cmd/*` binaries needs
-- vim.ui.select, which is async. nvim-dap resumes it with the chosen value.
local function prompt_program()
  return coroutine.create(function(dap_run_co)
    local root = module_root()
    local dirs = main_packages(root)

    if #dirs == 0 then
      -- No main package anywhere (library-only module, or `go list` failed).
      -- Hand delve the module root so it reports something intelligible.
      coroutine.resume(dap_run_co, root)
      return
    end
    if #dirs == 1 then
      coroutine.resume(dap_run_co, dirs[1])
      return
    end

    -- Several binaries: offer them with the previous pick first.
    local choices = vim.deepcopy(dirs)
    local previous = last_main[root]
    if previous then
      table.sort(choices, function(a, _)
        return a == previous
      end)
    end
    vim.ui.select(choices, {
      prompt = "Main package to debug:",
      format_item = function(dir)
        return dir == root and "." or dir:sub(#root + 2)
      end,
    }, function(choice)
      choice = choice or previous or dirs[1]
      last_main[root] = choice
      coroutine.resume(dap_run_co, choice)
    end)
  end)
end

-- Prefer the delve Mason installs (plugins/dap.lua ensures it), but fall back
-- to any `dlv` on PATH so a Homebrew or `go install` copy keeps working.
local function delve_path()
  local mason_dlv = vim.fn.stdpath("data") .. "/mason/bin/dlv"
  if vim.uv.fs_stat(mason_dlv) then
    return mason_dlv
  end
  return "dlv"
end

-- Remote attach: connect to a `dlv --headless` server the user started in a
-- terminal, rather than spawning `dlv dap` here. Needed whenever the debuggee
-- has to run somewhere nvim can't launch it — in a container, on another
-- machine, or simply on a real TTY so it can read stdin.
local last_remote = "127.0.0.1:38697"

local function prompt_remote()
  return coroutine.create(function(dap_run_co)
    vim.ui.input({ prompt = "Remote delve address (host:port): ", default = last_remote }, function(input)
      if input and input ~= "" then
        last_remote = input
      end
      coroutine.resume(dap_run_co, last_remote)
    end)
  end)
end

local remote_config = {
  type = "go_remote",
  name = "Attach remote (dlv --headless)",
  request = "attach",
  mode = "remote",
  address = prompt_remote,
}

return {
  {
    "leoluz/nvim-dap-go",
    dependencies = { "mfussenegger/nvim-dap" },
    ft = "go",
    keys = {
      {
        "<leader>dt",
        function()
          require("dap-go").debug_test()
        end,
        desc = "Debug nearest test",
        ft = "go",
      },
      {
        "<leader>dT",
        function()
          require("dap-go").debug_last_test()
        end,
        desc = "Debug last test",
        ft = "go",
      },
      {
        "<leader>da",
        function()
          require("dap").run(remote_config)
        end,
        desc = "Attach remote delve",
        ft = "go",
      },
    },
    config = function()
      require("dap-go").setup({
        delve = { path = delve_path() },
      })

      -- Unlike `dap.adapters.go` (which nvim-dap-go points at a locally
      -- spawned `dlv dap`), this one just dials an address where delve is
      -- already listening. `dlv dap` explicitly refuses multiple clients and
      -- tells you to use `dlv <command> --headless` with an attach+remote
      -- config, which is exactly what this pairs with:
      --
      --   dlv debug --headless --listen=127.0.0.1:38697 \
      --       --accept-multiclient -- <program args>
      require("dap").adapters.go_remote = function(callback, config)
        local host, port = tostring(config.address or ""):match("^(.-):(%d+)$")
        callback({
          type = "server",
          host = host ~= "" and host or "127.0.0.1",
          port = tonumber(port) or 38697,
        })
      end

      -- Replace, don't append: setup() has already pushed its own seven
      -- configurations onto dap.configurations.go, and leaving them there
      -- would mean picking from twelve near-identical entries every launch.
      --
      -- `outputMode = "remote"` is delve's own attribute for routing the
      -- debuggee's stdout/stderr back over DAP, so program output shows up in
      -- the DAP console pane. Note there is deliberately no `console` field:
      -- "integratedTerminal" is a VS Code Go *extension* attribute, not a
      -- delve one — `dlv dap` parses the launch request, ignores it, and
      -- launches the process itself without ever sending a runInTerminal
      -- request. Setting it looks like it enables stdin but does nothing.
      -- Debugging a program that reads stdin is what the "Attach remote"
      -- entry below is for: delve runs in a real terminal, nvim just drives it.
      require("dap").configurations.go = {
        {
          type = "go",
          name = "Debug program",
          request = "launch",
          program = prompt_program,
          cwd = "${workspaceFolder}",
          outputMode = "remote",
        },
        {
          type = "go",
          name = "Debug program (arguments)",
          request = "launch",
          program = prompt_program,
          args = prompt_args,
          cwd = "${workspaceFolder}",
          outputMode = "remote",
        },
        {
          type = "go",
          name = "Debug current file",
          request = "launch",
          program = "${file}",
          cwd = "${workspaceFolder}",
          outputMode = "remote",
        },
        {
          type = "go",
          name = "Debug test (current file)",
          request = "launch",
          mode = "test",
          program = "${file}",
          outputMode = "remote",
        },
        {
          type = "go",
          name = "Debug test (package)",
          request = "launch",
          mode = "test",
          program = "./${relativeFileDirname}",
          outputMode = "remote",
        },
        remote_config,
      }
    end,
  },
}
