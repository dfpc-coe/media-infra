import { Static } from '@sinclair/typebox';
import { CloudTAKRemotePath, Path } from './types.js';

export function createPayload(path: Static<typeof CloudTAKRemotePath>): Static<typeof Path> {
    if (path.proxy) {
        return {
            name: path.path,
            record: path.recording,
            runOnInit: `ffmpeg -re -i '${path.proxy}' -vcodec libx264 -profile:v baseline -g 60 -acodec aac -f mpegts srt://127.0.0.1:8890?streamid=publish:${path.path}`
        };
    } else {
        return {
            name: path.path,
            record: path.recording,
            runOnInit: ''
        };
    }
}
