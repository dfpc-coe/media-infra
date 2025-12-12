import { URL } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateSignedUrl } from './signing.js';
import type { Config } from './config.js';
import NodeCache from 'node-cache';
import Err from '@openaddresses/batch-error';

export class Manifest {
    static rewrite(
        content: string,
        baseUrl: string,
        stream: string,
        config: Config,
        cache: NodeCache
    ): string {
        if (!content.startsWith('#EXTM3U')) {
            console.error('Invalid M3U8 Manifest:', content);
            throw new Err(400, null, 'Invalid M3U8 Manifest');
        }

        const lines = content.split('\n');

        const transformed = lines.map((line) => {
            const trimmed = line.trim();

            if (!trimmed) return line;

            // Handle EXT-X-MAP
            if (trimmed.startsWith('#EXT-X-MAP:URI')) {
                const absoluteUrl = new URL(
                    trimmed
                        .replace(/#EXT-X-MAP:URI=/, '')
                        .replace(/^"/, '')
                        .replace(/"$/, ''),
                    baseUrl).href;

                const resourceHash = randomUUID();
                cache.set(`${stream}-${resourceHash}`, absoluteUrl);
                const signedUrl = generateSignedUrl(config.SigningSecret, stream, resourceHash, 'mp4');
                return `#EXT-X-MAP:URI="${signedUrl}"`;
            }

            // Handle EXT-X-MEDIA
            if (trimmed.startsWith('#EXT-X-MEDIA:TYPE')) {
                if (trimmed.includes('URI=')) {
                    const parts = trimmed.split('URI=');
                    const uriPart = parts[1];
                    const uri = uriPart.replace(/^"/, '').replace(/"$/, '');
                    const absoluteUrl = new URL(uri, baseUrl).href;

                    const resourceHash = randomUUID();
                    cache.set(`${stream}-${resourceHash}`, absoluteUrl);
                    const signedUrl = generateSignedUrl(config.SigningSecret, stream, resourceHash, 'm3u8');

                    return `${parts[0]}URI="${signedUrl}"`;
                }
                return line;
            }

            // Pass through other tags
            if (trimmed.startsWith('#')) {
                return line;
            }

            // Handle URLs
            const absoluteUrl = new URL(trimmed, baseUrl).href;
            const resourceHash = randomUUID();
            cache.set(`${stream}-${resourceHash}`, absoluteUrl);

            const ext = path.parse(absoluteUrl.split('?')[0]).ext;

            if (ext && ext.length > 1) {
                return generateSignedUrl(config.SigningSecret, stream, resourceHash, ext.slice(1));
            } else {
                throw new Err(400, null, `Unsupported media segment type: ${ext}`);
            }
        });

        return transformed.join('\n');
    }
}
