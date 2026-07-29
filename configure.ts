import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fetch } from 'undici';
import jwt from 'jsonwebtoken';

// Log levels supported by MediaMTX - anything else causes MediaMTX to refuse to start
const LOGLEVELS = ['error', 'warn', 'info', 'debug'];
const DEFAULT_LOGLEVEL = 'info';

const LOGLEVEL = resolveLogLevel();
const AUTH_ADDRESS = 'http://127.0.0.1:9995/auth';

// Default CoTURN listening port (coturn-infra coturn.conf listening-port)
const COTURN_PORT = 3478;

const webrtcAdditionalHosts = resolveWebRTCAdditionalHosts();
const webrtcEncryption = configureACMCertificate();
const coturn = await resolveCoturnConfig();

const yaml = generateConfig(
    webrtcAdditionalHosts,
    webrtcEncryption,
    coturn
);

fs.writeFileSync('/mediamtx.yml', yaml);

console.log('ok - MediaMTX configuration written to /mediamtx.yml');

/**
 * Resolve the MediaMTX log level from MEDIAMTX_LOGLEVEL, falling back to the
 * MediaMTX default of `info`. An unknown value is ignored rather than written
 * to the config, as MediaMTX would fail to start with it.
 */
function resolveLogLevel(): string {
    const level = (process.env.MEDIAMTX_LOGLEVEL || '').trim().toLowerCase();

    if (!level) return DEFAULT_LOGLEVEL;

    if (!LOGLEVELS.includes(level)) {
        console.error(`warn - Unknown MEDIAMTX_LOGLEVEL "${level}", falling back to ${DEFAULT_LOGLEVEL}`);
        return DEFAULT_LOGLEVEL;
    }

    return level;
}

/**
 * Extract the hostname from CLOUDTAK_Config_media_url and merge it
 * with any existing MTX_WEBRTCADDITIONALHOSTS value.
 */
function resolveWebRTCAdditionalHosts(): string[] {
    const hosts: string[] = [];

    if (process.env.MTX_WEBRTCADDITIONALHOSTS) {
        hosts.push(...process.env.MTX_WEBRTCADDITIONALHOSTS.split(',').filter(Boolean));
    }

    if (process.env.CLOUDTAK_Config_media_url) {
        try {
            const hostname = new URL(process.env.CLOUDTAK_Config_media_url).hostname;
            if (hostname && !hosts.includes(hostname)) {
                hosts.push(hostname);
            }
        } catch (err) {
            console.error('warn - Failed to parse CLOUDTAK_Config_media_url:', err);
        }
    }

    return hosts;
}

/**
 * Fetch the CoTURN configuration from the CloudTAK Config API.
 * Returns the TURN/STUN host and shared secret if both `coturn::url` and
 * `coturn::secret` are set, otherwise null.
 *
 * The `coturn::*` keys are admin-only, so we mint a short-lived admin user
 * token signed with the shared SigningSecret to read them.
 */
async function resolveCoturnConfig(): Promise<{ host: string; secret: string } | null> {
    const apiUrl = process.env.API_URL;
    const signingSecret = process.env.SigningSecret;

    if (!apiUrl || !signingSecret) return null;

    try {
        const url = new URL(apiUrl + '/api/config');
        url.searchParams.append('keys', 'coturn::url,coturn::secret');

        const token = jwt.sign(
            { access: 'admin', email: 'media-infra@cloudtak.internal' },
            signingSecret,
            { expiresIn: 120 }
        );

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            console.error(`warn - Failed to fetch CoTURN config (${res.status}): ${await res.text()}`);
            return null;
        }

        const body = await res.json() as {
            'coturn::url'?: string;
            'coturn::secret'?: string;
        };

        const host = (body['coturn::url'] || '').trim();
        const secret = (body['coturn::secret'] || '').trim();

        if (!host || !secret) return null;

        return { host, secret };
    } catch (err) {
        console.error('warn - Failed to resolve CoTURN config:', err);
        return null;
    }
}

/**
 * If ACM_CERTIFICATE_ARN is set, export the certificate and key
 * to /server.crt and /server.key for WebRTC encryption.
 * Returns true if encryption was configured.
 */
function configureACMCertificate(): boolean {
    const arn = process.env.ACM_CERTIFICATE_ARN;
    if (!arn) return false;

    const passphraseFile = '/tmp/acm-passphrase';
    const exportFile = '/tmp/acm-certificate.json';
    const encryptedKeyFile = '/tmp/server.encrypted.key';

    try {
        execSync(`openssl rand -base64 48 | tr -d '\\n' > ${passphraseFile}`, { stdio: 'pipe' });

        execSync(
            `aws acm export-certificate --certificate-arn "${arn}" --passphrase "fileb://${passphraseFile}" --output json > ${exportFile}`,
            { stdio: 'pipe' }
        );

        const certData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

        const cert = (certData.Certificate || '') + '\n' + (certData.CertificateChain || '');
        fs.writeFileSync('/server.crt', cert, { mode: 0o644 });

        const encryptedKey = certData.PrivateKey;
        fs.writeFileSync(encryptedKeyFile, encryptedKey);

        execSync(
            `openssl pkcs8 -in ${encryptedKeyFile} -out /server.key -passin "file:${passphraseFile}"`,
            { stdio: 'pipe' }
        );

        fs.chmodSync('/server.key', 0o600);
    } finally {
        for (const f of [passphraseFile, exportFile, encryptedKeyFile]) {
            try { fs.unlinkSync(f); } catch { /* ignore */ }
        }
    }

    return true;
}

/**
 * Read the static mediamtx.yml and apply dynamic overrides.
 * Only the following values are overridden:
 * - logLevel
 * - authHTTPAddress
 * - webrtcAdditionalHosts
 * - webrtcEncryption (and related server key/cert paths)
 * - webrtcICEServers2 (when CoTURN is configured)
 */
function generateConfig(
    webrtcAdditionalHosts: string[],
    webrtcEncryption: boolean,
    coturn: { host: string; secret: string } | null
): string {
    let config = fs.readFileSync('/mediamtx.yml', 'utf8');

    // Override logLevel
    config = config.replace(
        /^logLevel: .*/m,
        `logLevel: ${LOGLEVEL}`
    );

    // Override authHTTPAddress
    config = config.replace(
        /^authHTTPAddress: .*/m,
        `authHTTPAddress: ${AUTH_ADDRESS}`
    );

    // Override webrtcAdditionalHosts
    const hostsYAML = webrtcAdditionalHosts.length > 0
        ? webrtcAdditionalHosts.map((h) => `  - "${h}"`).join('\n')
        : '  []';
    config = config.replace(
        /^webrtcAdditionalHosts:.*$/m,
        `webrtcAdditionalHosts:\n${hostsYAML}`
    );

    // Override webrtcEncryption and related settings
    if (webrtcEncryption) {
        config = config.replace(
            /^webrtcEncryption: .*/m,
            'webrtcEncryption: true'
        );
        // Add server key/cert paths after webrtcEncryption line
        config = config.replace(
            /^(webrtcEncryption: true)$/m,
            `$1\nwebrtcServerKey: /server.key\nwebrtcServerCert: /server.crt`
        );
    } else {
        config = config.replace(
            /^webrtcEncryption: .*/m,
            'webrtcEncryption: false'
        );
        // Remove server key/cert paths if present
        config = config.replace(/^\s*webrtcServerKey:.*$/m, '');
        config = config.replace(/^\s*webrtcServerCert:.*$/m, '');
    }

    // Override webrtcICEServers2 with the CoTURN server when configured.
    // All media is forced through TURN over TCP (?transport=tcp) for reliable
    // traversal of restrictive networks. The TURN server requires authentication
    // via the shared secret, which uses the MediaMTX "AUTH_SECRET" mechanism (the
    // secret is placed in the password field) to match CoTURN's `use-auth-secret`.
    if (coturn) {
        const turnUrl = `turn:${coturn.host}:${COTURN_PORT}?transport=tcp`;
        const iceServersYAML = [
            'webrtcICEServers2:',
            `  - url: stun:${coturn.host}:${COTURN_PORT}`,
            `  - url: ${JSON.stringify(turnUrl)}`,
            '    username: AUTH_SECRET',
            `    password: ${JSON.stringify(coturn.secret)}`
        ].join('\n');

        config = config.replace(
            /^webrtcICEServers2:.*(?:\n[ \t]+-.*(?:\n[ \t]+[^-\s].*)*)*/m,
            iceServersYAML
        );
    }

    return config;
}
