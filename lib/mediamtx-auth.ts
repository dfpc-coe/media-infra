import jwt, { JwtPayload } from 'jsonwebtoken';
import NodeCache from 'node-cache';
import { fetch } from 'undici';
import { Static } from '@sinclair/typebox';
import type { Config } from './config.js';
import { MediaMTXAuthRequest, StandardResponse } from './types.js';

export const MEDIA_MTX_AUTH_CACHE_TTL_SECONDS = 5 * 60;

type FetchResponse = {
    ok: boolean;
    status: number;
    text(): Promise<string>;
}

type FetchLike = (input: URL, init?: RequestInit) => Promise<FetchResponse>;

export function getMediaMTXAuthCacheKey(auth: Static<typeof MediaMTXAuthRequest>): string {
    return JSON.stringify({
        user: auth.user,
        password: auth.password,
        token: auth.token || '',
        ip: auth.ip,
        action: auth.action,
        path: auth.path,
        protocol: auth.protocol,
        id: auth.id,
        query: auth.query
    });
}

export function getMediaMTXAuthCacheTTL(
    config: Config,
    auth: Static<typeof MediaMTXAuthRequest>
): number {
    const ttl = MEDIA_MTX_AUTH_CACHE_TTL_SECONDS;

    if (auth.user !== 'management' || !auth.password) {
        return ttl;
    }

    try {
        const decoded = jwt.verify(auth.password, config.SigningSecret) as JwtPayload | string;

        if (typeof decoded === 'string' || typeof decoded.exp !== 'number') {
            return ttl;
        }

        const remaining = Math.floor(decoded.exp - (Date.now() / 1000));
        return Math.max(1, Math.min(ttl, remaining));
    } catch {
        return ttl;
    }
}

export async function authenticateMediaMTXRequest(
    config: Config,
    cache: NodeCache,
    auth: Static<typeof MediaMTXAuthRequest>,
    fetchImpl: FetchLike = fetch as FetchLike
): Promise<{ status: number; body: Static<typeof StandardResponse>; cached: boolean }> {
    const cacheKey = getMediaMTXAuthCacheKey(auth);
    const cached = cache.get<Static<typeof StandardResponse>>(cacheKey);

    if (cached) {
        return {
            status: 200,
            body: cached,
            cached: true
        };
    }

    const url = new URL('/api/video/auth', config.API_URL);
    const resp = await fetchImpl(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(auth)
    });

    const text = await resp.text();

    let body: Static<typeof StandardResponse> = {
        status: resp.status,
        message: text || (resp.ok ? 'Authorized' : 'Unauthorized')
    };

    if (text) {
        try {
            const parsed = JSON.parse(text) as Partial<Static<typeof StandardResponse>>;

            if (typeof parsed.status === 'number' && typeof parsed.message === 'string') {
                body = {
                    status: parsed.status,
                    message: parsed.message
                };
            }
        } catch {
            // Non-JSON responses are normalized above.
        }
    }

    if (resp.ok) {
        cache.set(cacheKey, body, getMediaMTXAuthCacheTTL(config, auth));
    }

    return {
        status: resp.status,
        body,
        cached: false
    };
}