#!/usr/bin/env bash

plugin_name=CoobaMeFinnishDev
plugin_path_linux=~/.local/share/Anki2/addons21
plugin_path_mac=~/Library/Application\ Support/Anki2/addons21

if [ -d "$plugin_path_linux" ]; then
    ln -sfF "$(pwd)/plugin" "$plugin_path_mac/$plugin_name"
fi

if [ -d "$plugin_path_mac" ]; then
    ln -sfF "$(pwd)/plugin" "$plugin_path_mac/$plugin_name"
fi
