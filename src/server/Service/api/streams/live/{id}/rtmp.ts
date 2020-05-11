import { Operation } from 'express-openapi';
import { StreamsModelInterface } from '../../../../../Model/Api/StreamsModel';
import factory from '../../../../../Model/ModelFactory';
import * as api from '../../../../api';

export const get: Operation = async(req, res) => {
    const streams = <StreamsModelInterface> factory.get('StreamsModel');

    try {
        const info = await streams.getRTMPLive(req.params.id, req.query.mode);
        const streamNumber = info.streamNumber;
        const streamKey = info.streamKey;
        api.responseJSON(res, 200, { streamNumber: streamNumber, streamKey: streamKey });
    } catch (err) {
        api.responseServerError(res, err.message);
    }
};

get.apiDoc = {
    summary: 'RTMP ライブ配信',
    tags: ['streams'],
    description: 'RTMP ライブ配信をする',
    parameters: [
        {
            name: 'id',
            in: 'path',
            description: 'channel id',
            required: true,
            type: 'integer',
        },
        {
            name: 'mode',
            in: 'query',
            description: 'encode mode',
            required: true,
            type: 'integer',
        },
    ],
    responses: {
        200: {
            description: 'RTMP 配信開始',
            schema: {
                $ref: '#/definitions/RTMPStream',
            },
        },
        default: {
            description: '予期しないエラー',
            schema: {
                $ref: '#/definitions/Error',
            },
        },
    },
};
