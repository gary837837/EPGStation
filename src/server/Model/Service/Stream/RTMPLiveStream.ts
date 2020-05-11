import { ChildProcess } from 'child_process';
import * as http from 'http';
import * as apid from '../../../../../api';
import CreateMirakurun from '../../../Util/CreateMirakurunClient';
import ProcessUtil from '../../../Util/ProcessUtil';
import Util from '../../../Util/Util';
import { EncodeProcessManageModelInterface } from '../Encode/EncodeProcessManageModel';
import { SocketIoManageModelInterface } from '../SocketIoManageModel';
import { RTMPLiveStreamInfo, Stream } from './Stream';
import { StreamManageModelInterface } from './StreamManageModel';

/**
 * RTMP ライブ配信
 */
class RTMPLiveStream extends Stream {
    private channelId: apid.ServiceItemId;
    private streamKey: string;
    private mode: number;
    private enc: ChildProcess | null = null;
    private stream: http.IncomingMessage | null = null;

    /**
     * @param process: EncodeProcessManageModelInterface
     * @param manager: StreamManageModelInterface
     * @param channelId: channel id
     * @param mode: config.mpegTsStreaming の index number
     */
    constructor(
        process: EncodeProcessManageModelInterface,
        socketIo: SocketIoManageModelInterface,
        manager: StreamManageModelInterface,
        channelId: apid.ServiceItemId, mode: number,
    ) {
        super(process, socketIo, manager);

        this.channelId = channelId;
        this.streamKey = Math.ceil(Math.random() * 4294967296).toString(16);
        this.mode = mode;
    }

    public async start(streamNumber: number): Promise<void> {
        await super.start(streamNumber);

        const mirakurun = CreateMirakurun.get();
        mirakurun.priority = this.getPriority();

        try {
            // 放送波受信
            this.stream = await mirakurun.getServiceStream(this.channelId, true, this.getPriority());

            // エンコードプロセス生成
            const config = this.config.getConfig().liveRTMP;
            if (typeof config === 'undefined' || typeof config[this.mode] === 'undefined') { throw new Error('RTMPLiveStreamConfigError'); }
            const rtmpURL = config[this.mode].url.replace('%ENC_NUM%', this.streamKey);
            const cmd = config[this.mode].cmd.replace('%FFMPEG%', Util.getFFmpegPath())
                                             .replace('%RTMP_URL%', rtmpURL);

            this.enc = await this.process.create('', '', cmd, Stream.priority);

            // mirakurun のストリームをエンコードプロセスへパイプする
            if (this.enc.stdin !== null) {
                this.stream.pipe(this.enc.stdin);
            }

            this.enc.on('exit', () => { this.ChildExit(streamNumber); });
            this.enc.on('error', () => { this.ChildExit(streamNumber); });

            if (this.enc.stderr !== null) {
                this.enc.stderr.on('data', (data) => { this.log.stream.debug(String(data)); });
            }
        } catch (err) {
            await this.stop();
            throw err;
        }
    }

    public async stop(): Promise<void> {
        if (this.stream !== null) {
            this.stream.unpipe();
            this.stream.destroy();
        }

        if (this.enc !== null) {
            await ProcessUtil.kill(this.enc);
        }

        await super.stop();
    }

    public getInfo(): RTMPLiveStreamInfo {
        return {
            type: 'RTMPLive',
            channelId: this.channelId,
            mode: this.mode,
            streamKey: this.streamKey,
        };
    }

    public getStreamKey(): string {
        return this.streamKey;
    }
}

export default RTMPLiveStream;
