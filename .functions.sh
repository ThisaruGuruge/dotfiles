compress () {
    tar -czvf "$1.tar.gz" $1
}

extract () {
    if [ -f $1 ] ; then
        case $1 in
            *.tar.bz2)   tar xjf $1     ;;
            *.tar.gz)    tar xzf $1     ;;
            *.bz2)       bunzip2 $1     ;;
            *.rar)       unrar e $1     ;;
            *.gz)        gunzip $1      ;;
            *.tar)       tar xf $1      ;;
            *.tbz2)      tar xjf $1     ;;
            *.tgz)       tar xzf $1     ;;
            *.zip)       unzip $1       ;;
            *.Z)         uncompress $1  ;;
            *.7z)        7z x $1        ;;
            *)     echo "'$1' cannot be extracted via extract()" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

checkPort() {
    lsof -i:$1
}

kill_by_port() {
    local dry_run=false
    local port_arg=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                echo "Usage: kill_by_port [OPTIONS] PORT"
                echo "Kill processes running on the specified port"
                echo ""
                echo "Options:"
                echo "  -d, --dry-run    List processes without killing them"
                echo "  -h, --help       Show this help message"
                echo ""
                echo "Examples:"
                echo "  kill_by_port 3000        # Kill processes on port 3000"
                echo "  kill_by_port -d 3000     # List processes on port 3000 (dry run)"
                return 0
                ;;
            -*)
                echo "Unknown option: $1"
                echo "Use -h or --help for usage information"
                return 1
                ;;
            *)
                port_arg="$1"
                shift
                ;;
        esac
    done
    
    # Check if port argument was provided
    if [ -z "$port_arg" ]; then
        echo "Error: Port number is required"
        echo "Use -h or --help for usage information"
        return 1
    fi
    
    re='^[0-9]{4}$'
    if ! [ $port_arg -lt 65534 ] && [ $port_arg -gt 1000 ]
    then
        echo "Invalid input: $port_arg. Enter a valid port number. (Numbers less than 1000 are considered invalid)"
    else
        apps="$(lsof -i:$port_arg)"
        if [ -z "$apps" ]
        then
            echo "No apps using the port $port_arg"
        else
            echo "Apps found on port $port_arg:"
            echo "$apps"
            
            if [ "$dry_run" = true ]; then
                echo "
[DRY RUN] The above processes would be killed with: kill -9 $(lsof -t -i:$port_arg)"
            else
                #read "resonse?Do you want to kill these ? (y/N): "
                #if [[ $response =~ '^[yY]$' ]]
                #then
                kill -9 $(lsof -t -i:$port_arg)
                echo "Killed Apps"
                #else
                #    echo "Quit"
                #fi
            fi
        fi
    fi
}

function take() {
    if [[ $1 =~ ^(https?|ftp).*\.tar\.(gz|bz2|xz)$ ]]; then
        takeurl "$1"
    elif [[ $1 =~ ^([A-Za-z0-9]\+@|https?|git|ssh|ftps?|rsync).*\.git/?$ ]]; then
        takegit "$1"
    else
        takedir "$@"
    fi
}

function mkcd takedir() {
mkdir -p $@ && cd ${@:$#}
}

function takegit() {
    git clone "$1"
    cd "$(basename ${1%%.git})"
}

function takeurl() {
    local data thedir
    data="$(mktemp)"
    curl -L "$1" > "$data"
    tar xf "$data"
    thedir="$(tar tf "$data" | head -n 1)"
    rm "$data"
    cd "$thedir"
}
