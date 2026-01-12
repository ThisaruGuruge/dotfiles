#!/bin/bash
#
# PATH and Environment Configuration
# This file safely adds tools to PATH only if they exist on the system

export DOCKER_DEFAULT_PLATFORM=linux/amd64

[ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
[ -d "$HOME/bin" ] && export PATH="$HOME/bin:$PATH"

[ -n "$JAVA_HOME" ] && export PATH="$JAVA_HOME/bin:$PATH"

# Ballerina - Always set BALLERINA_HOME (required for IDE extensions)
if [ -d "/Library/Ballerina" ]; then
    export BALLERINA_HOME=/Library/Ballerina
    export PATH=$BALLERINA_HOME/bin:$PATH
else
    # Set BALLERINA_HOME even if directory doesn't exist to prevent IDE extensions from breaking
    export BALLERINA_HOME=/Library/Ballerina
    # Only warn in interactive shells, not in IDE contexts
    if [[ -z "$DOTFILES_FAST_ENV" ]] && [[ -o interactive ]]; then
        echo "⚠️  Warning: BALLERINA_HOME set to $BALLERINA_HOME but directory not found" >&2
    fi
fi

path_dedupe() {
    if [ -n "$PATH" ]; then
        local old_path="$PATH:"
        local new_path=""
        while [ -n "$old_path" ]; do
            local x="${old_path%%:*}"
            case ":$new_path:" in
                *:"$x":*) ;;
                *) new_path="$new_path:$x" ;;
            esac
            old_path="${old_path#*:}"
        done
        PATH="${new_path#:}"
    fi
}

path_dedupe
