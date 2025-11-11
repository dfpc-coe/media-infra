import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import { isHLSPath } from '../lib/payload.js'
import proxy from '../lib/proxy.js';
import Err from '@openaddresses/batch-error';

export default async function router(schema: Schema) {
    await schema.post('/path', {
        name: 'Server Config',
        group: 'MediaMTX',
        description: 'Create Path Config',
        body: Type.Object({
            name: Type.String(),
            source: Type.Optional(Type.String()),
            record: Type.Boolean({
                default: false
            })
        }),
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            if (isHLSPath(req.body.source)) {
                return res.json({
                    name: req.body.name,
                    source: req.body.source,
                    sourceOnDemand: true,
                    record: false
                })
            } else {
                await proxy({
                    url: `http://localhost:4000/v3/config/paths/add/${req.params.path}`,
                    method: 'POST',
                    headers: req.headers,
                    body: {
                        name: req.body.name,
                        source: req.body.source,
                        sourceOnDemand: true,
                        record: req.body.record,
                        recordPath: '/opt/mediamtx/recordings/%path/%Y-%m-%d_%H-%M-%S-%f',
                        recordFormat: 'fmp4',
                        recordPartDuration: '1s',
                        recordSegmentDuration: '1h',
                        recordDeleteAfter: '7d'
                    }
                }, res);
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/path/:path', {
        name: 'Server Config',
        group: 'MediaMTX',
        description: 'Patch Path Config',
        params: Type.Object({
            path: Type.String()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            source: Type.Optional(Type.String()),
            record: Type.Optional(Type.Boolean())
        }),
    }, async (req, res) => {
        try {
            if (isHLSPath(req.body.source)) {
                return res.json({
                    name: req.body.name,
                    source: req.body.source,
                    sourceOnDemand: true,
                    record: false
                })
            } else {
                await proxy({
                    url: `http://localhost:4000/v3/config/paths/patch/${req.params.path}`,
                    method: 'PATCH',
                    headers: req.headers,
                    body: {
                        name: req.body.name,
                        source: req.body.source,
                        sourceOnDemand: true,
                        record: req.body.record,
                        recordPath: '/opt/mediamtx/recordings/%path/%Y-%m-%d_%H-%M-%S-%f',
                        recordFormat: 'fmp4',
                        recordPartDuration: '1s',
                        recordSegmentDuration: '1h',
                        recordDeleteAfter: '7d'
                    }
                }, res);
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });


    await schema.get('/v3/config/global/get', {
        name: 'Global Config',
        group: 'MediaMTX',
        description: 'Returns Global Config',
    }, async (req, res) => {
        try {
            await proxy({
                url: 'http://localhost:4000/v3/config/global/get',
                headers: req.headers
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
    await schema.get('/v3/paths/list', {
        name: 'Paths List',
        group: 'MediaMTX',
        description: 'Returns Path List',
    }, async (req, res) => {
        try {
            await proxy({
                url: 'http://localhost:4000/v3/paths/list',
                headers: req.headers
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/v3/paths/get/:path', {
        name: 'Paths List',
        group: 'MediaMTX',
        description: 'Returns Path List',
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await proxy({
                url: `http://localhost:4000/v3/paths/get/${req.params.path}`,
                headers: req.headers
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/v3/paths/get/:path', {
        name: 'Paths List',
        group: 'MediaMTX',
        description: 'Deletes a Path',
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await proxy({
                url: `http://localhost:4000/v3/paths/delete/${req.params.path}`,
                method: 'DELETE',
                headers: req.headers
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/v3/recordings/get/:path', {
        name: 'Get Recordings',
        group: 'MediaMTX',
        description: 'Returns Recordings for a Path',
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await proxy({
                url: `http://localhost:4000/v3/recordings/get/${req.params.path}`,
                headers: req.headers
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
