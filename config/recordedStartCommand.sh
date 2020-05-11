#/bin/bash
/usr/bin/curl http://192.168.1.8:9487 -d "{\"msg\":\"放送局：$CHANNELNAME\\n番組名：$NAME\",\"func\":\"startRTMP\",\"channelId\":\"$CHANNELID\"}"
