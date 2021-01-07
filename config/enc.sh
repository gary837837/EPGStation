#!/bin/bash

function getHeight() {
    echo $VIDEORESOLUTION | sed -e "s/[^0-9]//g"
}

if [ `getHeight` -ge 1080 ]; then
    nice -10 $FFMPEG -dual_mono_mode main -fix_sub_duration -c:s libaribb24 -aribb24-base-path "/mnt/record/aribb24" -i "$INPUT" -vf "yadif,scale=-2:1080" -c:v h264_amf -usage transcoding -profile:v high -quality quality -level 40 -rc cqp -qp_i 23 -qp_p 29 -qp_b 28 -b:v 0 -aspect 16:9 -c:a aac -ar 48k -ab 256k -ac 2 -c:s srt -f matroska "$OUTPUT"
elif [ `getHeight` -ge 720 ]; then
    nice -10 $FFMPEG -dual_mono_mode main -fix_sub_duration -c:s libaribb24 -aribb24-base-path "/mnt/record/aribb24" -i "$INPUT" -vf "yadif,scale=-2:720" -c:v h264_amf -usage transcoding -profile:v high -quality quality -level 40 -rc cqp -qp_i 23 -qp_p 29 -qp_b 28 -b:v 0 -aspect 16:9 -c:a aac -ar 48k -ab 192k -ac 2 -c:s srt -f matroska "$OUTPUT"
else
    nice -10 $FFMPEG -dual_mono_mode main -fix_sub_duration -c:s libaribb24 -aribb24-base-path "/mnt/record/aribb24" -i "$INPUT" -vf "yadif,scale=-2:480" -c:v h264_amf -usage transcoding -profile:v high -quality quality -level 40 -rc cqp -qp_i 23 -qp_p 29 -qp_b 28 -b:v 0 -aspect 16:9 -c:a aac -ar 48k -ab 128k -ac 2 -c:s srt -f matroska "$OUTPUT"
fi
