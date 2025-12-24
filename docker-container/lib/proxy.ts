import Err from '@openaddresses/batch-error';
import { fetch, Headers } from 'undici';
import type { Response } from 'express';

const whitelist = new Set([
    'content-type',
    'content-length',
    'cache-control',
    'content-encoding',
    'last-modified'
]);

export default async function proxy(
    opts: {
        url: string,
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        headers?: Record<string, string | string[] | undefined>,
        body?: string | Buffer | object
    },
    res: Response
): Promise<void> {
    try {
        if (!opts.headers) opts.headers = {};

        if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof Buffer)) {
            opts.body = JSON.stringify(opts.body);
            if (!opts.headers['content-type']) opts.headers['content-type'] = 'application/json';
        }

        delete opts.headers['content-length'];

        const forbidden = new Set([
            'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'accept-encoding', 'content-length'
        ]);

        const outHeaders = new Headers();
        for (const [key, val] of Object.entries(opts.headers)) {
            const k = key.toLowerCase();
            if (forbidden.has(k)) continue;
            if (val === undefined) continue;
            if (Array.isArray(val)) {
                for (const v of val) outHeaders.append(key, v);
            } else {
                outHeaders.set(key, val);
            }
        }

        const resp = await fetch(opts.url, {
            method: opts.method ?? 'GET',
            headers: outHeaders,
            body: opts.body as any
        });

        const filteredHeaders: Record<string, string> = {};
        for (const [key, value] of resp.headers) {
            if (whitelist.has(key.toLowerCase())) filteredHeaders[key] = value;
        }

        res.writeHead(resp.status, filteredHeaders);

        if (resp.body) {
            const reader: any = (resp.body as any).getReader ? (resp.body as any).getReader() : null;
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(Buffer.from(value));
                }
            } else {
                const ab = await resp.arrayBuffer();
                res.write(Buffer.from(ab));
            }
        }

        res.end();
    } catch (err) {
        Err.respond(err, res);
    }
}