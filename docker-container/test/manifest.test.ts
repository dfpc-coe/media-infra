import test from 'node:test';
import assert from 'node:assert/strict';
import { Manifest } from '../lib/manifest.js';
import NodeCache from 'node-cache';

test('Manifest.rewrite', async (t) => {
    await t.test('rewrites master playlist', () => {
        const manifest = `#EXTM3U
#EXT-X-VERSION:9
#EXT-X-INDEPENDENT-SEGMENTS

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="audio2",AUTOSELECT=YES,DEFAULT=YES,URI="audio2_stream.m3u8"

#EXT-X-STREAM-INF:BANDWIDTH=3044947,AVERAGE-BANDWIDTH=3044947,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=29.970,AUDIO="audio"
/stream/ddd3ccdb-7d54-4c0a-b8bd-09c2bcc1de6d/segment.m3u8?hash=4211959d-f88c-4bcb-9497-4b244dcda7b2&sig=dffd8a435012763692c4d13f94069103979353250ab39a4fea9f7654cd47d31b&exp=1765578488`;

        const baseUrl = 'http://example.com/stream/123/';
        const streamId = 'test-stream';
        const config = { SigningSecret: 'secret' } as any;
        const cache = new NodeCache();

        const rewritten = Manifest.rewrite(manifest, baseUrl, streamId, config, cache);
        
        console.error(rewritten)

        const lines = rewritten.split('\n');

        // Check EXT-X-MEDIA rewrite
        const mediaLine = lines.find(l => l.startsWith('#EXT-X-MEDIA:TYPE=AUDIO'));
        assert.ok(mediaLine, 'Media line found');
        assert.match(mediaLine!, /URI="\/stream\/test-stream\/segment\.m3u8\?token=[a-zA-Z0-9._-]+"/, 'Media URI rewritten correctly');

        // Check Stream Inf URI rewrite
        const lastLine = lines[lines.length - 1];
        assert.match(lastLine, /\/stream\/test-stream\/segment\.m3u8\?token=[a-zA-Z0-9._-]+/, 'Stream URI rewritten correctly');
    });
});