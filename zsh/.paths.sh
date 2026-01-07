#!/bin/bash
#
# PATH and Environment Configuration
# This file safely adds tools to PATH only if they exist on the system
# All paths are checked before being added for portability across machines

# Docker platform (keep for compatibility)
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Add local bin directories if they exist
[ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
[ -d "$HOME/bin" ] && export PATH="$HOME/bin:$PATH"

# Add JAVA_HOME to PATH if set (managed by SDKMAN)
[ -n "$JAVA_HOME" ] && export PATH="$JAVA_HOME/bin:$PATH"

# Ballerina - Always set BALLERINA_HOME (required for IDE extensions)
if [ -d "/Library/Ballerina" ]; then
    export BALLERINA_HOME=/Library/Ballerina
    export PATH=$BALLERINA_HOME/bin:$PATH
else
    # Fallback: Set BALLERINA_HOME even if directory doesn't exist
    # This prevents IDE extensions from breaking
    export BALLERINA_HOME=/Library/Ballerina
    # Only warn in interactive shells, not in IDE contexts
    if [[ -z "$DOTFILES_FAST_ENV" ]] && [[ -o interactive ]]; then
        echo "⚠️  Warning: BALLERINA_HOME set to $BALLERINA_HOME but directory not found" >&2
    fi
fi

# JMeter lookup is expensive; skip when fast environment detection is requested
if [ -z "$DOTFILES_FAST_ENV" ]; then
    jmeter_cache_file="$HOME/.cache/zsh/jmeter_path_cache"
    if [ -f "$jmeter_cache_file" ] && [ "$jmeter_cache_file" -nt "$HOME/.zshrc" ]; then
        # Use cached JMeter path
        if [ -f "$jmeter_cache_file" ]; then
            jmeter_path=$(cat "$jmeter_cache_file" 2>/dev/null)
            if [ -n "$jmeter_path" ] && [ -d "$jmeter_path" ]; then
                export JMETER="$jmeter_path"
                export PATH="$JMETER/bin:$PATH"
            fi
        fi
    else
        # Find and cache JMeter path
        [ ! -d "$HOME/.cache/zsh" ] && mkdir -p "$HOME/.cache/zsh"
        jmeter_path=$(find "$HOME/Downloads" "$HOME/tools" "/opt" "/usr/local" -maxdepth 1 -name "apache-jmeter-*" -type d 2>/dev/null | head -n 1)
        echo "$jmeter_path" >"$jmeter_cache_file"
        if [ -n "$jmeter_path" ]; then
            export JMETER="$jmeter_path"
            export PATH="$JMETER/bin:$PATH"
        fi
    fi
fi

# PATH deduplication function to remove duplicate entries
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

# Apply deduplication
path_dedupe
