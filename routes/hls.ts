import Schema from '@openaddresses/batch-schema';
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
    await schema.get('/stream/:stream/index.m3u8', {
        name: 'HLS Manifest',
        group: 'Stream',
        description: 'Returns Proxied HLS Manifest',
        params: Type.Object({
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

                const absoluteUrl = new URL(trimmed, url).href;

                cache.set(req.params.stream, absoluteUrl);

                const signedUrl = generateSignedUrl(config.MediaSecret, req.params.stream, 'segment');

                return signedUrl;
            });

            const newM3U8 = transformed.join('\n');

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(newM3U8);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/stream/:stream/segment', {
        name: 'HLS Manifest',
        group: 'Stream',
        description: 'Returns Proxied HLS Manifest',
        query: Type.Object({
            sig: Type.String(),
            exp: Type.String()
        }),
        params: Type.Object({
            stream: Type.String()
        }),
    }, async (req, res) => {
        try {
            if (!verifySignedUrl(config.MediaSecret, req.query.sig, req.query.exp, 'segment')) {
                throw new Err(403, null, 'Invalid or expired signed URL');
            }

            const realUrl = cache.get<string>(req.params.stream);
            if (!realUrl) {
                return res.status(404).json({ error: 'Resource not found or expired' });
            }

            // Convert to fetch
            const segmentResp = await fetch(realUrl);
            if (!segmentResp.ok) {
                throw new Err(502, null, 'Failed to fetch media segment');
            }

            const arrayBuffer = await segmentResp.arrayBuffer();

            const segmentResp = await axios.get(realUrl, { responseType: 'arraybuffer' });

            let contentType = segmentResp.headers['content-type'];
            if (!contentType) {
                contentType = 'application/octet-stream';
            }

            res.setHeader('Content-Type', contentType);

            res.send(arrayBuffer);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
