#!/bin/bash

function getHeight() {
    echo $VIDEORESOLUTION | sed -e "s/[^0-9]//g"
}

if [ `getHeight` -ge 1080 ]; then
    nice -10 $FFMPEG -dual_mono_mode main -fix_sub_duration -c:s libaribb24 -aribb24-base-path "/mnt/record/aribb24" -i "$INPUT" -c:v libx264 -vf yadif -s 1440x1080 -aspect 16:9 -preset veryfast -c:a aac -ar 48000 -ab 256k -ac 2 -c:s srt -f matroska "$OUTPUT"
elif [ `getHeight` -ge 720 ]; then
    nice -10 $FFMPEG -dual_mono_mode main -fix_sub_duration -c:s libaribb24 -aribb24-base-path "/mnt/record/aribb24" -i "$INPUT" -c:v libx264 -vf yadif -s 960x720 -aspect 16:9 -preset veryfast -c:a aac -ar 48000 -ab 192k -ac 2 -c:s srt -f matroska "$OUTPUT"
else
    nice -10 $FFMPEG -dual_mono_mode main -fix_sub_duration -c:s libaribb24 -aribb24-base-path "/mnt/record/aribb24" -i "$INPUT" -c:v libx264 -vf yadif -s 640x480 -aspect 16:9 -preset veryfast -c:a aac -ar 48000 -ab 128k -ac 2 -c:s srt -f matroska "$OUTPUT"
fi
