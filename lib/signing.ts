import crypto from 'node:crypto';

export function generateSignedUrl(
    secret: string,
    path: string,
    hash: string,
    type: 'ts' | 'm4s' | 'm3u8' | 'mp4'
): string {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${path}${exp}segment`)
        .digest('hex');

    return `/stream/${path}/segment.${type}?hash=${hash}&sig=${signature}&exp=${exp}`;
}

export function verifySignedUrl(
    secret: string,
    path: string,
    sig: string,
    exp: string,
    type: 'segment'
): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (parseInt(exp, 10) < now) {
        return false;
    }

    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${path}${exp}${type}`)
        .digest('hex');

    return sig === expectedSig;
}
