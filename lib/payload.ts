import type { Static } from '@sinclair/typebox';
import type { Config } from './config.js';
import { CloudTAKRemotePath, Path } from './types.js';

export function isHLSPath(source: string | null | undefined): boolean {
    if (!source) return false;
    return source.startsWith('http');
}

/**
 * A proxy source's hostname commonly matches this media server's own advertised
 * CLOUDTAK_Config_media_url - that's correct when an off-host EUD/plugin is
 * publishing to it, but when this same media server pulls that source to relay
 * it, resolving its own public hostname back to itself is a hairpin-NAT path
 * many networks/NAT setups can't route. Rewriting to an internal alias that
 * resolves directly avoids that, but which alias (if any) is valid is
 * deployment-specific, so this only rewrites when an operator has opted in via
 * CLOUDTAK_Config_media_ingest_internal_host; otherwise it's a no-op.
 */
export function ingestSource(source: string | null | undefined, config: Config): string | null | undefined {
    if (!source || !config.CLOUDTAK_Config_media_ingest_internal_host) return source;

    try {
        const ownHostname = new URL(config.CLOUDTAK_Config_media_url).hostname;
        const url = new URL(source);

        if (['rtsp:', 'rtsps:'].includes(url.protocol) && url.hostname === ownHostname) {
            url.hostname = config.CLOUDTAK_Config_media_ingest_internal_host;
        }

        return url.toString();
    } catch {
        return source;
    }
}

export function createPayload(path: Static<typeof CloudTAKRemotePath>, config: Config): Static<typeof Path> {
    if (path.proxy) {
        return {
            name: path.path,
            record: path.recording,
            source: ingestSource(path.proxy, config) ?? undefined,
            sourceOnDemand: true
        };
    } else {
        return {
            name: path.path,
            record: path.recording,
        };
    }
}
