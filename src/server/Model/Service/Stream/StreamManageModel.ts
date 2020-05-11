import * as fs from 'fs';
import * as apid from '../../../../../api';
import Util from '../../../Util/Util';
import Model from '../../Model';
import { SocketIoManageModelInterface } from '../SocketIoManageModel';
import { LiveStreamInfo, RecordedStreamInfo, RTMPLiveStreamInfo, Stream } from './Stream';
import StreamStatus from './StreamStatus';
import * as enums from './StreamTypeInterface';

interface StreamBaseStatusInfo {
    streamNumber: number;
    isEnable: boolean; // 視聴可能か
    viewCnt: number; // 視聴数 (HLS では変動しない)
    type?: enums.StreamType;
    mode?: number; // config の index number
}

interface LiveStreamStatusInfo extends StreamBaseStatusInfo {
    channelId: apid.ServiceItemId;
}

interface RTMPLiveStreamStatusInfo extends LiveStreamStatusInfo {
    streamKey: string;
}

interface RecordedStreamStatusInfo extends StreamBaseStatusInfo {
    recordedId: apid.RecordedId;
    encodedId?: apid.EncodedId;
}

/**
 * Stream 情報
 */
type StreamStatusInfo = StreamBaseStatusInfo | RTMPLiveStreamStatusInfo | LiveStreamStatusInfo | RecordedStreamStatusInfo;

interface StreamManageModelInterface {
    getStreamInfo(num: number): StreamStatusInfo | null;
    getStreamInfos(): StreamStatusInfo[];
    getStream(streamNumber: number): Stream | null;
    start(stream: Stream): Promise<number>;
    stop(streamNumber: number): Promise<void>;
    forcedStopAll(): Promise<void>;
}

/**
 * StreamManageModel
 * Stream の管理を行う
 */
class StreamManageModel extends Model implements StreamManageModelInterface {
    private socketIo: SocketIoManageModelInterface;
    private maxStreaming: number;
    private streamStatus: { [key: number]: StreamStatus } = {};

    constructor(socketIo: SocketIoManageModelInterface) {
        super();

        this.socketIo = socketIo;

        // エンコード数上限を取得
        this.maxStreaming = this.config.getConfig().maxStreaming || 0;
    }

    /**
     * Stream 情報を取得
     * @param num: stream number
     * @return StreamStatusInfo
     */
    public getStreamInfo(num: number): StreamStatusInfo | null {
        if (typeof this.streamStatus[num] === 'undefined' || this.streamStatus[num].stream === null) { return null; }

        const stream = this.streamStatus[num].stream!;
        const streamInfo = stream.getInfo();

        const result: StreamBaseStatusInfo =  {
            streamNumber: num,
            isEnable: this.streamStatus[num].isEnable,
            viewCnt: stream.getCount(),
            type: streamInfo.type,
            mode: streamInfo.mode,
        };

        if (streamInfo.type.includes('Live')) {
            (<LiveStreamStatusInfo> result).channelId = (<LiveStreamInfo> streamInfo).channelId;
        }
        if (streamInfo.type.includes('Recorded')) {
            (<RecordedStreamStatusInfo> result).recordedId = (<RecordedStreamInfo> streamInfo).recordedId;
            if (typeof (<RecordedStreamStatusInfo> streamInfo).encodedId !== 'undefined') {
                (<RecordedStreamStatusInfo> result).encodedId = (<RecordedStreamInfo> streamInfo).encodedId;
            }
        }
        if (streamInfo.type.includes('RTMPLive')) {
            (<RTMPLiveStreamStatusInfo> result).streamKey = (<RTMPLiveStreamInfo> streamInfo).streamKey;
        }

        return <StreamStatusInfo> result;
    }

    /**
     * すべての Stream 情報を取得
     * @return StreamStatusInfo[]
     */
    public getStreamInfos(): StreamStatusInfo[] {
        const results: StreamStatusInfo[] = [];
        for (let i = 0; i < this.maxStreaming; i++) {
            if (typeof this.streamStatus[i] === 'undefined') { continue; }
            const result = this.getStreamInfo(i);
            if (result === null) {
                results.push({
                    streamNumber: i,
                    isEnable: false,
                    viewCnt: 0,
                });
            } else {
                results.push(result);
            }
        }

        return results;
    }

    /**
     * Stream を取得
     * @param streamNumber: stream number
     * @return Stream | null
     */
    public getStream(streamNumber: number): Stream | null {
        return typeof this.streamStatus[streamNumber] === 'undefined' ? null : this.streamStatus[streamNumber].stream;
    }

    /**
     * ストリームの開始
     * @param stream: Stream
     * @return streamNumber
     */
    public async start(stream: Stream): Promise<number> {
        const streamNumber = this.getEmptyStreamNumber();
        if (streamNumber === null || typeof this.streamStatus[streamNumber] !== 'undefined') { throw new Error('StartStreamError'); }

        this.streamStatus[streamNumber] = new StreamStatus();

        try {
            await this.runStream(streamNumber, stream);

            return streamNumber;
        } catch (err) {
            this.log.stream.error('start stream error');
            this.log.stream.error(err.message);
            throw err;
        }
    }

    /**
     * ストリームを停止
     * @param streamNumber: stream number
     */
    public async stop(streamNumber: number): Promise<void> {
        if (typeof this.streamStatus[streamNumber] === 'undefined' || this.streamStatus[streamNumber].stream === null) {
            return;
        }

        const stream = this.streamStatus[streamNumber].stream!;

        // カウントが 0 なら停止
        if (stream.getCount() > 0) { return; }
        delete this.streamStatus[streamNumber];
        await stream.stop();

        this.log.stream.info(`stop stream: ${ streamNumber }`);
    }

    /**
     * すべてのストリームを強制的に停止
     */
    public async forcedStopAll(): Promise<void> {
        this.log.system.info('force stop all stremas');

        for (let i = 0; i < this.maxStreaming; i++) {
            if (typeof this.streamStatus[i] === 'undefined') { continue; }
            if (this.streamStatus[i].stream === null) {
                delete this.streamStatus[i];
                continue;
            }

            try {
                this.streamStatus[i].stream!.resetCount(false);
                await this.stop(i);
            } catch (err) {
                this.log.system.error(err);
            }
        }
    }

    /**
     * stream を開始する
     * @param streamNumber: stream number
     * stream: Stream
     */
    private async runStream(streamNumber: number, stream: Stream): Promise<void> {
        try {
            await stream.start(streamNumber);
        } catch (err) {
            delete this.streamStatus[streamNumber];
            throw err;
        }

        this.streamStatus[streamNumber].stream = stream;

        if (stream.getInfo().type.includes('HLS')) {
            // HLS
            // ファイルを定期的に監視して stream.isEnable = true にする
            this.checkStreamEnable(streamNumber);
        } else {
            this.streamStatus[streamNumber].isEnable = true;
        }

        this.log.stream.info(`start stream: ${ streamNumber }`);
        this.notify();
    }

    /**
     * HLS のファイルを再生可能になるまで監視して有効化する
     * @param streamNumber: stream number
     */
    private checkStreamEnable(streamNumber: number): void {
        const dirPath = Util.getStreamFilePath();

        const id = setInterval(() => {
            if (typeof this.streamStatus[streamNumber] === 'undefined') {
                clearInterval(id);

                return;
            }

            const fileList = fs.readdirSync(dirPath);

            let tsFileCount = 0;
            let m3u8Flag = false;
            fileList.map((file: string) => {
                if (file.match(`stream${streamNumber}`)) {
                    if (file.match(/.m3u8/)) { m3u8Flag = true; }
                    else { tsFileCount += 1; }
                }
            });

            if (m3u8Flag && tsFileCount >= 3) {
                clearInterval(id);
                this.streamStatus[streamNumber].isEnable = true;
                this.log.stream.info(`enable stream: ${ streamNumber }`);
                this.notify();
            }
        }, 100);
    }

    /**
     * 空いている strema 番号を返す
     */
    private getEmptyStreamNumber(): number | null {
        for (let i = 0; i < this.maxStreaming; i++) { if (typeof this.streamStatus[i] === 'undefined') { return i; } }

        return null;
    }

    /**
     * socketio 通知
     */
    private notify(): void {
        this.socketIo.notifyClient();
    }
}

export { RTMPLiveStreamStatusInfo, LiveStreamStatusInfo, RecordedStreamStatusInfo, StreamManageModelInterface, StreamManageModel };
