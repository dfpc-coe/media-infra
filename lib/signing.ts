import jwt from 'jsonwebtoken';

/**
 * Media segments are fetched once, shortly after the playlist referencing them
 * is rewritten, so a short lived token is sufficient.
 */
export const SEGMENT_TOKEN_TTL_SECONDS = 10 * 60;

/**
 * Nested playlist URLs are long lived handles rather than one-shot fetches - a
 * player resolves the variant playlist URL once from the master playlist and
 * then reloads that same URL for the entire life of a live stream. Their tokens
 * must therefore outlive a viewing session, not a single request.
 */
export const PLAYLIST_TOKEN_TTL_SECONDS = 12 * 60 * 60;

const PLAYLIST_EXTENSIONS = ['m3u8', 'm3u'];

/**
 * Sign a proxied resource URL, returning the lifetime granted alongside it so
 * the caller can keep the resource resolvable for at least as long as the token
 */
export function generateSignedUrl(
    secret: string,
    path: string,
    hash: string,
    type: string
): { url: string; expires: number } {
    const expires = PLAYLIST_EXTENSIONS.includes(type.toLowerCase())
        ? PLAYLIST_TOKEN_TTL_SECONDS
        : SEGMENT_TOKEN_TTL_SECONDS;

    const token = jwt.sign({
        path,
        hash,
        type
    }, secret, { expiresIn: expires });

    return {
        url: `/stream/${path}/segment.${type}?token=${token}`,
        expires
    };
}

export function verifySignedUrl(
    secret: string,
    path: string,
    token: string
): { path: string; hash: string; type: string } | false {
    try {
        const decoded = jwt.verify(token, secret) as { path: string; hash: string; type: string };
        if (decoded.path !== path) return false;
        return decoded;
    } catch (err) {
        console.error(err);
        return false;
    }
}
