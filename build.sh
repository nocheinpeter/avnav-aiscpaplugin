#! /bin/sh
cd `dirname $0`|| exit 1
base="aiscpa"
version=`jq -r '.version' < "$base/plugin.json"`
name="releases/avnav-${base}plugin-$version.zip"
echo "creating $name"
zip "$name" -r "$base"

