import { Static } from '@sinclair/typebox';
import { CloudTAKRemotePath, Path } from './types.js';

export function isHLSPath(source: string | null | undefined): boolean {
    if (!source) return false;
    return source.startsWith('http');
}

export function createPayload(path: Static<typeof CloudTAKRemotePath>): Static<typeof Path> {
    if (path.proxy) {
        return {
            name: path.path,
            record: path.recording,
            source: path.proxy,
            sourceOnDemand: true
        };
    } else {
        return {
            name: path.path,
            record: path.recording,
        };
    }
}