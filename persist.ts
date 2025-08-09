import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { diffString }  from 'json-diff';
import { fetch } from 'undici';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cron from 'node-cron';
import YAML from 'yaml';

export type Path = {
    name: string,

    runOnInit: string,
    runOnInitRestart: boolean

    record: boolean,
};

export type CloudTAKRemotePath = {
    id: number,
    path: string,
    recording: boolean,
    proxy: string | null,
}

export type CloudTAKRemotePaths = {
    total: number,
    items: Array<RemotePath>
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.CLOUDTAK_URL) throw new Error('CLOUDTAK_URL Env Var not set');
    if (!process.env.MediaSecret) throw new Error('MediaSecret Env Var not set');
    if (!process.env.SigningSecret) throw new Error('SigningSecret Env Var not set');

    // Ensure Config is written before starting the service
    await sync();

    await schedule();
}

export async function schedule() {
    cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
        await this.sync();
    });
}

/**
 * Perform a single sync operation
 */
export async function sync() {
    await this.syncPaths();
}

/**
 * Sync Paths from CloudTAK to Media Server
 */
export async function syncPaths(): Promise<void> {
    const paths = await this.listCloudTAKPaths();

    const existing = await this.listMediaMTXPathsMap();

    for (const path of paths) {
        const exists = existing.get(path.path);

        const payload = this.payload(path);

        if (!exists) {
            await this.createMediaMTXPath(payload);
        } else {
            if (
                exists.recording !== payload.recording
                || exists.runOnInit !== payload.runOnInit
            ) {
                await this.updateMediaMTXPath(payload);
            }
        }
    }
}

export function payload(path: CloudTAKRemotePath): Promise<Path> {
    if (path.proxy) {
        return {
            name: remote.path,
            record: path.recording,
            runOnInit: `ffmpeg -re -i '${remote.proxy}' -vcodec libx264 -profile:v baseline -g 60 -acodec aac -f mpegts srt://127.0.0.1:8890?streamid=publish:${remote.path}`
        };
    } else {
        return {
            name: remote.path,
            record: path.recording,
            runOnInit: ''
        };
    }
}

export async function createMediaMTXPath(path: Path): Promise<void> {
    const url = new URL(`http://localhost:9997/v3/config/paths/add/${path.name}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            // @ts-expect-error JWT Secret
            'Authorization': `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, process.env.SigningSecret)}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(path)
    });

    if (!res.ok) throw new Error(await res.text());
}

export async function updateMediaMTXPath(path: Path): Promise<void> {
    const url = new URL(`http://localhost:9997/v3/config/paths/replace/${path.name}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            // @ts-expect-error JWT Secret
            'Authorization': `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, process.env.SigningSecret)}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(path)
    });

    if (!res.ok) throw new Error(await res.text());
}

export async function listMediaMTXPathsMap(): Promise<Map<string, Path>> {
    let total = 0;
    const limit = 100;
    let page = 0;

    const paths = new Map<string, Path>();

    do {
        const url = new URL('http://localhost:9997/v3/config/paths/list');
        url.searchParams.append('itemsPerPage', String(limit));
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                // @ts-expect-error JWT Secret
                Authorization: `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, process.env.SigningSecret)}`
            }
        });

        if (!res.ok) throw new Error(await res.text());

        const body = await res.json() as {
            pageCount: number,
            itemCount: number,
            items: Array<Path>
        };

        total = body.itemCount;

        for (const item of body.items) {
            paths.set(item.name, item);
        }

        ++page;
    } while (total > page * limit);
}

export async function listCloudTAKPaths(): Promise<Array<CloudTAKRemotePath>> {
    let total = 0;
    const limit = 100;
    let page = 0;

    const paths = [];

    do {
        const url = new URL(process.env.CLOUDTAK_URL + '/video/lease');
        url.searchParams.append('limit', String(limit));
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

        const body = await res.json() as CloudTAKRemotePaths;

        total = body.total;

        paths.push(...body.items);

        ++page;
    } while (total > page * limit);
}
