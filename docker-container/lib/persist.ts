import jwt from 'jsonwebtoken';
import type { Config } from './config.js';
import { managementToken } from './auth.js';
import { fetch } from 'undici';
import { CloudTAKRemotePath, CloudTAKRemotePaths, Path } from './types.js';
import { createPayload, isHLSPath } from './payload.js';
import { Static } from '@sinclair/typebox';
import cron from 'node-cron';

export async function schedule(config: Config) {
    cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
        try {
            await sync(config);
        } catch (err) {
            console.error('Error during sync:', err);
        }
    });
}

/**
 * Perform a single sync operation
 */
export async function sync(config: Config) {
    await syncPaths(config);
}

/**
 * Sync Paths from CloudTAK to Media Server
 */
export async function syncPaths(config: Config): Promise<void> {
    const paths = await listCloudTAKPaths(config);

    const existing = await listMediaMTXPathsMap(config);

    for (const path of paths.values()) {
        const exists = existing.get(path.path);

        if (isHLSPath(path.proxy)) {
            // We use the HLS proxy for existing HLS streams
            continue;
        }

        const payload = createPayload(path);

        if (!exists) {
            await createMediaMTXPath(config, payload);
        } else {
            if (
                exists.record !== payload.record
                || exists.runOnInit !== payload.runOnInit
            ) {
                await updateMediaMTXPath(config, payload);
            }
        }
    }

    for (const exist of existing.keys()) {
        if (!paths.has(exist)) {
            await removeMediaMTXPath(config, exist);
        }
    }
}

export async function removeMediaMTXPath(config: Config, uuid: string): Promise<void> {
    const url = new URL(`http://localhost:4000/v3/config/paths/delete/${uuid}`);

    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
        },
    });

    if (!res.ok) throw new Error(await res.text());
}

export async function createMediaMTXPath(config: Config, path: Static<typeof Path>): Promise<void> {
    const url = new URL(`http://localhost:4000/v3/config/paths/add/${path.name}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(path)
    });

    if (!res.ok) throw new Error(await res.text());
}

export async function updateMediaMTXPath(config: Config, path: Static<typeof Path>): Promise<void> {
    const url = new URL(`http://localhost:4000/v3/config/paths/replace/${path.name}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(path)
    });

    if (!res.ok) throw new Error(await res.text());
}

export async function listMediaMTXPathsMap(config: Config): Promise<Map<string, Static<typeof Path>>> {
    let total = 0;
    const limit = 100;
    let page = 0;

    const paths = new Map<string, Static<typeof Path>>();

    do {
        const url = new URL('http://localhost:4000/v3/config/paths/list');
        url.searchParams.append('itemsPerPage', String(limit));
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${btoa(`management:${managementToken(config.SigningSecret)}`)}`,
            }
        });

        if (!res.ok) {
            console.error(res);
            throw new Error(await res.text());
        }

        const body = await res.json() as {
            pageCount: number,
            itemCount: number,
            items: Array<Static<typeof Path>>
        };

        total = body.itemCount;

        for (const item of body.items) {
            paths.set(item.name, item);
        }

        ++page;
    } while (total > page * limit);

    return paths;
}

export async function getCloudTAKPath(config: Config, path: string): Promise<Static<typeof CloudTAKRemotePath>> {
    const url = new URL(process.env.API_URL + `/api/video/lease/${path}`);

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, String(config.SigningSecret))}`
        }
    });

    if (!res.ok) {
        console.error(`Failed CloudTAK API Call: ${url.toString()}`);
        throw new Error(await res.text());
    }

    return await res.json() as Static<typeof CloudTAKRemotePath>;
}

export async function listCloudTAKPaths(config: Config): Promise<Map<string, Static<typeof CloudTAKRemotePath>>> {
    let total = 0;
    const limit = 100;
    let page = 0;

    const paths = new Map();

    do {
        const url = new URL(process.env.API_URL + '/api/video/lease');
        url.searchParams.append('limit', String(limit));
        url.searchParams.append('expired', 'false');
        url.searchParams.append('ephemeral', 'false');
        url.searchParams.append('impersonate', 'true');
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, config.SigningSecret)}`
            }
        });

        if (!res.ok) {
            console.error(`Failed CloudTAK API Call: ${url.toString()}`);
            throw new Error(await res.text());
        }

        const body = await res.json() as Static<typeof CloudTAKRemotePaths>;

        total = body.total;

        for (const item of body.items) {
            paths.set(item.path, item);
        }

        ++page;
    } while (total > page * limit);

    return paths;
}
