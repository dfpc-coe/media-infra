import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
    bindClientDisconnectAbort,
    getProxyRequestHeaders,
    getProxyResponseHeaders,
    getUpstreamRequestMethod,
    shouldSendProxyBody
} from '../routes/hls.js';

class MockAbortEmitter extends EventEmitter {
    aborted = false;
    destroyed = false;
}

test('getProxyRequestHeaders', async (t) => {
    await t.test('forwards range request headers', () => {
        const headers = getProxyRequestHeaders({
            authorization: 'Bearer token',
            range: 'bytes=0-1023',
            'if-range': '"segment-etag"',
            'if-none-match': 'W/"playlist-etag"',
            'if-modified-since': 'Fri, 14 Mar 2026 12:00:00 GMT',
            cookie: 'ignored=true'
        });

        assert.deepEqual(headers, {
            authorization: 'Bearer token',
            range: 'bytes=0-1023',
            'if-range': '"segment-etag"',
            'if-none-match': 'W/"playlist-etag"',
            'if-modified-since': 'Fri, 14 Mar 2026 12:00:00 GMT'
        });
    });

    await t.test('normalizes repeated request headers', () => {
        const headers = getProxyRequestHeaders({
            accept: ['video/mp4', 'application/octet-stream']
        });

        assert.deepEqual(headers, {
            accept: 'video/mp4, application/octet-stream'
        });
    });
});

test('getProxyResponseHeaders', async (t) => {
    await t.test('preserves range-related response headers', () => {
        const headers = new Headers({
            'accept-ranges': 'bytes',
            'cache-control': 'public, max-age=60',
            'content-length': '1024',
            'content-range': 'bytes 0-1023/4096',
            'content-type': 'video/mp4',
            etag: '"segment-etag"',
            'last-modified': 'Fri, 14 Mar 2026 12:00:00 GMT'
        });

        assert.deepEqual(getProxyResponseHeaders(headers), [
            ['accept-ranges', 'bytes'],
            ['cache-control', 'public, max-age=60'],
            ['content-length', '1024'],
            ['content-range', 'bytes 0-1023/4096'],
            ['content-type', 'video/mp4'],
            ['etag', '"segment-etag"'],
            ['last-modified', 'Fri, 14 Mar 2026 12:00:00 GMT']
        ]);
    });

    await t.test('drops hop-by-hop response headers', () => {
        const headers = new Headers({
            connection: 'keep-alive',
            'transfer-encoding': 'chunked',
            'content-type': 'video/mp2t'
        });

        assert.deepEqual(getProxyResponseHeaders(headers), [
            ['content-type', 'video/mp2t']
        ]);
    });
});

test('getUpstreamRequestMethod', async (t) => {
    await t.test('preserves HEAD requests upstream', () => {
        assert.equal(getUpstreamRequestMethod('HEAD'), 'HEAD');
    });

    await t.test('defaults other methods to GET upstream', () => {
        assert.equal(getUpstreamRequestMethod('GET'), 'GET');
        assert.equal(getUpstreamRequestMethod('POST'), 'GET');
    });
});

test('shouldSendProxyBody', async (t) => {
    await t.test('skips bodies for HEAD requests', () => {
        assert.equal(shouldSendProxyBody('HEAD', 200, {} as Response['body']), false);
    });

    await t.test('skips bodies for empty upstream responses', () => {
        assert.equal(shouldSendProxyBody('GET', 204, {} as Response['body']), false);
        assert.equal(shouldSendProxyBody('GET', 200, null), false);
    });

    await t.test('streams bodies for normal GET responses', () => {
        assert.equal(shouldSendProxyBody('GET', 200, {} as Response['body']), true);
    });
});

test('bindClientDisconnectAbort', async (t) => {
    await t.test('aborts when the request is aborted', () => {
        const req = new MockAbortEmitter();
        const res = new MockAbortEmitter();
        const { signal } = bindClientDisconnectAbort(req, res);

        req.aborted = true;
        req.emit('aborted');

        assert.equal(signal.aborted, true);
    });

    await t.test('aborts when the response closes', () => {
        const req = new MockAbortEmitter();
        const res = new MockAbortEmitter();
        const { signal } = bindClientDisconnectAbort(req, res);

        res.destroyed = true;
        res.emit('close');

        assert.equal(signal.aborted, true);
    });

    await t.test('aborts immediately when the client is already gone', () => {
        const req = new MockAbortEmitter();
        const res = new MockAbortEmitter();
        req.aborted = true;

        const { signal } = bindClientDisconnectAbort(req, res);

        assert.equal(signal.aborted, true);
    });
});