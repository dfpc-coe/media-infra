import { Type } from '@sinclair/typebox';
import Auth, { AuthResourceAccess, managementToken } from '../lib/auth.js';
import type { Config } from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import { isHLSPath } from '../lib/payload.js'
import { getCloudTAKPath } from '../lib/persist.js';
import proxy from '../lib/proxy.js';
import Err from '@openaddresses/batch-error';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/path', {
        name: 'Paths List',
        group: 'MediaMTX Paths',
        description: 'Returns Path List',
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

            await proxy({
                url: 'http://localhost:4000/v3/paths/list',
                headers: {
                    'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                },
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/path/:path', {
        name: 'Get Path',
        group: 'MediaMTX Paths',
        description: 'Return a single path',
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

            const lease = await getCloudTAKPath(config, req.params.path);

            if (lease.proxy && isHLSPath(lease.proxy)) {
                return res.json({
                    name: req.params.path,
                    confName: req.params.path,
                    source: {
                        id: req.params.path,
                        type: 'hls'
                    },
                    ready: true,
                    readyTime: new Date().toISOString(),
                    tracks: [],
                    bytesReceived: 0,
                    bytesSent: 0,
                    readers: []
                })
            } else {
                await proxy({
                    url: `http://localhost:4000/v3/paths/get/${req.params.path}`,
                    headers: {
                        'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                    },
                }, res);
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/path/:path', {
        name: 'Paths List',
        group: 'MediaMTX Paths',
        description: 'Deletes a Path',
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

            await proxy({
                url: `http://localhost:4000/v3/paths/delete/${req.params.path}`,
                method: 'DELETE',
                headers: {
                    'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                },
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/path', {
        name: 'Server Config',
        group: 'MediaMTX Paths',
        description: 'Create Path Config',
        body: Type.Object({
            name: Type.String(),
            source: Type.Optional(Type.String()),
            record: Type.Boolean({
                default: false
            })
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

            if (isHLSPath(req.body.source)) {
                return res.json({
                    name: req.body.name,
                    source: req.body.source,
                    sourceOnDemand: true,
                    record: false
                })
            } else {
                await proxy({
                    url: `http://localhost:4000/v3/config/paths/add/${req.body.name}`,
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                        'Content-Type': 'application/json'
                    },
                    body: {
                        name: req.body.name,
                        source: req.body.source ? req.body.source : undefined,
                        sourceOnDemand: req.body.source ? true : undefined,
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
        group: 'MediaMTX Paths',
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
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

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
                    headers: {
                        'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                        'Content-Type': 'application/json'
                    },
                    body: {
                        name: req.body.name,
                        source: req.body.source ? req.body.source : undefined,
                        sourceOnDemand: req.body.source ? true : undefined,
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
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

            await proxy({
                url: 'http://localhost:4000/v3/config/global/get',
                headers: {
                    'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                },
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/v3/recordings/get/:path', {
        name: 'Get Recordings',
        group: 'MediaMTX Recordings',
        description: 'Returns Recordings for a Path',
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.MEDIA }]
            });

            await proxy({
                url: `http://localhost:4000/v3/recordings/get/${req.params.path}`,
                headers: {
                    'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
                },
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
