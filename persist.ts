import assert from 'node:assert';
import { diffString }  from 'json-diff';
import { fetch } from 'undici';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cron from 'node-cron';
import YAML from 'yaml';

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.CLOUDTAK_URL) throw new Error('CLOUDTAK_URL Env Var not set');
    if (!process.env.MediaSecret) throw new Error('MediaSecret Env Var not set');

    const currentConfig = YAML.parse(String(await fs.readFileSync('/opt/mediamtx/mediamtx.yml')));

    currentConfig.authMethod = 'http';
    currentConfig.authHTTPAddress = process.env.CLOUDTAK_URL + '/video/auth';
    currentConfig.authHTTPExclude = [];
    currentConfig.authInternalUsers = [];

    fs.writeFileSync('/opt/mediamtx/mediamtx.yml.new', currentConfig);

    // Ref: https://github.com/bluenviron/mediamtx/issues/937
    fs.renameSync(
        '/opt/mediamtx/mediamtx.yml.new',
        '/opt/mediamtx/mediamtx.yml'
    );

    schedule();
}

export function schedule() {
    cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
        const config = await persist();

        const currentConfig = YAML.parse(String(await fsp.readFile('/opt/mediamtx/mediamtx.yml')));
        const existConfig = YAML.parse(config);

        try {
            assert.deepEqual(YAML.parse(String(await fsp.readFile('/opt/mediamtx/mediamtx.yml'))), existConfig);
        } catch (err) {
            if (err instanceof assert.AssertionError) {
                console.error('DIFF:', diffString(currentConfig, existConfig));

                await fsp.writeFile('/opt/mediamtx/mediamtx.yml.new', config);

                // Ref: https://github.com/bluenviron/mediamtx/issues/937
                await fsp.rename(
                    '/opt/mediamtx/mediamtx.yml.new',
                    '/opt/mediamtx/mediamtx.yml'
                );
            } else {
                throw err;
            }
        }
    });
}

export default async function persist(): Promise<string> {
    const base = await globalConfig();
    const paths = (await globalPaths()).map((path: any) => {
        return {
            name: path.name,
            source: path.source,
            sourceOnDemand: path.sourceOnDemand
        };
    });

    base.paths = {};

    for (const path of paths) {
        base.paths[path.name] = path;
    }

    base.authMethod = 'http';
    base.authHTTPAddress = process.env.CLOUDTAK_URL + '/video/auth';
    base.authHTTPExclude = [];
    base.authInternalUsers = [];

    let config = YAML.stringify(base, (key, value) => {
        if (typeof value === 'boolean') {
            return value === true ? 'yes' : 'no';
        } else {
            return value;
        }
    });

    // This is janky but MediaMTX wants `no` as a string and not a boolean
    // and I can't get the YAML library to respect that...
    config = config.split('\n').map((line) => {
        line = line.replace(/^encryption: no/, 'encryption: "no"');
        line = line.replace(/^rtmpEncryption: no/, 'rtmpEncryption: "no"');
        line = line.replace(/^rtspEncryption: no/, 'rtspEncryption: "no"');
        return line;
    }).join('\n');

    return config;
}

export async function globalPaths(): Promise<any> {
    let total = 0;
    let page = -1;

    const paths = [];

    do {
        ++page;

        const url = new URL('http://localhost:9997/v3/config/paths/list');
        url.searchParams.append('itemsPerPage', '1000');
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Basic ${Buffer.from(`management:${process.env.MediaSecret}`).toString('base64')}`
            }
        });

        const body = await res.json() as any;

        total = body.itemCount;

        paths.push(...body.items);
    } while (total > page * 1000);

    return paths;
}

export async function globalConfig(): Promise<any> {
    const res = await fetch('http://localhost:9997/v3/config/global/get', {
        method: 'GET',
        headers: {
            Authorization: `Basic ${Buffer.from(`management:${process.env.MediaSecret}`).toString('base64')}`
        }
    });

    if (!res.ok) {
        throw new Error('Status: ' + res.status + ' Body: ' + await res.text());
    }

    const body = await res.json();

    return body;
}
