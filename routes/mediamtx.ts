import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import proxy from '../lib/proxy.js';
import Err from '@openaddresses/batch-error';

export default async function router(schema: Schema) {
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

    await schema.post('/v3/config/paths/add/:path', {
        name: 'Server Config',
        group: 'MediaMTX',
        description: 'Create Path Config',
        body: Type.Any(),
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            //TODO REMOVE
            return res.json({});
            await proxy({
                url: `http://localhost:4000/v3/config/paths/add/${req.params.path}`,
                method: 'POST',
                headers: req.headers,
                body: req.body
            }, res);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/v3/config/paths/patch/:path', {
        name: 'Server Config',
        group: 'MediaMTX',
        description: 'Patch Path Config',
        body: Type.Any(),
        params: Type.Object({
            path: Type.String()
        }),
    }, async (req, res) => {
        try {
            await proxy({
                url: `http://localhost:4000/v3/config/paths/patch/${req.params.path}`,
                method: 'PATCH',
                headers: req.headers,
                body: req.body
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
