import { execFileSync } from 'node:child_process';

/**
 * Verify that pushed image manifests contain every platform we claim to
 * support. Run at the end of each ECR test build and GHCR release so a
 * single-arch regression fails the pipeline instead of shipping.
 *
 * Usage: npx tsx bin/multiarch.ts <image-ref> [<image-ref>...]
 *
 * Required platforms default to linux/amd64,linux/arm64 and can be
 * overridden with the DOCKER_PLATFORMS env var (same format bin/build.js uses)
 */

const DEFAULT_PLATFORMS = 'linux/amd64,linux/arm64';

const images = process.argv.slice(2);

if (!images.length) {
    console.error('usage: npx tsx bin/multiarch.ts <image-ref> [<image-ref>...]');
    process.exit(1);
}

const required = (process.env.DOCKER_PLATFORMS || DEFAULT_PLATFORMS)
    .split(',')
    .map((platform) => platform.trim())
    .filter(Boolean);

let failures = 0;

for (const image of images) {
    let raw: string;
    try {
        raw = String(execFileSync('docker', ['buildx', 'imagetools', 'inspect', '--raw', image]));
    } catch (err) {
        console.error(`not ok - failed to inspect ${image}: ${err instanceof Error ? err.message : err}`);
        failures++;
        continue;
    }

    const manifest = JSON.parse(raw);

    const provided = new Set<string>();
    for (const entry of manifest.manifests || []) {
        const platform = entry.platform;

        // Attestation manifests report as unknown/unknown
        if (!platform || platform.os === 'unknown' || platform.architecture === 'unknown') continue;

        provided.add(`${platform.os}/${platform.architecture}`);
        if (platform.variant) provided.add(`${platform.os}/${platform.architecture}/${platform.variant}`);
    }

    if (!provided.size) {
        console.error(`not ok - ${image} is a single-platform image, expected: ${required.join(', ')}`);
        failures++;
        continue;
    }

    const missing = required.filter((platform) => !provided.has(platform));

    if (missing.length) {
        console.error(`not ok - ${image} missing platforms: ${missing.join(', ')} (has: ${Array.from(provided).join(', ')})`);
        failures++;
    } else {
        console.error(`ok - ${image} provides ${required.join(', ')}`);
    }
}

process.exit(failures ? 1 : 0);
