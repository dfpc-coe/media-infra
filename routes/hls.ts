import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import type { Config } from '../lib/config.js';
import { verifySignedUrl } from '../lib/signing.js';
import NodeCache from 'node-cache';
import { getCloudTAKPath } from '../lib/persist.js';
import { Manifest } from '../lib/manifest.js';
import Err from '@openaddresses/batch-error';

const HEADER_ALLOWLIST = ['authorization', 'user-agent', 'accept', 'accept-language', 'accept-encoding'];

const cache = new NodeCache({ stdTTL: 600 });

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
            type: Type.String(),
            stream: Type.String()
        }),
    }, async (req, res) => {
        try {
            if (req.query.hash) {
                if (!verifySignedUrl(config.SigningSecret, req.params.stream, req.query.sig!, req.query.exp!, 'segment')) {
                    throw new Err(403, null, 'Invalid or expired signed URL');
                }

                const realUrl = cache.get<string>(`${req.params.stream}-${req.query.hash}`);
                if (!realUrl) {
                    return res.status(404).json({ error: 'Resource not found or expired' });
                }

                const headers: Record<string, string> = {};
                for (const h of HEADER_ALLOWLIST) {
                    if (req.headers[h]) headers[h] = String(req.headers[h]);
                }

                const resPlaylist = await fetch(realUrl, { headers });

                const m3u8Content = await resPlaylist.text();

                const newM3U8 = Manifest.rewrite(m3u8Content, realUrl, req.params.stream, config, cache);

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(newM3U8);
            } else {
                const cloudtakPath = await getCloudTAKPath(config, req.params.stream);

                let url: URL;
                if (!cloudtakPath.proxy) {
                    url = new URL(`${req.params.stream}/index.m3u8`, config.CLOUDTAK_Config_media_url);
                    url.port = '8888';
                } else {
                    url = new URL(cloudtakPath.proxy);
                }

                const headers: Record<string, string> = {};
                for (const h of HEADER_ALLOWLIST) {
                    if (req.headers[h]) headers[h] = String(req.headers[h]);
                }

                const resPlaylist = await fetch(url, {
                    headers
                });

                const m3u8Content = await resPlaylist.text();

                const newM3U8 = Manifest.rewrite(m3u8Content, url.href, req.params.stream, config, cache);

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(newM3U8);
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/stream/:stream/segment.:format', {
        name: 'HLS Manifest',
        group: 'Stream',
        description: 'Returns Proxied HLS Media',
        query: Type.Object({
            hash: Type.String(),
            sig: Type.String(),
            exp: Type.String()
        }),
        params: Type.Object({
            stream: Type.String(),
            format: Type.String()
        }),
    }, async (req, res) => {
        try {
            if (!verifySignedUrl(config.SigningSecret, req.params.stream, req.query.sig, req.query.exp, 'segment')) {
                throw new Err(403, null, 'Invalid or expired signed URL');
            }

            const realUrl = cache.get<string>(`${req.params.stream}-${req.query.hash}`);
            if (!realUrl) {
                return res.status(404).json({ error: 'Resource not found or expired' });
            }

            // Convert to fetch
            const headers: Record<string, string> = {};
            for (const h of HEADER_ALLOWLIST) {
                if (req.headers[h]) headers[h] = String(req.headers[h]);
            }

            const segmentResp = await fetch(realUrl, { headers });

            if (!segmentResp.ok) {
                throw new Err(502, null, `Failed to fetch media segment: ${segmentResp.status}: ${segmentResp.statusText}`);
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
