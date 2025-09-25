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

if [ -d "/Users/thisaru/Downloads/apache-jmeter-5.6.3" ]; then
    export JMETER=/Users/thisaru/Downloads/apache-jmeter-5.6.3
    export PATH=$JMETER/bin:$PATH
fi

# PATH deduplication function to remove duplicate entries
path_dedupe() {
    if [ -n "$PATH" ]; then
        old_PATH=$PATH:; PATH=
        while [ -n "$old_PATH" ]; do
            x=${old_PATH%%:*}
            case $PATH: in
                *:"$x":*) ;;
                *) PATH=$PATH:$x;;
            esac
            old_PATH=${old_PATH#*:}
        done
        PATH=${PATH#:}
        unset old_PATH x
    fi
}

# Apply deduplication
path_dedupe
