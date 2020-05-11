import * as path from 'path';
import * as apid from '../../../../api';
import FileUtil from '../../Util/FileUtil';
import StrUtil from '../../Util/StrUtil';
import Util from '../../Util/Util';
import * as DBSchema from './DBSchema';
import DBTableBase from './DBTableBase';

interface FindAllOption {
    limit?: number;
    offset?: number;
    query?: FindQuery;
    isAddBaseDir?: boolean;
    reverse?: boolean;
}

interface FindQuery {
    ruleId?: number | null;
    genre1?: number;
    channelId?: number;
    keyword?: string;
    hasTs?: boolean;
    recording?: boolean;
}

interface CntItem {
    error: number;
    drop: number;
    scrambling: number;
}

interface VideoInfo {
    videoType: apid.ProgramVideoType | null;
    videoResolution: apid.ProgramVideoResolution | null;
    videoStreamContent: number | null;
    videoComponentType: number | null;
    audioSamplingRate: apid.ProgramAudioSamplingRate | null;
    audioComponentType: number | null;
}

interface ProgramInfo extends VideoInfo {
    startAt: apid.UnixtimeMS;
    endAt: apid.UnixtimeMS;
    duration: number;
    name: string;
    description: string | null;
    extended: string | null;
    genre1: number | null;
    genre2: number | null;
    genre3: number | null;
    genre4: number | null;
    genre5: number | null;
    genre6: number | null;
}

interface ProgramStrInfo {
    name: string;
    description: string | null;
    extended: string | null;
}

interface RecordedFilesItem {
    id: number;
    recPath: string | null;
    logPath: string | null;
}

interface RawLogPathItem {
    id: number;
    logPath: string;
}

interface RecordedDBInterface extends DBTableBase {
    create(): Promise<void>;
    drop(): Promise<void>;
    insert(program: DBSchema.RecordedSchema): Promise<number>;
    restore(programs: DBSchema.RecordedSchema[], isDelete?: boolean, hasBaseDir?: boolean): Promise<void>;
    replace(program: DBSchema.RecordedSchema): Promise<void>;
    delete(id: number): Promise<void>;
    deleteRecPath(id: number): Promise<void>;
    deleteRuleId(ruleId: number): Promise<void>;
    addThumbnail(id: number, filePath: string): Promise<void>;
    removeRecording(id: number): Promise<void>;
    removeAllRecording(): Promise<void>;
    updateTsFilePath(recordedId: number, filePath: string, newTmp: boolean): Promise<void>;
    updateFileSize(recordedId: number): Promise<void>;
    updateLogFilePath(recordedId: number, filePath: string): Promise<void>;
    updateAllNullFileSize(): Promise<void>;
    updateCnt(recordedId: number, item: CntItem): Promise<void>;
    updateProgramStrInfo(recordedId: number, info: ProgramStrInfo): Promise<void>;
    updateProgramInfo(recordedId: number, info: ProgramInfo): Promise<void>;
    updateVideoInfo(recordedId: number, info: VideoInfo): Promise<void>;
    findId(id: number): Promise<DBSchema.RecordedSchema | null>;
    findOld(): Promise<DBSchema.RecordedSchema | null>;
    findRuleIdList(ruleId: number): Promise<{ id: number }[]>;
    findCleanupList(): Promise<{ id: number }[]>;
    findTmp(): Promise<DBSchema.RecordedSchema[]>;
    findAll(option?: FindAllOption): Promise<DBSchema.RecordedSchema[]>;
    getTotal(option?: FindQuery): Promise<number>;
    getRuleTag(): Promise<DBSchema.RuleTag[]>;
    getChannelTag(): Promise<DBSchema.ChannelTag[]>;
    getGenreTag(): Promise<DBSchema.GenreTag[]>;
    getAllFiles(): Promise<RecordedFilesItem[]>;
    getRawLogPaths(): Promise<RawLogPathItem[]>;
}

abstract class RecordedDB extends DBTableBase implements RecordedDBInterface {
    /**
     * get table name
     * @return string
     */
    protected getTableName(): string {
        return DBSchema.TableName.Recorded;
    }

    /**
     * create table
     * @return Promise<void>
     */
    public abstract create(): Promise<void>;

    /**
     * drop table
     */
    public drop(): Promise<void> {
        return this.operator.runQuery(`drop table if exists ${ DBSchema.TableName.Recorded }`);
    }


    /**
     * recorded 挿入
     * @param program: DBSchema.RecordedSchema
     * @param Promise<number> insertId
     */
    public insert(program: DBSchema.RecordedSchema): Promise<number> {
        let baseDir = Util.getRecordedPath();
        const tmpDir = Util.getRecordedTmpPath();
        if (program.isTmp && tmpDir !== null) { baseDir = tmpDir; }

        const logDir = this.getDropCheckLogDir();

        const value: any[] = [];
        value.push(program.programId);
        value.push(program.channelId);
        value.push(program.channelType);
        value.push(program.startAt);
        value.push(program.endAt);
        value.push(program.duration);
        value.push(program.name);
        value.push(program.description);
        value.push(program.extended);
        value.push(program.genre1);
        value.push(program.genre2);
        value.push(program.genre3);
        value.push(program.genre4);
        value.push(program.genre5);
        value.push(program.genre6);
        value.push(program.videoType);
        value.push(program.videoResolution);
        value.push(program.videoStreamContent);
        value.push(program.videoComponentType);
        value.push(program.audioSamplingRate);
        value.push(program.audioComponentType);
        value.push(program.recPath === null ? null : program.recPath.slice(baseDir.length + path.sep.length));
        value.push(program.ruleId);
        value.push(program.thumbnailPath);
        value.push(program.recording);
        value.push(program.protection);
        value.push(program.filesize);
        value.push(program.logPath === null ? null : program.logPath.slice(logDir.length + path.sep.length));
        value.push(program.errorCnt);
        value.push(program.dropCnt);
        value.push(program.scramblingCnt);
        value.push(program.isTmp);

        const query = `insert into ${ DBSchema.TableName.Recorded } (`
            + this.createInsertColumnStr(false)
        + ') VALUES ('
            + this.operator.createValueStr(1, value.length)
        + `) ${ this.operator.getReturningStr() }`;


        return this.operator.runInsert(query, value);
    }

    /**
     * get dropCheckLogDir
     * @return string
     */
    private getDropCheckLogDir(): string {
        return Util.getDropCheckLogDir() || Util.getRecordedPath();
    }

    /**
     * insert 時のカラムを生成
     * @param hasId: boolean
     * @return string
     */
    private createInsertColumnStr(hasId: boolean): string {
        return (hasId ? 'id, ' : '')
            + 'programId, '
            + 'channelId, '
            + 'channelType, '
            + 'startAt, '
            + 'endAt, '
            + 'duration, '
            + 'name, '
            + 'description, '
            + 'extended, '
            + 'genre1, '
            + 'genre2, '
            + 'genre3, '
            + 'genre4, '
            + 'genre5, '
            + 'genre6, '
            + 'videoType, '
            + 'videoResolution, '
            + 'videoStreamContent, '
            + 'videoComponentType, '
            + 'audioSamplingRate, '
            + 'audioComponentType, '
            + 'recPath, '
            + 'ruleId, '
            + 'thumbnailPath, '
            + 'recording, '
            + 'protection, '
            + 'filesize, '
            + 'logPath, '
            + 'errorCnt, '
            + 'dropCnt, '
            + 'scramblingCnt, '
            + 'isTmp ';
    }

    /**
     * restore
     * @param program: DBSchema.RecordedSchema[]
     * @param isDelete: boolean
     * @param hasBaseDir: boolean
     */
    public restore(programs: DBSchema.RecordedSchema[], isDelete: boolean = true, hasBaseDir: boolean = true): Promise<void> {
        let baseDir = Util.getRecordedPath();
        const tmpDir = Util.getRecordedTmpPath();
        const logDir = this.getDropCheckLogDir();

        const values: any[] = [];
        for (const program of programs) {
            if (program.isTmp && tmpDir !== null) { baseDir = tmpDir; }
            const value: any[] = [];

            let recPath = program.recPath;
            let logPath = program.logPath;
            if (hasBaseDir) {
                if (recPath !== null) {
                    recPath = recPath.slice(baseDir.length + path.sep.length);
                }
                if (logPath !== null) {
                    logPath = logPath.slice(logDir.length + path.sep.length);
                }
            }

            value.push(program.id);
            value.push(program.programId);
            value.push(program.channelId);
            value.push(program.channelType);
            value.push(program.startAt);
            value.push(program.endAt);
            value.push(program.duration);
            value.push(program.name);
            value.push(program.description);
            value.push(program.extended);
            value.push(program.genre1);
            value.push(program.genre2);
            value.push(program.genre3);
            value.push(program.genre4);
            value.push(program.genre5);
            value.push(program.genre6);
            value.push(program.videoType);
            value.push(program.videoResolution);
            value.push(program.videoStreamContent);
            value.push(program.videoComponentType);
            value.push(program.audioSamplingRate);
            value.push(program.audioComponentType);
            value.push(recPath);
            value.push(program.ruleId);
            value.push(program.thumbnailPath);
            value.push(program.recording);
            value.push(program.protection);
            value.push(program.filesize);
            value.push(logPath);
            value.push(program.errorCnt);
            value.push(program.dropCnt);
            value.push(program.scramblingCnt);
            value.push(program.isTmp);

            values.push({
                query: `insert into ${ DBSchema.TableName.Recorded } (`
                    + this.createInsertColumnStr(true)
                    + ') VALUES ('
                    + this.operator.createValueStr(1, value.length)
                    + ')',
                values: value,
            });
        }


        return this.operator.manyInsert(DBSchema.TableName.Recorded, values, isDelete);
    }

    /**
     * recorded 更新
     * @param program: DBSchema.RecordedSchema
     * @param Promise<void>
     */
    public async replace(program: DBSchema.RecordedSchema): Promise<void> {
        let baseDir = Util.getRecordedPath();
        const tmpDir = Util.getRecordedTmpPath();
        if (program.isTmp && tmpDir !== null) { baseDir = tmpDir; }

        const logDir = this.getDropCheckLogDir();

        const value: any[] = [];
        value.push(program.id);
        value.push(program.programId);
        value.push(program.channelId);
        value.push(program.channelType);
        value.push(program.startAt);
        value.push(program.endAt);
        value.push(program.duration);
        value.push(program.name);
        value.push(program.description);
        value.push(program.extended);
        value.push(program.genre1);
        value.push(program.genre2);
        value.push(program.genre3);
        value.push(program.genre4);
        value.push(program.genre5);
        value.push(program.genre6);
        value.push(program.videoType);
        value.push(program.videoResolution);
        value.push(program.videoStreamContent);
        value.push(program.videoComponentType);
        value.push(program.audioSamplingRate);
        value.push(program.audioComponentType);
        value.push(program.recPath === null ? null : program.recPath.slice(baseDir.length + path.sep.length));
        value.push(program.ruleId);
        value.push(program.thumbnailPath);
        value.push(program.recording);
        value.push(program.protection);
        value.push(program.filesize);
        value.push(program.logPath === null ? null : program.logPath.slice(logDir.length + path.sep.length));
        value.push(program.errorCnt);
        value.push(program.dropCnt);
        value.push(program.scramblingCnt);
        value.push(program.isTmp);

        const isReplace = this.operator.getUpsertType() === 'replace';
        let query = `${ isReplace ? 'replace' : 'insert' } into ${ DBSchema.TableName.Recorded } (`
            + this.createInsertColumnStr(true)
        + ') VALUES ('
            + this.operator.createValueStr(1, value.length)
        + ')';

        if (!isReplace) {
            query += ' on conflict (id) do update set '
                + 'programId = excluded.programId, '
                + 'channelId = excluded.channelId, '
                + 'channelType = excluded.channelType, '
                + 'startAt = excluded.startAt, '
                + 'endAt = excluded.endAt, '
                + 'duration = excluded.duration, '
                + 'name = excluded.name, '
                + 'description = excluded.description, '
                + 'extended = excluded.extended, '
                + 'genre1 = excluded.genre1, '
                + 'genre2 = excluded.genre2, '
                + 'genre3 = excluded.genre3, '
                + 'genre4 = excluded.genre4, '
                + 'genre5 = excluded.genre5, '
                + 'genre6 = excluded.genre6, '
                + 'videoType = excluded.videoType, '
                + 'videoResolution = excluded.videoResolution, '
                + 'videoStreamContent = excluded.videoStreamContent, '
                + 'videoComponentType = excluded.videoComponentType, '
                + 'audioSamplingRate = excluded.audioSamplingRate, '
                + 'audioComponentType = excluded.audioComponentType, '
                + 'recPath = excluded.recPath, '
                + 'ruleId = excluded.ruleId, '
                + 'thumbnailPath = excluded.thumbnailPath, '
                + 'recording = excluded.recording, '
                + 'protection = excluded.protection, '
                + 'filesize = excluded.filesize, '
                + 'logPath = excluded.logPath, '
                + 'errorCnt = excluded.errorCnt, '
                + 'dropCnt = excluded.dropCnt, '
                + 'scramblingCnt = excluded.scramblingCnt, '
                + 'isTmp = excluded.isTmp ';
        }

        await this.operator.runQuery(query, value);
    }

    /**
     * recorded を削除
     * @param id: recorded id
     * @return Promise<void>
     */
    public delete(id: number): Promise<void> {
        return this.operator.runQuery(`delete from ${ DBSchema.TableName.Recorded } where id = ${ id }`);
    }

    /**
     * recPath を削除
     * @param id: recorded id
     * @return Promise<void>
     */
    public deleteRecPath(id: number): Promise<void> {
        return this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set recPath = null, filesize = null where id = ${ id }`);
    }

    /**
     * ruleId を削除
     * @param ruleId: rule id
     * @return Promise<void>
     */
    public deleteRuleId(ruleId: number): Promise<void> {
        return this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set ruleId = null where ruleId = ${ ruleId }`);
    }

    /**
     * thumbnail filePath を追加
     * @param id: recorded id
     * @param filePath: thumbnail path
     * @return Promise<void>
     */
    public addThumbnail(id: number, filePath: string): Promise<void> {
        const thumbnailDir = Util.getThumbnailPath();

        return this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set thumbnailPath = '${ filePath.slice(thumbnailDir.length + path.sep.length) }' where id = ${ id }`);
    }

    /**
     * recording 状態を解除する
     * @param id: recorded id
     * @return Promise<void>
     */
    public removeRecording(id: number): Promise<void> {
        return this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set recording = ${ this.operator.convertBoolean(false) } where id = ${ id }`);
    }

    /**
     * recording 状態をすべて解除する
     * @return Promise<void>
     */
    public removeAllRecording(): Promise<void> {
        return this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set recording = ${ this.operator.convertBoolean(false) } where recording = ${ this.operator.convertBoolean(true) }`);
    }

    /**
     * recPath を更新する
     * @param recordedId: recorded id
     * @param filePath: file path
     * @param newTmp: boolean
     * @return Promise<void>
     */
    public async updateTsFilePath(recordedId: number, filePath: string, newTmp: boolean): Promise<void> {
        const recorded = await this.findId(recordedId);
        if (recorded === null) { throw new Error('RecordedIsNotFound'); }

        let baseDir = Util.getRecordedPath();
        const tmpDir = Util.getRecordedTmpPath();
        if (newTmp && tmpDir !== null) { baseDir = tmpDir; }

        const query = `update ${ DBSchema.TableName.Recorded } set `
            + `recPath = ${ this.operator.createValueStr(1, 1) }, `
            + `isTmp = ${ this.operator.convertBoolean(newTmp) } `
            + `where id = ${ recordedId }`;

        await this.operator.runQuery(query, [
            filePath.slice(baseDir.length + path.sep.length),
        ]);
    }

    /**
     * filesize を更新する
     * @return Promise<void>
     */
    public async updateFileSize(recordedId: number): Promise<void> {
        const recorded = await this.findId(recordedId);
        if (recorded === null || recorded.recPath === null) { return; }

        const size = FileUtil.getFileSize(recorded.recPath);
        await this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set filesize = ${ size } where id = ${ recordedId }`);
    }

    /**
     * logPath を更新する
     * @param recordedId: recorded id
     * @param filePath: log file path
     * @return Promise<void>
     */
    public async updateLogFilePath(recordedId: number, filePath: string): Promise<void> {
        const recorded = await this.findId(recordedId);
        if (recorded === null) { throw new Error('RecordedIsNotFound'); }

        const query = `update ${ DBSchema.TableName.Recorded } set logPath = ${ this.operator.createValueStr(1, 1) } where id = ${ recordedId }`;

        await this.operator.runQuery(query, [filePath.slice(this.getDropCheckLogDir().length + path.sep.length)]);
    }

    /**
     * ファイルが存在して filesize が null のデータを更新する
     * @return Promise<void>
     */
    public async updateAllNullFileSize(): Promise<void> {
        let programs = <DBSchema.RecordedSchema[]> await this.operator.runQuery(`select ${ this.getAllColumns() } from ${ DBSchema.TableName.Recorded } where filesize is null and recPath is not null`);
        programs = await this.fixResults(programs);

        for (const program of programs) {
            try {
                const size = FileUtil.getFileSize(program.recPath!);
                await this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set filesize = ${ size } where id = ${ program.id }`);
            } catch (err) {
                this.log.system.warn(`${ program.recPath } update filesize error.`);
            }
        }
    }

    /**
     * 各種カウントを更新
     * @param recordedId: number
     * @param item: CntItem
     */
    public async updateCnt(recordedId: number, item: CntItem): Promise<void> {
        await this.operator.runQuery(`update ${ DBSchema.TableName.Recorded } set errorCnt = ${ item.error }, dropCnt = ${ item.drop }, scramblingCnt = ${ item.scrambling } where id = ${ recordedId }`);
    }

    /**
     * 番組情報 name, description, extended を更新
     * @param recordedId: recorded id
     * @param info: ProgramStrInfo
     */
    public async updateProgramStrInfo(recordedId: number, info: ProgramStrInfo): Promise<void> {
        const values: any[] = [];
        values.push(info.name);
        values.push(info.description);
        values.push(info.extended);

        await this.operator.runQuery(
            `update ${ DBSchema.TableName.Recorded } set `
            + `name = ${ this.operator.createValueStr(1, 1) }, `
            + `description = ${ this.operator.createValueStr(2, 2) }, `
            + `extended = ${ this.operator.createValueStr(3, 3) } `
            + `where id = ${ recordedId }`,
        values);
    }

    /**
     * 番組情報を更新
     * @param recordedId: number
     * @param info: ProgramInfo
     */
    public async updateProgramInfo(recordedId: number, info: ProgramInfo): Promise<void> {
        const values: any[] = [];
        values.push(info.startAt);
        values.push(info.endAt);
        values.push(info.duration);
        values.push(info.name);
        values.push(info.description);
        values.push(info.extended);
        values.push(info.genre1);
        values.push(info.genre2);
        values.push(info.genre3);
        values.push(info.genre4);
        values.push(info.genre5);
        values.push(info.genre6);
        values.push(info.videoType);
        values.push(info.videoResolution);
        values.push(info.videoStreamContent);
        values.push(info.videoComponentType);
        values.push(info.audioSamplingRate);
        values.push(info.audioComponentType);

        await this.operator.runQuery(
            `update ${ DBSchema.TableName.Recorded } set `
            + `startAt = ${ this.operator.createValueStr(1, 1) }, `
            + `endAt = ${ this.operator.createValueStr(2, 2) }, `
            + `duration = ${ this.operator.createValueStr(3, 3) }, `
            + `name = ${ this.operator.createValueStr(4, 4) }, `
            + `description = ${ this.operator.createValueStr(5, 5) }, `
            + `extended = ${ this.operator.createValueStr(6, 6) }, `
            + `genre1 = ${ this.operator.createValueStr(7, 7) }, `
            + `genre2 = ${ this.operator.createValueStr(8, 8) }, `
            + `genre3 = ${ this.operator.createValueStr(9, 9) }, `
            + `genre4 = ${ this.operator.createValueStr(10, 10) }, `
            + `genre5 = ${ this.operator.createValueStr(11, 11) }, `
            + `genre6 = ${ this.operator.createValueStr(12, 12) }, `
            + `videoType = ${ this.operator.createValueStr(13, 13) }, `
            + `videoResolution = ${ this.operator.createValueStr(14, 14) }, `
            + `videoStreamContent = ${ this.operator.createValueStr(15, 15) }, `
            + `videoComponentType = ${ this.operator.createValueStr(16, 16) }, `
            + `audioSamplingRate = ${ this.operator.createValueStr(17, 17) }, `
            + `audioComponentType = ${ this.operator.createValueStr(18, 18) } `
            + `where id = ${ recordedId }`,
        values);
    }

    /**
     * video 情報を更新
     * @param recordedId: number
     * @param info: VideoInfo
     */
    public async updateVideoInfo(recordedId: number, info: VideoInfo): Promise<void> {
        const values: any[] = [];
        values.push(info.videoType);
        values.push(info.videoResolution);
        values.push(info.videoStreamContent);
        values.push(info.videoComponentType);
        values.push(info.audioSamplingRate);
        values.push(info.audioComponentType);

        await this.operator.runQuery(
            `update ${ DBSchema.TableName.Recorded } set `
            + `videoType = ${ this.operator.createValueStr(1, 1) }, `
            + `videoResolution = ${ this.operator.createValueStr(2, 2) }, `
            + `videoStreamContent = ${ this.operator.createValueStr(3, 3) }, `
            + `videoComponentType = ${ this.operator.createValueStr(4, 4) }, `
            + `audioSamplingRate = ${ this.operator.createValueStr(5, 5) }, `
            + `audioComponentType = ${ this.operator.createValueStr(6, 6) } `
            + `where id = ${ recordedId }`,
        values);
    }

    /**
     * id 検索
     * @param id: recorded id
     * @return Promise<DBSchema.RecordedSchema | null>
     */
    public async findId(id: number): Promise<DBSchema.RecordedSchema | null> {
        const programs = await this.operator.runQuery(`select ${ this.getAllColumns() } from ${ DBSchema.TableName.Recorded } where id = ${ id }`);

        return this.operator.getFirst(await this.fixResults(<DBSchema.RecordedSchema[]> programs));
    }

    /**
     * @param programs: DBSchema.RecordedSchema[]
     * @param isAddBaseDir: boolean = false
     */
    protected fixResults(programs: DBSchema.RecordedSchema[], isAddBaseDir: boolean = true): DBSchema.RecordedSchema[] {
        const baseDir = Util.getRecordedPath();
        const tmpDir = Util.getRecordedTmpPath();
        const logFileDir = this.getDropCheckLogDir();
        const thumbnailDir = Util.getThumbnailPath();

        return programs.map((program) => {
            return this.fixResult(baseDir, tmpDir, logFileDir, thumbnailDir, program, isAddBaseDir);
        });
    }

    /**
     * @param baseDir: string
     * @param tmpDir: string || null
     * @param logFileDir: string
     * @param thumbnailDir: string
     * @param program: DBSchema.RecordedSchema
     * @param isAddBaseDir: boolean
     * @return DBSchema.RecordedSchema
     */
    protected fixResult(
        baseDir: string,
        tmpDir: string | null,
        logFileDir: string,
        thumbnailDir: string,
        program: DBSchema.RecordedSchema,
        isAddBaseDir: boolean,
    ): DBSchema.RecordedSchema {
        // フルパスへ書き換える
        if (isAddBaseDir) {
            if (program.recPath !== null) {
                program.recPath = this.fixRecPath(tmpDir !== null && program.isTmp ? tmpDir : baseDir, program.recPath);
            }

            if (program.logPath !== null) {
                program.logPath = this.fixRecPath(logFileDir, program.logPath);
            }

            if (program.thumbnailPath !== null) {
                program.thumbnailPath = path.join(thumbnailDir, program.thumbnailPath);
            }
        }

        return program;
    }

    /**
     * recPath 修正
     * @param baseDir: string
     * @param recPath: string
     * @return string
     */
    private fixRecPath(baseDir: string, recPath: string): string {
        return path.join(baseDir, recPath);
    }

    /**
     * id が一番古いレコードを返す
     * @return Promise<DBSchema.RecordedSchema | null>
     */
    public async findOld(): Promise<DBSchema.RecordedSchema | null> {
        const programs = await this.operator.runQuery(`select ${ this.getAllColumns() } from ${ DBSchema.TableName.Recorded } order by startAt asc, id asc ${ this.operator.createLimitStr(1) }`);

        return this.operator.getFirst(await this.fixResults(<DBSchema.RecordedSchema[]> programs));
    }

    /**
     * 指定した rule id を持つ id 一覧を返す
     * @param ruleId: rule id
     * @return Promise<{ id: number }[]>
     */
    public async findRuleIdList(ruleId: number): Promise<{ id: number }[]> {
        return <{ id: number }[]> await this.operator.runQuery(`select id from ${ DBSchema.TableName.Recorded } where ruleId = ${ ruleId }`);
    }

    /**
     * recPath が null で encoded も存在しない項目の id を列挙
     * @return Promise<number>
     */
    public async findCleanupList(): Promise<{ id: number }[]> {
        return <{ id: number }[]> await this.operator.runQuery(`select id from ${ DBSchema.TableName.Recorded } where recPath is null and id not in (select recordedId as id from ${ DBSchema.TableName.Encoded })`);
    }

    /**
     * 一時領域に保管されているレコードを返す
     * @return <DBSchema.RecordedSchema[]>
     */
    public async findTmp(): Promise<DBSchema.RecordedSchema[]> {
        const programs = await this.operator.runQuery(
            `select ${ this.getAllColumns() } from ${ DBSchema.TableName.Recorded } `
            + `where isTmp = ${ this.operator.convertBoolean(true) } `
            + 'and recPath is not null',
        );

        return this.fixResults(<DBSchema.RecordedSchema[]> programs);
    }

    /**
     * 全件取得
     * @param option: FindAllOption
     * @return Promise<DBSchema.RecordedSchema[]>
     */
    public async findAll(option: FindAllOption = {}): Promise<DBSchema.RecordedSchema[]> {
        let query = `select ${ this.getAllColumns() } from ${ DBSchema.TableName.Recorded } `;

        let values: any[] = [];
        if (typeof option.query !== 'undefined') {
            const findQuery = this.buildFindQuery(option.query || {});
            query += findQuery.query;
            values = findQuery.values;
        }

        const order = option.reverse ? 'asc' : 'desc';
        query += ` order by startAt ${ order }, id ${ order }`;

        if (typeof option.limit !== 'undefined') {
            query += ` ${ this.operator.createLimitStr(option.limit, option.offset || 0) }`;
        }

        const programs = await this.operator.runQuery(query, values);

        return this.fixResults(<DBSchema.RecordedSchema[]> programs, option.isAddBaseDir);
    }

    /**
     * FindQuery を組み立てる
     * @param FindQuery
     * @return { query: string; values: any[] }
     */
    private buildFindQuery(option: FindQuery): { query: string; values: any[] } {
        const query: string[] = [];
        const values: any[] = [];

        if (typeof option.ruleId !== 'undefined') {
            query.push(option.ruleId === null ? 'ruleId is null' : `ruleId = ${ option.ruleId }`);
        }

        if (typeof option.genre1 !== 'undefined') {
            query.push(`(genre1 = ${ option.genre1 } or genre3 = ${ option.genre1 } or genre5 = ${ option.genre1 })`);
        }

        if (typeof option.channelId !== 'undefined') {
            query.push(`channelId = ${ option.channelId }`);
        }

        if (typeof option.keyword !== 'undefined') {
            const keyword = StrUtil.toDBStr(option.keyword, this.config.getConfig().convertDBStr);
            // tslint:disable-next-line:no-irregular-whitespace
            keyword.trim().split(/ |　/).forEach((s) => {
                s = `%${ s }%`;
                const nameStr = `${ this.operator.createValueStr(values.length + 1, values.length + 1) }`;
                values.push(s);
                const descriptionStr = `${ this.operator.createValueStr(values.length + 1, values.length + 1) }`;
                values.push(s);
                query.push(`(name ${ this.createLikeStr() } ${ nameStr } or description ${ this.createLikeStr() } ${ descriptionStr })`);
            });
        }

        if (!!option.hasTs) {
            // TS を必ず含む
            query.push('recPath is not null');
        }

        if (typeof option.recording !== 'undefined') {
            query.push(`recording = ${ this.operator.convertBoolean(option.recording) }`);
        }

        let str = '';
        if (query.length > 0) {
            str += ' where';
            query.forEach((q, i) => {
                str += ` ${ q }`;
                if (i < query.length - 1) {
                    str += ' and';
                }
            });
        }

        return { query: str, values: values };
    }

    /**
     * create like str
     */
    public createLikeStr(): string {
        return 'like';
    }

    /**
     * 件数取得
     * @return Promise<number>
     */
    public getTotal(option: FindQuery = {}): Promise<number> {
        const findQuery = this.buildFindQuery(option);

        return this.operator.total(DBSchema.TableName.Recorded, findQuery.query, findQuery.values);
    }

    /**
     * rule id 集計
     * @return Promise<DBSchema.RuleTag[]>
     */
    public getRuleTag(): Promise<DBSchema.RuleTag[]> {
        return this.getTag('ruleId');
    }

    /**
     * channel id 集計
     * @return Promise<DBSchema.ChannelTag[]>
     */
    public getChannelTag(): Promise<DBSchema.ChannelTag[]> {
        return this.getTag('channelId');
    }

    /**
     * genre1 集計
     * @return Promise<DBSchema.GenreTag[]>
     */
    public getGenreTag(): Promise<DBSchema.GenreTag[]> {
        return this.getTag('genre1');
    }

    /**
     * 指定した項目の集計
     * @return Promise<T>
     */
    protected getTag<T>(item: string): Promise<T> {
        return this.operator.runQuery(`select count(*) as cnt, ${ item } from ${ DBSchema.TableName.Recorded } group by ${ item } order by ${ item } asc`);
    }

    /**
     * ファイルパス一覧を取得
     * @return Promise<RecordedFilesItem[]>
     */
    public async getAllFiles(): Promise<RecordedFilesItem[]> {
        const results = <{ id: number; recPath: string; logPath: string | null; isTmp: boolean }[]> await this.operator.runQuery(
            `select id, ${ this.getRecPathColumnStr() }, ${ this.getLogPathColumnStr() }, ${ this.getIsTmpColumnStr() } `
            + `from ${ DBSchema.TableName.Recorded } `
            + 'where recPath is not null or logPath is not null order by id',
        );

        let baseDir = Util.getRecordedPath();
        const tmpDir = Util.getRecordedTmpPath();
        const logDir = this.getDropCheckLogDir();

        return results.map((result) => {
            if (result.isTmp && tmpDir !== null) { baseDir = tmpDir; }
            const logPath = result.logPath;

            return {
                id: result.id,
                recPath: result.recPath === null ? null : this.fixRecPath(baseDir, result.recPath),
                logPath: logPath === null ? null : this.fixRecPath(logDir, logPath),
            };
        });
    }

    /**
     * get recPath column str
     * @return string
     */
    protected getRecPathColumnStr(): string {
        return 'recPath';
    }

    /**
     * get logPath column str
     * @return string
     */
    protected getLogPathColumnStr(): string {
        return 'logPath';
    }

    /**
     * get isTmp column str
     * @return string
     */
    protected getIsTmpColumnStr(): string {
        return 'isTmp';
    }

    /**
     * パス加工していない logPath を取得
     * @return Promise<RawLogPathItem[]>
     */
    public async getRawLogPaths(): Promise<RawLogPathItem[]> {
        return <RawLogPathItem[]> await this.operator.runQuery(`select id, ${ this.getLogPathColumnStr() } from ${ DBSchema.TableName.Recorded } where logPath is not null order by id`);
    }
}

export { FindQuery, RecordedDBInterface, RecordedDB };

