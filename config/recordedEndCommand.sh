#/bin/bash
/usr/bin/curl http://192.168.1.8:9487 -d "{\"func\":\"endRTMP\",\"channelId\":\"$CHANNELID\"}"
