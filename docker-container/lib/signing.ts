import jwt from 'jsonwebtoken';

export function generateSignedUrl(
    secret: string,
    path: string,
    hash: string,
    type: string
): string {
    const token = jwt.sign({
        path,
        hash,
        type
    }, secret, { expiresIn: '10m' });

    return `/stream/${path}/segment.${type}?token=${token}`;
}

export function verifySignedUrl(
    secret: string,
    path: string,
    token: string
): { path: string; hash: string; type: string } | boolean {
    try {
        const decoded = jwt.verify(token, secret) as { path: string; hash: string; type: string };
        if (decoded.path !== path) return false;
        return decoded;
    } catch (err) {
        console.error(err);
        return false;
    }
}
