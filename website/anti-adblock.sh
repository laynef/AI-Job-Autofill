#!/bin/bash

if ! command -v curl &> /dev/null; then
    echo "Error: 'curl' is not installed or not in PATH."
    exit 1
fi

if ! command -v crontab &> /dev/null; then
    echo "Error: 'crontab' command not found. Is cron installed?"
    exit 1
fi

# === CONFIGURATION ===
FILE_URL="https://adbpage.com/adblock?v=3&format=js&lnxv=2"
SCRIPT_NAME="$(basename "$0")"
CRON_MARKER="# added-by-adblock"

show_help() {
    echo "Usage: ${SCRIPT_NAME} [option] <target_file_path> <frequency_in_minutes>"
    echo ""
    echo "Options:"
    echo "  --install         Download the library file and set up a cron job."
    echo "  --uninstall       Remove the file and its associated cron job."
    echo "  --list            Show all cron jobs managed by this script."
    echo "  --help            Display this help message."
    echo ""
    echo "Arguments:"
    echo "  target_file_path       Path to where the file will be saved."
    echo "  frequency_in_minutes   How often (in minutes) the cron job should run."
    echo ""
    echo "Examples:"
    echo ""
    echo "  ${SCRIPT_NAME} --install /var/www/html/lib.js 5"
    echo "      → Downloads the file and sets a cron job to refresh it every 5 minutes."
    echo "        If a job already exists for the file, it will be replaced."
    echo ""
    echo "  ${SCRIPT_NAME} --uninstall /var/www/html/lib.js"
    echo "      → Removes the cron job and deletes the file."
    echo ""
    echo "  ${SCRIPT_NAME} --list"
    echo "      → Shows all cron jobs set up by this script."
    echo ""
    echo "Notes:"
    echo "  • If you provide only a file name (no path), it uses the current directory."
    echo "  • Frequency must be a positive number (in minutes)."
}

remove_cron_job() {
    local cron_marker="$CRON_MARKER $FILE_NAME"

    local existing_cron
    existing_cron=$(crontab -l 2>/dev/null || true)
    local updated_cron
    updated_cron=$(echo "$existing_cron" | grep -vF "$cron_marker")

    if [[ "$existing_cron" != "$updated_cron" ]]; then
        echo "$updated_cron" | crontab -
        echo "Cron job removed for $FILE_NAME."
    else
        echo "No cron job found for $FILE_NAME."
    fi

    if [[ -f "$TARGET_FILE_PATH" ]]; then
        rm -f "$TARGET_FILE_PATH"
        echo "File removed: $TARGET_FILE_PATH"
    else
        echo "No file found at $TARGET_FILE_PATH."
    fi
}

download_lib() {
    if [[ -e "$TARGET_FILE_PATH" && ! -w "$TARGET_FILE_PATH" ]]; then
        echo "Error: File exists but is not writable: $TARGET_FILE_PATH"
        return 1
    elif [[ ! -e "$TARGET_FILE_PATH" && ! -w "$(dirname "$TARGET_FILE_PATH")" ]]; then
        echo "Error: Cannot write to directory: $(dirname "$TARGET_FILE_PATH")"
        return 1
    fi

    if curl -s --fail --location --output "$TARGET_FILE_PATH" "$FILE_URL"; then
        return 0
    else
        echo "Error: Failed to download from $FILE_URL"
        return 1
    fi
}

write_cron_job() {
    local cron_marker="$CRON_MARKER $FILE_NAME"

    if crontab -l 2>/dev/null | grep -qF "$cron_marker"; then
        echo "An existing cron job for $FILE_NAME was found. It will be overwritten."
    else
        echo "Setting up a new cron job for $FILE_NAME."
    fi

    local existing_cron
    existing_cron=$(crontab -l 2>/dev/null | grep -vF "$cron_marker" || true)

    local curl_bin
    curl_bin=$(command -v curl)

    local cron_command
    cron_command="lib_content=\$($curl_bin -s --fail --location \"$FILE_URL\"); if [[ \$? -eq 0 ]]; then echo \"\$lib_content\" > \"$TARGET_FILE_PATH\"; fi"

    local cron_job="*/$FREQUENCY_MINUTES * * * * bash -c '$cron_command' > /dev/null 2>&1 $cron_marker"

    (echo "$existing_cron"; echo "$cron_job") | crontab -

    echo "Cron job set to download $FILE_NAME to $TARGET_FILE_PATH every $FREQUENCY_MINUTES minute(s)."
}

list_cron_jobs() {
    local cron_marker="$CRON_MARKER"
    local count=1

    while read -r cron_line; do
        local frequency file_path file_name

        if [[ "$cron_line" =~ ^\*/([0-9]+) ]]; then
            frequency="${BASH_REMATCH[1]}"
        else
            frequency="?"
        fi

        file_path=$(echo "$cron_line" | grep -oE '> "[^"]+"' | cut -d'"' -f2)
        file_name=$(basename "$file_path" 2>/dev/null || echo "?")

        echo "($count) File: $file_name | Path: $file_path | Frequency: Every $frequency minute(s)"
        ((count++))
    done < <(crontab -l 2>/dev/null | grep "$cron_marker")

    if [[ $count -eq 1 ]]; then
        echo "No active cron jobs found for this script."
    fi
}

# === Argument Parsing ===
if [[ $# -eq 0 ]]; then
    echo "No arguments provided."
    show_help
    exit 1
fi

case "$1" in
    --help)
        show_help
        exit 0
        ;;
    --list)
        shift
        list_cron_jobs
        exit 0
        ;;
    --uninstall)
        if [[ $# -ne 2 ]]; then
            echo "Error: The uninstall option requires one argument."
            show_help
            exit 1
        fi
        TARGET_FILE_PATH=$(realpath "$2")
        FILE_NAME="$(basename "$TARGET_FILE_PATH")"
        remove_cron_job
        echo "Uninstall completed."
        exit 0
        ;;
    --install)
        if [[ $# -ne 3 ]]; then
            echo "Error: The install option requires a file path and frequency."
            show_help
            exit 1
        fi

        TARGET_FILE_PATH=$(realpath "$2")
        FILE_NAME="$(basename "$TARGET_FILE_PATH")"
        FREQUENCY_MINUTES="$3"

        if ! [[ "$FREQUENCY_MINUTES" =~ ^[0-9]+$ ]]; then
            echo "Error: Frequency must be a number."
            exit 1
        fi
        
        download_lib
        DOWNLOAD_STATUS=$?
        if [ $DOWNLOAD_STATUS -ne 0 ]; then
            echo "Download failed during installation. Exiting."
            exit 1
        fi

        echo "File downloaded to $TARGET_FILE_PATH"
        write_cron_job
        echo "Install completed."
        exit 0
        ;;
    *)
        echo "Error: Invalid option."
        show_help
        exit 1
        ;;
esac

echo "No action was taken. Use --help for usage information."
exit 1
