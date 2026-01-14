#!/bin/bash

# type-detector.sh
# Determines commit type from message and changes

determine_type() {
    local original_msg="$1"
    local commit_hash="$2"
    local scope="$3"

    local msg_lower=$(echo "$original_msg" | tr '[:upper:]' '[:lower:]')

    # Check if already in conventional format
    if [[ "$original_msg" =~ ^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\(.*\))?:\ .+ ]]; then
        echo "$original_msg" | sed -E 's/^([a-z]+).*/\1/'
        return
    fi

    # Pattern matching based on message content

    # Fix commits
    if [[ $msg_lower =~ ^(fix|fixed|fixes|resolve|resolved|resolves|address|addressed|patch) ]]; then
        echo "fix"
        return
    fi

    # Scope-based type determination (CI and docs are high confidence)
    if [[ $scope == "ci" ]]; then
        echo "ci"
        return
    fi

    if [[ $scope == "docs" ]]; then
        echo "docs"
        return
    fi

    # Style commits (formatting, linting)
    if [[ $msg_lower =~ (style|format|lint|indent|shfmt|shellcheck.*error|prettier|formatting) ]]; then
        echo "style"
        return
    fi

    # Performance commits
    if [[ $msg_lower =~ (performance|perf|speed|optimize|optimiz|lazy.?load|faster) ]]; then
        echo "perf"
        return
    fi

    # Test commits
    if [[ $msg_lower =~ (test|tests|testing|test.?script|spec) ]]; then
        echo "test"
        return
    fi

    # Feature commits (new functionality)
    if [[ $msg_lower =~ ^(add|added|implement|implemented|introduce|introduced|create|created|new) ]] && [[ ! $msg_lower =~ (bump|version|dependency|dependencies) ]]; then
        echo "feat"
        return
    fi

    # Refactor commits
    if [[ $msg_lower =~ (refactor|restructure|reorganize|reorganise|migrate|migration|move|moved|revamp) ]]; then
        echo "refactor"
        return
    fi

    # Chore commits (maintenance)
    if [[ $msg_lower =~ (bump|version|dependency|dependencies|package.*version|upgrade.*version|update.*version) ]]; then
        echo "chore"
        return
    fi

    # Update/improve - context dependent
    if [[ $msg_lower =~ ^(update|updated|improve|improved|enhance|enhanced) ]]; then
        # Check what was updated
        if [[ $msg_lower =~ (doc|readme|changelog|contributing|comment) ]]; then
            echo "docs"
        elif [[ $msg_lower =~ (performance|perf|speed|optimize) ]]; then
            echo "perf"
        elif [[ $msg_lower =~ (test) ]]; then
            echo "test"
        else
            echo "refactor"
        fi
        return
    fi

    # Remove/delete
    if [[ $msg_lower =~ ^(remove|removed|delete|deleted|clean|cleanup) ]]; then
        echo "refactor"
        return
    fi

    # Initial commit
    if [[ $msg_lower =~ ^init ]]; then
        echo "chore"
        return
    fi

    # Default fallback
    echo "chore"
}
