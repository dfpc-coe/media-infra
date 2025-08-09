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
export async function syncPaths(): Promise<Array<RemotePath>> {
    const paths = await this.listCloudTAKPaths();

}

export async listMediaMTXPaths(): Promise<> {
    let total = 0;
    const limit = 100;
    let page = 0;

    const paths = [];

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

        const body = await res.json() as RemotePaths;

        total = body.itemCount;

        paths.push(...body.items);

        ++page;
    } while (total > page * limit);
}

export async listCloudTAKPaths(): Promise<Array<RemotePath>> {
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

        const body = await res.json() as RemotePaths;

        total = body.total;

        paths.push(...body.items);

        ++page;
    } while (total > page * limit);
}
