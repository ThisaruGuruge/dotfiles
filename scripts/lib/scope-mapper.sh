#!/bin/bash

# scope-mapper.sh
# Maps file paths to Conventional Commit scopes based on CONTRIBUTING.md

determine_scope() {
    local files="$1"

    # Count matches per scope to handle multi-scope commits
    local ci_count=$(echo "$files" | grep -c '\.github/workflows/' || true)
    local docs_count=$(echo "$files" | grep -cE '^(CHANGELOG\.md|CONTRIBUTING\.md|README\.md|docs/|\.github/(CODE_OF_CONDUCT|ISSUE_TEMPLATE|PULL_REQUEST|SUPPORT))' || true)
    local init_count=$(echo "$files" | grep -c '^init\.sh' || true)
    local zsh_count=$(echo "$files" | grep -c '^zsh/' || true)
    local git_count=$(echo "$files" | grep -cE '^(git/|config/\.config/lazygit)' || true)
    local vim_count=$(echo "$files" | grep -cE '^(vim/|config/\.config/nvim)' || true)
    local tmux_count=$(echo "$files" | grep -c '^tmux/' || true)
    local prompt_count=$(echo "$files" | grep -c 'starship' || true)
    local packages_count=$(echo "$files" | grep -cE '^(Brewfile|packages\.json|packages/)' || true)
    local security_count=$(echo "$files" | grep -cE '\.(env|age)|SECURITY\.md|edit_secrets|sops' || true)
    local wezterm_count=$(echo "$files" | grep -c 'wezterm' || true)
    local bin_count=$(echo "$files" | grep -c '^bin/' || true)

    # Find dominant scope (highest count)
    local max=0
    local scope=""

    [[ $ci_count -gt $max ]] && { max=$ci_count; scope="ci"; }
    [[ $docs_count -gt $max ]] && { max=$docs_count; scope="docs"; }
    [[ $init_count -gt $max ]] && { max=$init_count; scope="init"; }
    [[ $zsh_count -gt $max ]] && { max=$zsh_count; scope="zsh"; }
    [[ $git_count -gt $max ]] && { max=$git_count; scope="git"; }
    [[ $vim_count -gt $max ]] && { max=$vim_count; scope="vim"; }
    [[ $tmux_count -gt $max ]] && { max=$tmux_count; scope="tmux"; }
    [[ $prompt_count -gt $max ]] && { max=$prompt_count; scope="prompt"; }
    [[ $packages_count -gt $max ]] && { max=$packages_count; scope="packages"; }
    [[ $security_count -gt $max ]] && { max=$security_count; scope="security"; }

    # WezTerm is not in CONTRIBUTING.md but is in the repo
    # Only use if it's the clear winner
    if [[ $wezterm_count -gt $max ]] && [[ $wezterm_count -gt 2 ]]; then
        max=$wezterm_count
        scope="wezterm"
    fi

    # If bin/ files without other scope
    if [[ $bin_count -gt $max ]]; then
        max=$bin_count
        scope="init"  # bin/ scripts are part of init tooling
    fi

    # If multi-scope (2+ categories have significant counts), omit scope
    local significant_scopes=0
    [[ $ci_count -ge 2 ]] && ((significant_scopes++))
    [[ $docs_count -ge 2 ]] && ((significant_scopes++))
    [[ $init_count -ge 1 ]] && ((significant_scopes++))
    [[ $zsh_count -ge 2 ]] && ((significant_scopes++))
    [[ $git_count -ge 2 ]] && ((significant_scopes++))
    [[ $vim_count -ge 2 ]] && ((significant_scopes++))
    [[ $tmux_count -ge 2 ]] && ((significant_scopes++))
    [[ $prompt_count -ge 1 ]] && ((significant_scopes++))
    [[ $packages_count -ge 2 ]] && ((significant_scopes++))
    [[ $security_count -ge 1 ]] && ((significant_scopes++))

    if [[ $significant_scopes -gt 1 ]]; then
        echo ""  # Multi-scope, omit scope
    else
        echo "$scope"
    fi
}
