import Err from '@openaddresses/batch-error';
import type { Response } from 'express';

export default async function proxy(
    opts: {
        url: string,
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
        headers?: Record<string, string>
        body?: string | Buffer
    },
    res: Response,
): Promise<void> {
    try {
        const stream = await undici.pipeline(url, {
            method: opts.method ?? 'GET',
            headers: opts.headers || {}
        }, ({ statusCode, headers, body }) => {
            if (headers) {
                for (const key in headers) {
                    if (
                        ![
                            'content-type',
                            'content-length',
                            'cache-control',
                            'content-encoding',
                            'last-modified',
                        ].includes(key.toLowerCase())
                       ) {
                           delete headers[key];
                       }
                }
            }

            res.writeHead(statusCode, headers);

            return body;
        });

        await new Promise((resolve, reject) => {
            stream
            .on('data', (buf) => {
                res.write(buf)
            })
            .on('error', (err) => {
                return reject(err);
            })
            .on('end', () => {
                res.end()
                // @ts-expect-error Type empty resolve
                return resolve();
            })
            .on('close', () => {
                res.end()
                // @ts-expect-error Type empty resolve
                return resolve();
            })
            .end()
        });
    } catch (err) {
         Err.respond(err, res);
    }
}
