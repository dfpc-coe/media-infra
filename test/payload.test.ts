import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayload, isHLSPath } from '../lib/payload.js';

test('isHLSPath', async (t) => {
    await t.test('true for an http(s) source', () => {
        assert.equal(isHLSPath('https://example.org/stream.m3u8'), true);
    });

    await t.test('false for a non-http source', () => {
        assert.equal(isHLSPath('rtsp://example.org/stream'), false);
    });

    await t.test('false for a missing source', () => {
        assert.equal(isHLSPath(null), false);
        assert.equal(isHLSPath(undefined), false);
    });
});

test('createPayload', async (t) => {
    await t.test('non-proxy path omits source', () => {
        const payload = createPayload({
            id: 1,
            path: 'mystream',
            recording: false,
            proxy: null
        });

        assert.deepEqual(payload, {
            name: 'mystream',
            record: false
        });
    });

    await t.test('proxy path sets source and sourceOnDemand', () => {
        const payload = createPayload({
            id: 1,
            path: 'mystream',
            recording: true,
            proxy: 'rtsp://camera.example.net:8554/mystream'
        });

        assert.deepEqual(payload, {
            name: 'mystream',
            record: true,
            source: 'rtsp://camera.example.net:8554/mystream',
            sourceOnDemand: true
        });
    });
});
