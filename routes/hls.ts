import Schema from '@openaddresses/batch-schema';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Static, Type } from '@sinclair/typebox';
import type { Config } from '../lib/config.js';
import { CloudTAKRemotePath } from '../lib/types.js';
import { generateSignedUrl, verifySignedUrl } from '../lib/signing.js';
import NodeCache from 'node-cache';
import { getCloudTAKPath } from '../lib/persist.js';
import Err from '@openaddresses/batch-error';

const cache = new NodeCache({ stdTTL: 600 });
const cachePath = new Map<string, Static<typeof CloudTAKRemotePath>>();

export default async function router(schema: Schema, config: Config) {
    await schema.get('/stream/:stream/:type.m3u8', {
        name: 'HLS Manifest',
        group: 'Stream',
        description: 'Returns Proxied HLS Manifest',
        query: Type.Object({
            sig: Type.Optional(Type.String()),
            exp: Type.Optional(Type.String()),
            hash: Type.Optional(Type.String())
        }),
        params: Type.Object({
            type: Type.Union([Type.Literal('index'), Type.Literal('segment')]),
            stream: Type.String()
        }),
    }, async (req, res) => {
        try {
            let path = cachePath.get(req.params.stream);

            if (!path) {
                path = await getCloudTAKPath(req.params.stream);
            }

            if (!path.proxy) {
                throw new Err(404, null, 'No Stream Supplied in Path');
            }

            if (req.query.hash) {
                if (!verifySignedUrl(config.MediaSecret, req.params.stream, req.query.sig!, req.query.exp!, req.params.type)) {
                    throw new Err(403, null, 'Invalid or expired signed URL');
                }

                const realUrl = cache.get<string>(`${req.params.stream}-${req.query.hash}`);
                if (!realUrl) {
                    return res.status(404).json({ error: 'Resource not found or expired' });
                }

                const resPlaylist = await fetch(realUrl);
                const m3u8Content = await resPlaylist.text();

                if (!m3u8Content.startsWith('#EXTM3U')) {
                    throw new Err(400, null, 'Invalid M3U8 Manifest');
                }

                const lines = m3u8Content.split('\n');

                const transformed = lines.map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) {
                        return line;
                    }

                    // Store the upstream URL in the cache
                    const absoluteUrl = new URL(trimmed, realUrl).href;

                    const resourceHash = randomUUID();

                    cache.set(`${req.params.stream}-${resourceHash}`, absoluteUrl);

                    const signedUrl = generateSignedUrl(config.MediaSecret, req.params.stream, resourceHash, 'ts');

                    return signedUrl;
                });

                const newM3U8 = transformed.join('\n');

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(newM3U8);
            } else {
                const url: string = path.proxy;

                const resPlaylist = await fetch(url);

                const m3u8Content = await resPlaylist.text();

                if (!m3u8Content.startsWith('#EXTM3U')) {
                    throw new Err(400, null, 'Invalid M3U8 Manifest');
                }

                const lines = m3u8Content.split('\n');

                const transformed = lines.map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) {
                        return line;
                    }

                    // Store the upstream URL in the cache
                    const absoluteUrl = new URL(trimmed, url).href;

                    const resourceHash = randomUUID();

                    cache.set(`${req.params.stream}-${resourceHash}`, absoluteUrl);

                    const signedUrl = generateSignedUrl(config.MediaSecret, req.params.stream, resourceHash, 'm3u8');

                    return signedUrl;
                });

                const newM3U8 = transformed.join('\n');

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(newM3U8);
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/stream/:stream/segment.ts', {
        name: 'HLS Manifest',
        group: 'Stream',
        description: 'Returns Proxied HLS Media',
        query: Type.Object({
            hash: Type.String(),
            sig: Type.String(),
            exp: Type.String()
        }),
        params: Type.Object({
            stream: Type.String()
        }),
    }, async (req, res) => {
        try {
            if (!verifySignedUrl(config.MediaSecret, req.params.stream, req.query.sig, req.query.exp, 'segment')) {
                throw new Err(403, null, 'Invalid or expired signed URL');
            }

            const realUrl = cache.get<string>(`${req.params.stream}-${req.query.hash}`);
            if (!realUrl) {
                return res.status(404).json({ error: 'Resource not found or expired' });
            }

            // Convert to fetch
            const segmentResp = await fetch(realUrl);
            if (!segmentResp.ok) {
                throw new Err(502, null, 'Failed to fetch media segment');
            }

            const arrayBuffer = await segmentResp.arrayBuffer();

            let contentType = segmentResp.headers.get('content-type');
            if (!contentType) {
                contentType = 'application/octet-stream';
            }

            res.setHeader('Content-Type', contentType);

            res.send(Buffer.from(arrayBuffer));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
