import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import type { Config } from '../lib/config.js';
import { verifySignedUrl } from '../lib/signing.js';
import NodeCache from 'node-cache';
import { getCloudTAKPath } from '../lib/persist.js';
import { Manifest } from '../lib/manifest.js';
import Err from '@openaddresses/batch-error';

const REQUEST_HEADER_ALLOWLIST = ['authorization', 'user-agent', 'accept', 'accept-language', 'accept-encoding', 'range', 'if-range', 'if-none-match', 'if-modified-since'];
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'set-cookie'
]);

const cache = new NodeCache({ stdTTL: 600 });

export function getUpstreamRequestMethod(method: string): 'GET' | 'HEAD' {
    return method === 'HEAD' ? 'HEAD' : 'GET';
}

type AbortAwareEmitter = {
    aborted?: boolean;
    destroyed?: boolean;
    once(event: 'aborted' | 'close', listener: () => void): void;
    off(event: 'aborted' | 'close', listener: () => void): void;
};

export function getProxyRequestHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
    const forwardedHeaders: Record<string, string> = {};

    for (const header of REQUEST_HEADER_ALLOWLIST) {
        const value = headers[header];
        if (typeof value === 'string') {
            forwardedHeaders[header] = value;
        } else if (Array.isArray(value) && value.length) {
            forwardedHeaders[header] = value.join(', ');
        }
    }

    return forwardedHeaders;
}

export function getProxyResponseHeaders(headers: Headers): Array<[string, string]> {
    const forwardedHeaders: Array<[string, string]> = [];

    for (const [header, value] of headers.entries()) {
        if (HOP_BY_HOP_RESPONSE_HEADERS.has(header.toLowerCase())) continue;
        forwardedHeaders.push([header, value]);
    }

    return forwardedHeaders;
}

export function bindClientDisconnectAbort(req: AbortAwareEmitter, res: AbortAwareEmitter): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();

    const abortUpstream = () => {
        if (!controller.signal.aborted) controller.abort();
    };

    const cleanup = () => {
        req.off('aborted', abortUpstream);
        req.off('close', abortUpstream);
        res.off('close', abortUpstream);
    };

    req.once('aborted', abortUpstream);
    req.once('close', abortUpstream);
    res.once('close', abortUpstream);
    controller.signal.addEventListener('abort', cleanup, { once: true });

    if (req.aborted || req.destroyed || res.destroyed) {
        abortUpstream();
    }

    return {
        signal: controller.signal,
        cleanup
    };
}

function shouldSendUpstreamBody(status: number, body: Response['body'] | null): body is Response['body'] {
    return body !== null && ![204, 205, 304].includes(status);
}

export function shouldSendProxyBody(
    method: string,
    status: number,
    body: Response['body'] | null
): body is Response['body'] {
    return method !== 'HEAD' && shouldSendUpstreamBody(status, body);
}

export default async function router(schema: Schema, config: Config) {
    await schema.get('/stream/:stream/:type.m3u8', {
        name: 'HLS Manifest',
        group: 'Stream',
        description: 'Returns Proxied HLS Manifest',
        query: Type.Object({
            token: Type.Optional(Type.String())
        }),
        params: Type.Object({
            type: Type.Union([Type.Literal('index'), Type.Literal('segment')]),
            stream: Type.String()
        }),
    }, async (req, res) => {
        try {
            if (req.query.token) {
                const decoded = verifySignedUrl(config.SigningSecret, req.params.stream, req.query.token);

                if (!decoded || typeof decoded === 'boolean') {
                    throw new Err(403, null, 'Invalid or expired signed URL');
                }

                const realUrl = cache.get<string>(`${req.params.stream}-${decoded.hash}`);
                if (!realUrl) {
                    return res.status(404).json({ error: 'Resource not found or expired' });
                }

                const headers = getProxyRequestHeaders(req.headers);
                const method = getUpstreamRequestMethod(req.method);

                const resPlaylist = await fetch(realUrl, {
                    method,
                    headers
                });

                if (!resPlaylist.ok) {
                    if (resPlaylist.status === 404) {
                        throw new Err(404, null, `Stream not found: ${resPlaylist.status}: ${resPlaylist.statusText}`);
                    } else {
                        throw new Err(500, null, `Failed to fetch playlist: ${resPlaylist.status}: ${resPlaylist.statusText}`);
                    }
                }

                res.status(resPlaylist.status);

                if (req.method === 'HEAD') {
                    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                    res.end();
                    return;
                }

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

                const headers = getProxyRequestHeaders(req.headers);
                const method = getUpstreamRequestMethod(req.method);

                const resPlaylist = await fetch(url, {
                    method,
                    headers
                });

                if (!resPlaylist.ok) {
                    if (resPlaylist.status === 404) {
                        throw new Err(404, null, `Stream not found: ${resPlaylist.status}: ${resPlaylist.statusText}`);
                    } else {
                        throw new Err(500, null, `Failed to fetch playlist: ${resPlaylist.status}: ${resPlaylist.statusText}`);
                    }
                }

                res.status(resPlaylist.status);

                if (req.method === 'HEAD') {
                    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                    res.end();
                    return;
                }

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
            token: Type.String()
        }),
        params: Type.Object({
            stream: Type.String(),
            format: Type.String()
        }),
    }, async (req, res) => {
        const { signal, cleanup } = bindClientDisconnectAbort(req, res);

        try {
            const decoded = verifySignedUrl(config.SigningSecret, req.params.stream, req.query.token);

            if (!decoded || typeof decoded === 'boolean') {
                throw new Err(403, null, 'Invalid or expired signed URL');
            }

            const realUrl = cache.get<string>(`${req.params.stream}-${decoded.hash}`);
            if (!realUrl) {
                return res.status(404).json({ error: 'Resource not found or expired' });
            }

            // Convert to fetch
            const headers = getProxyRequestHeaders(req.headers);
            const method = getUpstreamRequestMethod(req.method);

            const segmentResp = await fetch(realUrl, { method, headers, signal });

            res.status(segmentResp.status);

            for (const [header, value] of getProxyResponseHeaders(segmentResp.headers)) {
                res.setHeader(header, value);
            }

            if (!segmentResp.headers.has('content-type')) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }

            if (!shouldSendProxyBody(req.method, segmentResp.status, segmentResp.body)) {
                res.end();
                return;
            }

            await pipeline(
                Readable.fromWeb(segmentResp.body as ReadableStream),
                res
            );
        } catch (err) {
            if (signal.aborted) return;

            if (res.headersSent) {
                res.destroy(err instanceof Error ? err : new Error('Failed to stream media segment'));
            } else {
                Err.respond(err, res);
            }
        } finally {
            cleanup();
        }
    });
}
