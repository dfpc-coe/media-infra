import fs from 'node:fs';
import { execSync } from 'node:child_process';

const LOGLEVEL = process.env.LOG_LEVEL || 'info';
const AUTH_ADDRESS = 'http://127.0.0.1:9995/auth';

const webrtcAdditionalHosts = resolveWebRTCAdditionalHosts();
const webrtcEncryption = configureACMCertificate();

const yaml = generateConfig(
    webrtcAdditionalHosts,
    webrtcEncryption
);

fs.writeFileSync('/mediamtx.yml', yaml);

console.log('ok - MediaMTX configuration written to /mediamtx.yml');

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
 */
function generateConfig(webrtcAdditionalHosts: string[], webrtcEncryption: boolean): string {
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

    return config;
}
