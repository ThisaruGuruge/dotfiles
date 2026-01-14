#!/bin/bash

# message-generator.sh
# Generates Conventional Commit formatted messages

generate_message() {
    local type="$1"
    local scope="$2"
    local original="$3"

    # Extract first line as subject
    local subject
    subject=$(echo "$original" | head -1 | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')

    # Remove trailing periods
    subject=$(echo "$subject" | sed -E 's/\.+$//')

    # Handle PR references at end (preserve them)
    local pr_ref=""
    if [[ "$subject" =~ \(#[0-9]+\)$ ]]; then
        pr_ref=" ${BASH_REMATCH[0]}"
        subject=$(echo "$subject" | sed -E 's/ *\(#[0-9]+\)$//')
    fi

    # Ensure lowercase first letter (unless proper noun or acronym)
    # Keep uppercase for: GitHub, WezTerm, NeoVim, Neovim, Vim, Starship, CHANGELOG, README,
    # LICENSE, Ballerina, SDKMAN, macOS, Homebrew, Zsh, iTerm, CI, OSS, GPL, MIT, SSH, GPG
    if [[ ! "$subject" =~ ^(GitHub|WezTerm|NeoVim|Neovim|Vim|Starship|CHANGELOG|README|LICENSE|Ballerina|SDKMAN|VS\ Code|macOS|Homebrew|Zsh|iTerm|CI|OSS|GPL|MIT|SSH|GPG|API|URL|HTTP|HTTPS|JSON|YAML|XML|SQL|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT) ]]; then
        # Use tr to lowercase first character (portable)
        local first_char
        first_char=$(echo "${subject:0:1}" | tr '[:upper:]' '[:lower:]')
        local rest="${subject:1}"
        subject="${first_char}${rest}"
    fi

    # Fix common grammar issues
    subject=$(echo "$subject" | sed -E 's/that causing/that are causing/g')
    subject=$(echo "$subject" | sed -E 's/  +/ /g')  # Remove double spaces

    # Truncate if too long (keep under 72 characters for subject line)
    if [[ ${#subject} -gt 69 ]]; then
        subject="${subject:0:66}..."
    fi

    # Build conventional message
    if [[ -n "$scope" ]]; then
        echo "${type}(${scope}): ${subject}${pr_ref}"
    else
        echo "${type}: ${subject}${pr_ref}"
    fi
}
