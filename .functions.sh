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
    re='^[0-9]{4}$'
    if ! [ $1 -lt 65534 ] && [ $1 -gt 1000 ]
    then
        echo "Invalid input: $1. Enter a valid port number. (Numbers less than 1000 are considered invalid)"
    else
        apps="$(lsof -i:$1)"
        if [ -z $apps  ]
        then
            echo "No apps using the port $1"
        else
            echo "Apps found: "
            echo "$apps"
            #read "resonse?Do you want to kill these ? (y/N): "
            #if [[ $response =~ '^[yY]$' ]]
            #then
            kill -9 $(lsof -t -i:$1)
            echo "Killed Apps"
            #else
            #    echo "Quit"
            #fi
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
