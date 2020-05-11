import * as m from 'mithril';
import * as apid from '../../../../api';
import { ViewModelStatus } from '../../Enums';
import { ConfigApiModelInterface } from '../../Model/Api/ConfigApiModel';
import { StreamsApiModelInterface } from '../../Model/Api/StreamsApiModel';
import { SettingValue } from '../../Model/Setting/SettingModel';
import { SnackbarModelInterface } from '../../Model/Snackbar/SnackbarModel';
import StorageTemplateModel from '../../Model/Storage/StorageTemplateModel';
import Util from '../../Util/Util';
import ViewModel from '../ViewModel';
import CreateStreamLink from './CreateStreamLink';

/**
 * StreamsApiModel
 */
class StreamInfoViewModel extends ViewModel {
    private streamsApiModel: StreamsApiModelInterface;
    private config: ConfigApiModelInterface;
    private setting: StorageTemplateModel<SettingValue>;
    private snackbar: SnackbarModelInterface;
    private timer: number | null = null;

    constructor(
        streamsApiModel: StreamsApiModelInterface,
        config: ConfigApiModelInterface,
        snackbar: SnackbarModelInterface,
        setting: StorageTemplateModel<SettingValue>,
    ) {
        super();
        this.streamsApiModel = streamsApiModel;
        this.config = config;
        this.snackbar = snackbar;
        this.setting = setting;
    }

    /**
     * init
     */
    public async init(status: ViewModelStatus = 'init'): Promise<void> {
        super.init(status);

        if (status === 'init') {
            this.streamsApiModel.init();
            m.redraw();
        }

        await Util.sleep(500);
        await this.updateInfos();
    }

    /**
     * ストリーム情報を更新 & 自動更新用のタイマーをセット
     */
    public async updateInfos(): Promise<void> {
        this.stopTimer();
        try {
            await this.streamsApiModel.fetchInfos();
        } catch (err) {
            console.error(err);
            window.setTimeout(() => { this.updateInfos(); }, 5000);

            return;
        }

        let minEndTime = 6048000000;
        const now = new Date().getTime();
        this.getStreamInfos().forEach((info) => {
            if (typeof info.type === 'undefined' || !info.type.includes('Live')) { return; }
            const endTime = info.endAt! - now;
            if (minEndTime > endTime) {
                minEndTime = endTime;
            }
        });

        if (minEndTime < 0) { minEndTime = 0; }

        this.timer = window.setTimeout(() => {
            this.updateInfos();
        }, minEndTime);
    }

    /**
     * タイマー停止
     */
    public stopTimer(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * ストリーム情報を取得
     * @return apid.StreamInfo[]
     */
    public getStreamInfos(): apid.StreamInfo[] {
        return this.streamsApiModel.getInfos();
    }

    /**
     * 視聴用ページへ移動
     * @param num: infos index number
     */
    public view(num: number): void {
        const info = this.streamsApiModel.getInfos()[num];
        if (typeof info === 'undefined') { return; }

        if (info.type === 'MpegTsLive') {
            const setting = this.setting.get();
            let url: string | null = null;
            try {
                url = CreateStreamLink.mpegTsStreamingLink(
                    this.config.getConfig(),
                    setting === null ? null : {
                        isEnableURLScheme: setting.isEnableMegTsStreamingURLScheme,
                        customURLScheme: setting.customMegTsStreamingURLScheme,
                    },
                    info.channelId!,
                    info.mode!,
                );
            } catch (err) {
                console.error(err);
                this.snackbar.open('視聴用アプリの設定がされていません');

                return;
            }

            if (url === null) { return; }

            location.href = url;
        } else if (info.type === 'RecordedHLS' || info.type === 'HLSLive') {
            if (Number(m.route.param('stream')) === info.streamNumber) { return; }

            window.setTimeout(() => { Util.move('/stream/watch', { stream: info.streamNumber }); }, 200);
        } else if (info.type === 'RTMPLive') {
            window.setTimeout(() => { Util.move('/stream/watchRTMP', { stream: info.streamNumber }); }, 200);
        }
    }
}

export default StreamInfoViewModel;

