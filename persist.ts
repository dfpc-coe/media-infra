import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { diffString }  from 'json-diff';
import { fetch } from 'undici';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cron from 'node-cron';
import YAML from 'yaml';

export type RemotePath = {
    id: number,
    path: string,
    proxy: string | null,
}

export type RemotePaths = {
    total: number,
    items: Array<RemotePath>
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.Environment) throw new Error('Environment Env Var not set');
    if (!process.env.CLOUDTAK_URL) throw new Error('CLOUDTAK_URL Env Var not set');
    if (!process.env.MediaSecret) throw new Error('MediaSecret Env Var not set');
    if (!process.env.SigningSecret) throw new Error('SigningSecret Env Var not set');

    // Ensure if there is a config change it is immediately applied
    const currentConfig = YAML.parse(String(fs.readFileSync('/opt/mediamtx/mediamtx.yml')));
    writeConfig(defaultConfig(currentConfig));

    await schedule();
}

export async function schedule() {
    cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
        const newConfig = YAML.parse(defaultConfig(await persist()));
        const oldConfig = YAML.parse(String(await fsp.readFile('/opt/mediamtx/mediamtx.yml')));

        try {
            assert.deepEqual(oldConfig, newConfig);
        } catch (err) {
            if (err instanceof assert.AssertionError) {
                console.error('DIFF:', diffString(oldConfig, newConfig));

                writeConfig(newConfig);
            } else {
                throw err;
            }
        }
    });
}

export function defaultConfig(config: Record<string, any>): string {
    config.authMethod = 'http';
    config.authHTTPAddress = process.env.CLOUDTAK_URL + '/video/auth';
    config.authHTTPExclude = [];
    config.authInternalUsers = [];

    let configstr = YAML.stringify(config, (key, value) => {
        if (typeof value === 'boolean') {
            return value === true ? 'yes' : 'no';
        } else {
            return value;
        }
    });

    // This is janky but MediaMTX wants `no` as a string and not a boolean
    // and I can't get the YAML library to respect that...
    configstr = configstr.split('\n').map((line) => {
        line = line.replace(/^encryption: no/, 'encryption: "no"');
        line = line.replace(/^rtmpEncryption: no/, 'rtmpEncryption: "no"');
        line = line.replace(/^rtspEncryption: no/, 'rtspEncryption: "no"');
        return line;
    }).join('\n');

    return configstr;
}

export function writeConfig(config: string): void {
    fs.writeFileSync('/opt/mediamtx/mediamtx.yml.new', config);

    // Ref: https://github.com/bluenviron/mediamtx/issues/937
    fs.renameSync(
        '/opt/mediamtx/mediamtx.yml.new',
        '/opt/mediamtx/mediamtx.yml'
    );
}

export default async function persist(): Promise<Record<string, any>> {
    const base = await globalConfig();

    const paths = (await globalPaths()).map((remote: RemotePath) => {
        if (remote.proxy) {
            return {
                name: remote.path,
                source: remote.proxy,
                sourceOnDemand: true
            };
        } else {
            return {
                name: remote.path
            };
        }
    });

    base.paths = {};

    for (const path of paths) {
        base.paths[path.name] = path;
    }

    return base;
}

export async function globalPaths(): Promise<Array<RemotePath>> {
    let total = 0;
    let page = 0;

    const paths = [];

    do {
        const url = new URL(process.env.CLOUDTAK_URL + '/video/lease');
        url.searchParams.append('limit', '100');
        url.searchParams.append('expired', 'false');
        url.searchParams.append('ephemeral', 'all');
        url.searchParams.append('impersonate', 'true');
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                // @ts-expect-error JWT Secret
                Authorization: `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, process.env.SigningSecret)}`
            }
        });

        if (!res.ok) throw new Error(await res.text());

        const body = await res.json() as RemotePaths;

        total = body.total;

        paths.push(...body.items);

        ++page;
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
