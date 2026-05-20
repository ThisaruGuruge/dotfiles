return {
  {
    "echasnovski/mini.ai",
    version = "*",
    event = "VeryLazy",
    dependencies = { "nvim-treesitter/nvim-treesitter-textobjects" },
    config = function()
      local ai = require("mini.ai")
      ai.setup({
        n_lines = 500,
        custom_textobjects = {
          -- f = function definition (replaces default function call)
          f = ai.gen_spec.treesitter({ a = "@function.outer", i = "@function.inner" }),
          -- c = class
          c = ai.gen_spec.treesitter({ a = "@class.outer", i = "@class.inner" }),
          -- o = any code block: if/else, loop, block
          o = ai.gen_spec.treesitter({
            a = { "@block.outer", "@conditional.outer", "@loop.outer" },
            i = { "@block.inner", "@conditional.inner", "@loop.inner" },
          }),
          -- u = function call, e.g. foo(args)  [was the default 'f']
          u = ai.gen_spec.function_call(),
          -- t = HTML/XML tag
          t = { "<([%p%w]-)%f[^<%w][^<>]->.-</%1>", "^<.->().*()</[^/]->$" },
          -- d = digit run, e.g. 42 or 3.14
          d = { "%f[%d]%d+" },
        },
      })
    end,
  },
}
