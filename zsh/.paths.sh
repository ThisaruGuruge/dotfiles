#!/bin/bash

# Docker platform (keep for compatibility)
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Add JAVA_HOME to PATH if set (managed by SDKMAN)
[ -n "$JAVA_HOME" ] && export PATH=$JAVA_HOME/bin:$PATH

# Legacy tool paths - only add to PATH if directories exist
# Note: Consider using SDKMAN for Java ecosystem tools instead
if [ -d "/usr/local/apache-maven-3.5.3" ]; then
    export MAVEN_HOME=/usr/local/apache-maven-3.5.3
    export PATH=$MAVEN_HOME/bin:$PATH
fi

if [ -d "/usr/local/apache-tomcat-9.0.8" ]; then
    export TOMCAT_HOME=/usr/local/apache-tomcat-9.0.8
    export PATH=$TOMCAT_HOME/bin:$PATH
fi

if [ -d "/usr/local/opt/mysql@5.7" ]; then
    export MYSQL_HOME=/usr/local/opt/mysql@5.7
    export PATH=$MYSQL_HOME/bin:$PATH
fi

if [ -d "/usr/local/apache-ant-1.10.3" ]; then
    export ANT_HOME=/usr/local/apache-ant-1.10.3
    export PATH=$ANT_HOME/bin:$PATH
fi

# JMeter - check common installation locations (cached)
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
    echo "$jmeter_path" > "$jmeter_cache_file"
    if [ -n "$jmeter_path" ]; then
        export JMETER="$jmeter_path"
        export PATH="$JMETER/bin:$PATH"
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
