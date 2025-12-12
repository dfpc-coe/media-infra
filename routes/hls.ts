import Schema from '@openaddresses/batch-schema';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { Config } from '../lib/config.js';
import { generateSignedUrl, verifySignedUrl } from '../lib/signing.js';
import NodeCache from 'node-cache';
import { getCloudTAKPath } from '../lib/persist.js';
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

                if (!m3u8Content.startsWith('#EXTM3U')) {
                    console.error('Invalid M3U8 (Hash): ', m3u8Content);
                    throw new Err(400, null, 'Invalid M3U8 Manifest (Hash)');
                }

                const lines = m3u8Content.split('\n');

                const transformed = lines.map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed || (trimmed.startsWith('#'))) {
                        return line;
                    }

                    const absoluteUrl = new URL(trimmed, realUrl).href;
                    const resourceHash = randomUUID();
                    cache.set(`${req.params.stream}-${resourceHash}`, absoluteUrl);

                    if (path.parse(absoluteUrl.split('?')[0]).ext === '.ts') {
                        const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'ts');
                        return signedUrl;
                    } else if (path.parse(absoluteUrl.split('?')[0]).ext === '.m4s') {
                        const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'm4s');
                        return signedUrl;
                    }
                });

                const newM3U8 = transformed.join('\n');

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

                if (!m3u8Content.startsWith('#EXTM3U')) {
                    console.error('Invalid M3U8: ', m3u8Content);
                    throw new Err(400, null, 'Invalid M3U8 Manifest');
                }

                const lines = m3u8Content.split('\n');

                const transformed = lines.map((line) => {
                    const trimmed = line.trim();

                    if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#EXT-X-MAP:URI'))) {
                        return line;
                    }

                    if (trimmed.startsWith('#EXT-X-MAP:URI')) {
                        const absoluteUrl = new URL(
                            trimmed
                                .replace(/#EXT-X-MAP:URI=/, '')
                                .replace(/^"/, '')
                                .replace(/"$/, ''),
                            url).href;

                        const resourceHash = randomUUID();
                        cache.set(`${req.params.stream}-${resourceHash}`, absoluteUrl);
                        const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'mp4');
                        return `#EXT-X-MAP:URI="${signedUrl}"`;
                    } else if (trimmed.startsWith('#EXT-X-MEDIA:TYPE')) {
                        // Looks like: #EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="sp",NAME="Espanol",AUTOSELECT=YES,DEFAULT=NO,URI="sp/prog_index.m3u8"
                        // URL is omitted if no audio track IE Subtitles
                        if (trimmed.includes('URI=')) {
                            const parts = trimmed.split('URI=');
                            const uriPart = parts[1];
                            const uri = uriPart.replace(/^"/, '').replace(/"$/, '');
                            const absoluteUrl = new URL(uri, url).href;

                            const resourceHash = randomUUID();
                            cache.set(`${req.params.stream}-${resourceHash}`, absoluteUrl);
                            const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'm3u8');

                            return `${parts[0]}URI="${signedUrl}"`;
                        }
                    } else {
                        // Store the upstream URL in the cache
                        const absoluteUrl = new URL(trimmed, url).href;

                        const resourceHash = randomUUID();

                        cache.set(`${req.params.stream}-${resourceHash}`, absoluteUrl);

                        if (path.parse(absoluteUrl.split('?')[0]).ext === '.ts') {
                            const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'ts');
                            return signedUrl;
                        } else if (path.parse(absoluteUrl.split('?')[0]).ext === '.m4s') {
                            const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'm4s');
                            return signedUrl;
                        } else if (path.parse(absoluteUrl.split('?')[0]).ext === '.m3u8') {
                            const signedUrl = generateSignedUrl(config.SigningSecret, req.params.stream, resourceHash, 'm3u8');
                            return signedUrl;
                        } else {
                            throw new Err(400, null, 'Unsupported media segment type');
                        }
                    }
                });

                const newM3U8 = transformed.join('\n');

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
