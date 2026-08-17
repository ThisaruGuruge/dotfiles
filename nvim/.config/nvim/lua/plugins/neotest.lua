-- Test runner UI: run a test from the buffer, see pass/fail signs in the
-- gutter, and browse results in a summary tree.
--
-- This overlaps with <leader>dt (debug the test under the cursor) on purpose —
-- they answer different questions. <leader>Tr runs a test and tells you whether
-- it passes; <leader>dt stops inside it so you can see why it doesn't.
-- <leader>Td bridges the two: neotest-golang's default `dap_mode = "dap-go"`
-- hands debugging to the same nvim-dap-go adapter plugins/dap-go.lua sets up,
-- so there is one delve configuration, not two.
local function key(lhs, act, desc)
  return {
    lhs,
    function()
      act(require("neotest"))
    end,
    desc = desc,
  }
end

return {
  {
    "nvim-neotest/neotest",
    dependencies = {
      "nvim-neotest/nvim-nio",
      "nvim-lua/plenary.nvim",
      "antoinemadec/FixCursorHold.nvim",
      "nvim-treesitter/nvim-treesitter",
      { "fredrikaverpil/neotest-golang", version = "*" },
    },
    keys = {
      key("<leader>Tr", function(nt)
        nt.run.run()
      end, "Run nearest test"),
      key("<leader>Tf", function(nt)
        nt.run.run(vim.fn.expand("%"))
      end, "Run tests in file"),
      key("<leader>TA", function(nt)
        nt.run.run(vim.uv.cwd())
      end, "Run all tests"),
      key("<leader>Td", function(nt)
        nt.run.run({ strategy = "dap" })
      end, "Debug nearest test"),
      key("<leader>TS", function(nt)
        nt.run.stop()
      end, "Stop nearest test"),
      key("<leader>Ts", function(nt)
        nt.summary.toggle()
      end, "Toggle test summary"),
      key("<leader>To", function(nt)
        nt.output.open({ enter = true, auto_close = true })
      end, "Show test output"),
      key("<leader>TO", function(nt)
        nt.output_panel.toggle()
      end, "Toggle output panel"),
      key("<leader>Tw", function(nt)
        nt.watch.toggle(vim.fn.expand("%"))
      end, "Toggle watch for file"),
    },
    config = function()
      require("neotest").setup({
        adapters = {
          require("neotest-golang")({
            -- -count=1 defeats Go's test result cache: a "pass" from a run
            -- before your last edit is worse than no answer at all.
            go_test_args = { "-v", "-race", "-count=1" },
          }),
        },
      })
    end,
  },
}
