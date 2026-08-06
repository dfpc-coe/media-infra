import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayload, ingestSource, isHLSPath } from '../lib/payload.js';
import type { Config } from '../lib/config.js';

const baseConfig: Config = {
    silent: true,
    API_URL: 'http://cloudtak.internal:5000',
    CLOUDTAK_Config_media_url: 'https://video.example.org',
    CLOUDTAK_Config_media_ingest_internal_host: '',
    SigningSecret: 'test-secret'
};

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

test('ingestSource', async (t) => {
    await t.test('no-op when CLOUDTAK_Config_media_ingest_internal_host is unset', () => {
        const source = 'rtsp://video.example.org:8554/mystream';
        assert.equal(ingestSource(source, baseConfig), source);
    });

    await t.test('rewrites an RTSP source matching our own hostname when opted in', () => {
        const config: Config = { ...baseConfig, CLOUDTAK_Config_media_ingest_internal_host: 'mediamtx' };
        const rewritten = ingestSource('rtsp://video.example.org:8554/mystream', config);
        assert.equal(rewritten, 'rtsp://mediamtx:8554/mystream');
    });

    await t.test('leaves RTSP sources pointing elsewhere untouched', () => {
        const config: Config = { ...baseConfig, CLOUDTAK_Config_media_ingest_internal_host: 'mediamtx' };
        const source = 'rtsp://camera.example.net:8554/mystream';
        assert.equal(ingestSource(source, config), source);
    });

    await t.test('leaves non-RTSP sources untouched even on a hostname match', () => {
        const config: Config = { ...baseConfig, CLOUDTAK_Config_media_ingest_internal_host: 'mediamtx' };
        const source = 'https://video.example.org/stream.m3u8';
        assert.equal(ingestSource(source, config), source);
    });

    await t.test('passes through unparseable sources unchanged', () => {
        const config: Config = { ...baseConfig, CLOUDTAK_Config_media_ingest_internal_host: 'mediamtx' };
        assert.equal(ingestSource('not a url', config), 'not a url');
    });

    await t.test('passes through a missing source unchanged', () => {
        const config: Config = { ...baseConfig, CLOUDTAK_Config_media_ingest_internal_host: 'mediamtx' };
        assert.equal(ingestSource(null, config), null);
        assert.equal(ingestSource(undefined, config), undefined);
    });
});

test('createPayload', async (t) => {
    await t.test('non-proxy path omits source', () => {
        const payload = createPayload({
            id: 1,
            path: 'mystream',
            recording: false,
            proxy: null
        }, baseConfig);

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
        }, baseConfig);

        assert.deepEqual(payload, {
            name: 'mystream',
            record: true,
            source: 'rtsp://camera.example.net:8554/mystream',
            sourceOnDemand: true
        });
    });

    await t.test('proxy path rewrites a self-referential RTSP source when opted in', () => {
        const config: Config = { ...baseConfig, CLOUDTAK_Config_media_ingest_internal_host: 'mediamtx' };

        const payload = createPayload({
            id: 1,
            path: 'mystream',
            recording: false,
            proxy: 'rtsp://video.example.org:8554/mystream'
        }, config);

        assert.equal(payload.source, 'rtsp://mediamtx:8554/mystream');
    });
});
