# ============================================================================
# Powerlevel10k Configuration — Catppuccin Mocha
# ============================================================================
# Managed by stow: zsh/.p10k.zsh -> ~/.p10k.zsh
# Run `p10k configure` to regenerate interactively, or edit this file directly.
# Documentation: https://github.com/romkatv/powerlevel10k
#
# Design principles:
#   Prompt  → command-level context: WHERE + GIT STATE + LANGUAGE + DURATION
#   Tmux    → session-level context: SESSION + WINDOWS + SYSTEM HEALTH + TIME
#   No duplication between the two layers.

# Temporarily change options (required boilerplate — do not remove).
'builtin' 'local' '-a' 'p10k_config_opts'
[[ ! -o 'aliases'         ]] || p10k_config_opts+=('aliases')
[[ ! -o 'sh_glob'         ]] || p10k_config_opts+=('sh_glob')
[[ ! -o 'no_brace_expand' ]] || p10k_config_opts+=('no_brace_expand')
'builtin' 'setopt' 'no_aliases' 'no_sh_glob' 'brace_expand'

() {
    emulate -L zsh -o extended_glob

    # Unset all POWERLEVEL9K_* options previously set by `p10k configure`.
    unset -m '(POWERLEVEL9K_*|DEFAULT_USER)~POWERLEVEL9K_GITSTATUS_DIR'

    # Zsh >= 5.1 is required.
    [[ $ZSH_VERSION == (5.<1->*|<6->.*) ]] || return

    # ============================================================================
    # Catppuccin Mocha Palette
    # ============================================================================
    # Matches the tmux status bar theme for a unified terminal appearance.
    #
    #   Base      #1e1e2e   Surface0  #313244   Overlay1  #7f849c
    #   Text      #cdd6f4   Blue      #89b4fa   Sky       #89dceb
    #   Teal      #94e2d5   Green     #a6e3a1   Yellow    #f9e2af
    #   Peach     #fab387   Flamingo  #f2cdcd   Red       #f38ba8

    # ============================================================================
    # Prompt Elements
    # ============================================================================

    # Left prompt (top line): dir → git → go → java → python → ballerina
    typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
        dir             # Current directory
        vcs             # Git branch + status (async, never blocks)
        go_version      # Go version   (Go projects only)
        java_version    # Java version (Java projects only)
        pyenv           # Python env   (Python projects only)
        p10k_ballerina  # Ballerina    (Ballerina.toml projects only)
        newline         # ──── line break ────
        prompt_char     # ❯ on line 2
    )

    # Right prompt: only command duration (time lives in tmux status bar)
    typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
        command_execution_time
    )

    # ============================================================================
    # Global Settings
    # ============================================================================

    typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true

    # Powerline separators (require Nerd Font)
    typeset -g POWERLEVEL9K_LEFT_SEGMENT_SEPARATOR='\uE0B0'
    typeset -g POWERLEVEL9K_RIGHT_SEGMENT_SEPARATOR='\uE0B2'
    typeset -g POWERLEVEL9K_LEFT_SUBSEGMENT_SEPARATOR='\uE0B1'
    typeset -g POWERLEVEL9K_RIGHT_SUBSEGMENT_SEPARATOR='\uE0B3'
    typeset -g POWERLEVEL9K_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL='\uE0B0'
    typeset -g POWERLEVEL9K_RIGHT_PROMPT_FIRST_SEGMENT_START_SYMBOL='\uE0B2'

    # Transient prompt: after a command runs, collapse the previous prompt to just
    # "❯" in the scrollback. Only the current prompt shows the full context.
    # This keeps the terminal clean without losing any live information.
    typeset -g POWERLEVEL9K_TRANSIENT_PROMPT=always

    # ============================================================================
    # Directory  (Surface0 bg · Text fg)
    # ============================================================================

    typeset -g POWERLEVEL9K_DIR_BACKGROUND='#313244'
    typeset -g POWERLEVEL9K_DIR_FOREGROUND='#cdd6f4'
    typeset -g POWERLEVEL9K_DIR_SHORTENED_FOREGROUND='#7f849c'
    typeset -g POWERLEVEL9K_DIR_ANCHOR_FOREGROUND='#cdd6f4'
    typeset -g POWERLEVEL9K_DIR_ANCHOR_BOLD=true

    typeset -g POWERLEVEL9K_SHORTEN_STRATEGY=truncate_to_last
    typeset -g POWERLEVEL9K_SHORTEN_DIR_LENGTH=4
    typeset -g POWERLEVEL9K_DIR_MAX_LENGTH=80

    typeset -g POWERLEVEL9K_DIR_SHOW_WRITABLE=v3
    typeset -g POWERLEVEL9K_LOCK_ICON='󰌾'
    typeset -g POWERLEVEL9K_DIR_VISUAL_IDENTIFIER_EXPANSION=

    # ============================================================================
    # VCS / Git  (Green clean · Mauve dirty · Base fg)
    # ============================================================================
    # Uses gitstatus daemon: async C binary, answers queries in <1ms.
    # The prompt never waits for git — it renders immediately and updates when ready.
    #
    #   Clean     → Green  #a6e3a1  (all clear)
    #   Modified  → Mauve  #cba6f7  (uncommitted edits)
    #   Untracked → Mauve  #cba6f7  (new files not yet staged)

    typeset -g POWERLEVEL9K_VCS_BACKENDS=(git)

    typeset -g POWERLEVEL9K_VCS_CLEAN_BACKGROUND='#a6e3a1'
    typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND='#1e1e2e'
    typeset -g POWERLEVEL9K_VCS_MODIFIED_BACKGROUND='#cba6f7'
    typeset -g POWERLEVEL9K_VCS_MODIFIED_FOREGROUND='#1e1e2e'
    typeset -g POWERLEVEL9K_VCS_UNTRACKED_BACKGROUND='#cba6f7'
    typeset -g POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND='#1e1e2e'

    # Loading placeholder while gitstatus computes asynchronously
    typeset -g POWERLEVEL9K_VCS_LOADING_BACKGROUND='#313244'
    typeset -g POWERLEVEL9K_VCS_LOADING_FOREGROUND='#7f849c'

    # Branch icon (Nerd Font git-branch glyph)
    typeset -g POWERLEVEL9K_VCS_BRANCH_ICON='\uF126 '

    # Status indicators
    typeset -g POWERLEVEL9K_VCS_UNTRACKED_ICON='?'
    typeset -g POWERLEVEL9K_VCS_UNSTAGED_ICON='!'
    typeset -g POWERLEVEL9K_VCS_STAGED_ICON='+'
    typeset -g POWERLEVEL9K_VCS_STASH_ICON='*'
    typeset -g POWERLEVEL9K_VCS_INCOMING_CHANGES_ICON='⇣'
    typeset -g POWERLEVEL9K_VCS_OUTGOING_CHANGES_ICON='⇡'
    typeset -g POWERLEVEL9K_VCS_CONFLICTED_ICON='!'
    typeset -g POWERLEVEL9K_VCS_DELETED_ICON='✘'
    typeset -g POWERLEVEL9K_VCS_RENAMED_ICON='»'

    typeset -g POWERLEVEL9K_VCS_SHORTEN_LENGTH=30
    typeset -g POWERLEVEL9K_VCS_SHORTEN_STRATEGY=truncate_from_right
    typeset -g POWERLEVEL9K_VCS_SHORTEN_MIN_LENGTH=11

    # ============================================================================
    # Go Version  (Sky bg · Base fg)
    # ============================================================================

    typeset -g POWERLEVEL9K_GO_VERSION_BACKGROUND='#89dceb'
    typeset -g POWERLEVEL9K_GO_VERSION_FOREGROUND='#1e1e2e'
    typeset -g POWERLEVEL9K_GO_VERSION_VISUAL_IDENTIFIER_EXPANSION=$'\uE627'
    # Only show when the cwd contains Go project files (go.mod, go.work, etc.)
    typeset -g POWERLEVEL9K_GO_VERSION_PROJECT_ONLY=true

    # ============================================================================
    # Java Version  (Peach bg · Base fg)
    # ============================================================================

    typeset -g POWERLEVEL9K_JAVA_VERSION_BACKGROUND='#fab387'
    typeset -g POWERLEVEL9K_JAVA_VERSION_FOREGROUND='#1e1e2e'
    typeset -g POWERLEVEL9K_JAVA_VERSION_VISUAL_IDENTIFIER_EXPANSION='☕'
    typeset -g POWERLEVEL9K_JAVA_VERSION_PROJECT_ONLY=true
    typeset -g POWERLEVEL9K_JAVA_VERSION_FULL=false

    # ============================================================================
    # Python / pyenv  (Yellow bg · Base fg)
    # ============================================================================

    typeset -g POWERLEVEL9K_PYENV_BACKGROUND='#f9e2af'
    typeset -g POWERLEVEL9K_PYENV_FOREGROUND='#1e1e2e'
    typeset -g POWERLEVEL9K_PYENV_VISUAL_IDENTIFIER_EXPANSION='🐍'
    typeset -g POWERLEVEL9K_PYENV_SOURCES=(shell local global)
    typeset -g POWERLEVEL9K_PYENV_PROMPT_ALWAYS_SHOW=false
    typeset -g POWERLEVEL9K_PYENV_SHOW_SYSTEM=false

    # ============================================================================
    # Custom: Ballerina  (Teal bg · Base fg)
    # ============================================================================
    # Shows only when Ballerina.toml is present in $PWD.
    # Uses zsh builtins only — no subprocesses, no cat, no sed.

    function prompt_p10k_ballerina() {
        [[ -f "$PWD/Ballerina.toml" ]] || return

        local bal_version='bal'
        local bal_version_file="$HOME/.ballerina/ballerina-version"

        if [[ -r "$bal_version_file" ]]; then
            local bal_raw
            { IFS= read -r bal_raw } < "$bal_version_file"
            bal_version="${bal_raw#ballerina-}"
            [[ -z "$bal_version" ]] && bal_version='bal'
        fi

        p10k segment -b '#94e2d5' -f '#1e1e2e' -i '🩰' -t "$bal_version"
    }

    function instant_prompt_p10k_ballerina() {
        prompt_p10k_ballerina
    }

    # ============================================================================
    # Command Execution Time  (Flamingo bg · Base fg)
    # ============================================================================
    # Only shown when the previous command took more than 2 seconds.
    # Time-of-day is intentionally omitted here — it's in the tmux status bar.

    typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_BACKGROUND='#f2cdcd'
    typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FOREGROUND='#1e1e2e'
    typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_THRESHOLD=2
    typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_PRECISION=1
    typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FORMAT='duration'
    typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_VISUAL_IDENTIFIER_EXPANSION='󱦟'

    # ============================================================================
    # Prompt Character  (❯ on line 2)
    # ============================================================================

    typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_VIINS_FOREGROUND='#a6e3a1'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_VIINS_FOREGROUND='#f38ba8'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_VICMD_FOREGROUND='#f9e2af'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_VICMD_FOREGROUND='#f38ba8'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_VIINS_CONTENT_EXPANSION='❯'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_VIINS_CONTENT_EXPANSION='❯'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_VICMD_CONTENT_EXPANSION='❮'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_VICMD_CONTENT_EXPANSION='❮'
    typeset -g POWERLEVEL9K_PROMPT_CHAR_OVERWRITE_STATE=false
    typeset -g POWERLEVEL9K_PROMPT_CHAR_LEFT_SEGMENT_SEPARATOR=
    typeset -g POWERLEVEL9K_PROMPT_CHAR_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL=
    typeset -g POWERLEVEL9K_PROMPT_CHAR_VISUAL_IDENTIFIER_EXPANSION=

    # ============================================================================
    # Instant Prompt
    # ============================================================================
    # verbose: warn if something prints to console during zsh init (helps debug).
    # Switch to 'quiet' once everything is stable.
    typeset -g POWERLEVEL9K_INSTANT_PROMPT=verbose

    typeset -g POWERLEVEL9K_DISABLE_HOT_RELOAD=false

}

'builtin' 'setopt' ${p10k_config_opts[@]}
'builtin' 'unset' 'p10k_config_opts'
