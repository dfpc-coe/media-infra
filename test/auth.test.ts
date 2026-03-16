import test from 'node:test';
import assert from 'node:assert/strict';
import NodeCache from 'node-cache';
import jwt from 'jsonwebtoken';
import {
    authenticateMediaMTXRequest,
    getMediaMTXAuthCacheKey,
    getMediaMTXAuthCacheTTL
} from '../lib/mediamtx-auth.js';
import type { Config } from '../lib/config.js';

const baseConfig: Config = {
    silent: true,
    API_URL: 'http://cloudtak.internal:5000',
    CLOUDTAK_Config_media_url: 'http://media.example.com',
    SigningSecret: 'test-secret',
    MediaAuthCacheTTL: 30
};

test('getMediaMTXAuthCacheKey', async (t) => {
    await t.test('includes all auth-relevant request fields', () => {
        const first = getMediaMTXAuthCacheKey({
            user: 'reader',
            password: 'secret',
            token: 'jwt-token',
            ip: '127.0.0.1',
            action: 'read',
            path: 'stream-a',
            protocol: 'hls',
            id: null,
            query: 'part=0'
        });

        const second = getMediaMTXAuthCacheKey({
            user: 'reader',
            password: 'secret',
            token: 'jwt-token',
            ip: '127.0.0.1',
            action: 'read',
            path: 'stream-b',
            protocol: 'hls',
            id: null,
            query: 'part=0'
        });

        assert.notEqual(first, second);
    });
});

test('getMediaMTXAuthCacheTTL', async (t) => {
    await t.test('caps management cache entries to the token lifetime', () => {
        const token = jwt.sign({ internal: true, access: 'media' }, baseConfig.SigningSecret, { expiresIn: 5 });

        const ttl = getMediaMTXAuthCacheTTL(baseConfig, {
            user: 'management',
            password: token,
            ip: '127.0.0.1',
            action: 'api',
            path: '',
            protocol: 'hls',
            id: null,
            query: ''
        });

        assert.ok(ttl > 0);
        assert.ok(ttl <= 5);
    });

    await t.test('uses configured ttl for non-management requests', () => {
        const ttl = getMediaMTXAuthCacheTTL(baseConfig, {
            user: 'reader',
            password: 'password',
            ip: '127.0.0.1',
            action: 'read',
            path: 'stream-a',
            protocol: 'hls',
            id: null,
            query: ''
        });

        assert.equal(ttl, baseConfig.MediaAuthCacheTTL);
    });
});

test('authenticateMediaMTXRequest', async (t) => {
    await t.test('caches successful upstream authorizations', async () => {
        const cache = new NodeCache({ stdTTL: 30, useClones: false });
        let calls = 0;

        const authRequest = {
            user: 'reader',
            password: 'password',
            ip: '127.0.0.1',
            action: 'read',
            path: 'stream-a',
            protocol: 'hls',
            id: null,
            query: ''
        };

        const fetchStub = async () => {
            calls++;

            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ status: 200, message: 'Authorized' })
            };
        };

        const first = await authenticateMediaMTXRequest(baseConfig, cache, authRequest, fetchStub);
        const second = await authenticateMediaMTXRequest(baseConfig, cache, authRequest, fetchStub);

        assert.equal(first.cached, false);
        assert.equal(second.cached, true);
        assert.equal(calls, 1);
        assert.deepEqual(second.body, { status: 200, message: 'Authorized' });
    });

    await t.test('does not cache failed upstream authorizations', async () => {
        const cache = new NodeCache({ stdTTL: 30, useClones: false });
        let calls = 0;

        const authRequest = {
            user: 'reader',
            password: 'wrong-password',
            ip: '127.0.0.1',
            action: 'read',
            path: 'stream-a',
            protocol: 'hls',
            id: null,
            query: ''
        };

        const fetchStub = async () => {
            calls++;

            return {
                ok: false,
                status: 401,
                text: async () => JSON.stringify({ status: 401, message: 'Unauthorized' })
            };
        };

        const first = await authenticateMediaMTXRequest(baseConfig, cache, authRequest, fetchStub);
        const second = await authenticateMediaMTXRequest(baseConfig, cache, authRequest, fetchStub);

        assert.equal(first.cached, false);
        assert.equal(second.cached, false);
        assert.equal(calls, 2);
        assert.deepEqual(first.body, { status: 401, message: 'Unauthorized' });
    });
});