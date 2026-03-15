import { URL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { generateSignedUrl } from './signing.js';
import type { Config } from './config.js';
import NodeCache from 'node-cache';
import Err from '@openaddresses/batch-error';

export class Manifest {
    static readonly URI_TAGS = ['#EXT-X-MAP', '#EXT-X-MEDIA', '#EXT-X-PART', '#EXT-X-PRELOAD-HINT'];

    static resourceHash(absoluteUrl: string): string {
        return createHash('sha256').update(absoluteUrl).digest('hex');
    }

    static rewriteSignedUrl(
        uri: string,
        baseUrl: string,
        stream: string,
        config: Config,
        cache: NodeCache
    ): string {
        const absoluteUrl = new URL(uri, baseUrl).href;
        const resourceHash = Manifest.resourceHash(absoluteUrl);
        cache.set(`${stream}-${resourceHash}`, absoluteUrl);

        const ext = path.parse(new URL(absoluteUrl).pathname).ext;

        if (ext && ext.length > 1) {
            return generateSignedUrl(config.SigningSecret, stream, resourceHash, ext.slice(1));
        } else {
            throw new Err(400, null, `Unsupported media segment type: ${ext}`);
        }
    }

    static rewriteUriTag(
        line: string,
        baseUrl: string,
        stream: string,
        config: Config,
        cache: NodeCache
    ): string | null {
        const isUriTag = Manifest.URI_TAGS.some((tag) => line.startsWith(`${tag}:`));
        if (!isUriTag || !line.includes('URI="')) return null;

        return line.replace(/URI="([^"]+)"/, (_match, uri: string) => {
            const signedUrl = Manifest.rewriteSignedUrl(uri, baseUrl, stream, config, cache);
            return `URI="${signedUrl}"`;
        });
    }

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

            const rewrittenUriTag = Manifest.rewriteUriTag(trimmed, baseUrl, stream, config, cache);
            if (rewrittenUriTag) {
                return rewrittenUriTag;
            }

            // Pass through other tags
            if (trimmed.startsWith('#')) {
                return line;
            }

            // Handle URLs
            return Manifest.rewriteSignedUrl(trimmed, baseUrl, stream, config, cache);
        });

        return transformed.join('\n');
    }
}
