import { Static } from '@sinclair/typebox';
import { CloudTAKRemotePath, Path } from './types.js';

export function isHLSPath(path: Static<typeof CloudTAKRemotePath>): boolean {
    if (!path.proxy) return false;
    return path.proxy.startsWith('http');
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
            runOnInit: ''
        };
    }
}
