import test from 'node:test';
import assert from 'node:assert/strict';
import { Manifest } from '../lib/manifest.js';
import { verifySignedUrl } from '../lib/signing.js';
import NodeCache from 'node-cache';

test('Manifest.rewrite', async (t) => {
    await t.test('rewrites master playlist', () => {
        const manifest = `#EXTM3U
#EXT-X-VERSION:9
#EXT-X-INDEPENDENT-SEGMENTS

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="audio2",AUTOSELECT=YES,DEFAULT=YES,URI="audio2_stream.m3u8",LANGUAGE="en"

#EXT-X-STREAM-INF:BANDWIDTH=3044947,AVERAGE-BANDWIDTH=3044947,CODECS="avc1.64002a,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=29.970,AUDIO="audio"
/stream/ddd3ccdb-7d54-4c0a-b8bd-09c2bcc1de6d/segment.m3u8?hash=4211959d-f88c-4bcb-9497-4b244dcda7b2&sig=dffd8a435012763692c4d13f94069103979353250ab39a4fea9f7654cd47d31b&exp=1765578488`;

        const baseUrl = 'http://example.com/stream/123/';
        const streamId = 'test-stream';
        const config = { SigningSecret: 'secret' } as any;
        const cache = new NodeCache();

        const rewritten = Manifest.rewrite(manifest, baseUrl, streamId, config, cache);

        const lines = rewritten.split('\n');

        // Check EXT-X-MEDIA rewrite
        const mediaLine = lines.find(l => l.startsWith('#EXT-X-MEDIA:TYPE=AUDIO'));
        assert.ok(mediaLine, 'Media line found');
        assert.match(mediaLine!, /URI="\/stream\/test-stream\/segment\.m3u8\?token=[a-zA-Z0-9._-]+"/, 'Media URI rewritten correctly');
        assert.match(mediaLine!, /,LANGUAGE="en"$/, 'Media attributes preserved after URI rewrite');

        // Check Stream Inf URI rewrite
        const lastLine = lines[lines.length - 1];
        assert.match(lastLine, /\/stream\/test-stream\/segment\.m3u8\?token=[a-zA-Z0-9._-]+/, 'Stream URI rewritten correctly');
    });

    await t.test('rewrites low-latency playlist URI attributes', () => {
        const manifest = `#EXTM3U
#EXT-X-VERSION:10
#EXT-X-TARGETDURATION:2
#EXT-X-MAP:BYTERANGE="720@0",URI="init.mp4"
#EXTINF:2.0,
segment0.ts
#EXT-X-PART:DURATION=0.33334,URI="segment1.part0.ts",INDEPENDENT=YES
#EXT-X-PRELOAD-HINT:TYPE=PART,URI="segment1.part1.ts"`;

        const baseUrl = 'http://example.com/stream/123/index.m3u8';
        const streamId = 'test-stream';
        const config = { SigningSecret: 'secret' } as any;
        const cache = new NodeCache();

        const rewritten = Manifest.rewrite(manifest, baseUrl, streamId, config, cache);
        const lines = rewritten.split('\n');

        assert.match(lines[3], /#EXT-X-MAP:BYTERANGE="720@0",URI="\/stream\/test-stream\/segment\.mp4\?token=[a-zA-Z0-9._-]+"/, 'Map URI rewritten correctly');
        assert.match(lines[5], /\/stream\/test-stream\/segment\.ts\?token=[a-zA-Z0-9._-]+/, 'Bare segment URI rewritten correctly');
        assert.match(lines[6], /#EXT-X-PART:DURATION=0\.33334,URI="\/stream\/test-stream\/segment\.ts\?token=[a-zA-Z0-9._-]+",INDEPENDENT=YES/, 'Part URI rewritten correctly');
        assert.match(lines[7], /#EXT-X-PRELOAD-HINT:TYPE=PART,URI="\/stream\/test-stream\/segment\.ts\?token=[a-zA-Z0-9._-]+"/, 'Preload hint URI rewritten correctly');
    });

    await t.test('reuses deterministic hashes for repeated URI rewrites', () => {
        const baseUrl = 'http://example.com/stream/123/index.m3u8';
        const streamId = 'test-stream';
        const config = { SigningSecret: 'secret' } as any;
        const cache = new NodeCache();

        const first = Manifest.rewriteSignedUrl('segment0.ts', baseUrl, streamId, config, cache);
        const second = Manifest.rewriteSignedUrl('segment0.ts', baseUrl, streamId, config, cache);

        const firstToken = new URL(`http://example.com${first}`).searchParams.get('token');
        const secondToken = new URL(`http://example.com${second}`).searchParams.get('token');

        assert.ok(firstToken);
        assert.ok(secondToken);

        const decodedFirst = verifySignedUrl(config.SigningSecret, streamId, firstToken!);
        const decodedSecond = verifySignedUrl(config.SigningSecret, streamId, secondToken!);

        if (decodedFirst === false || decodedSecond === false) {
            assert.fail('Signed URLs should verify successfully');
        }

        assert.equal(decodedFirst.hash, decodedSecond.hash, 'Repeated rewrites should reuse the same hash');
        assert.deepEqual(cache.keys(), [`${streamId}-${decodedFirst.hash}`], 'Repeated rewrites should reuse the same cache entry');
        assert.equal(cache.get(`${streamId}-${decodedFirst.hash}`), 'http://example.com/stream/123/segment0.ts');
    });
});

