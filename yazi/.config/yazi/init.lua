-- Yazi init.lua — plugin setup

-- Full border around the UI
require("full-border"):setup()

-- Git status indicators in the file list
require("git"):setup()

-- Faster MIME detection via file extension (skip `file` command)
require("mime-ext.local"):setup({
    -- Fallback to the default `file` command if extension is unknown
    fallback_file1 = true,
})
