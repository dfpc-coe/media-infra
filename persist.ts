import jwt from 'jsonwebtoken';
import { fetch } from 'undici';
import cron from 'node-cron';

export type Path = {
    name: string,
    runOnInit: string,
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
    items: Array<CloudTAKRemotePath>
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.API_URL) throw new Error('API_URL Env Var not set');
    if (!process.env.MediaSecret) throw new Error('MediaSecret Env Var not set');
    if (!process.env.SigningSecret) throw new Error('SigningSecret Env Var not set');

    // Ensure Config is written before starting the service
    await sync();

    await schedule();
}

export async function schedule() {
    cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
        await sync();
    });
}

/**
 * Perform a single sync operation
 */
export async function sync() {
    await syncPaths();
}

/**
 * Sync Paths from CloudTAK to Media Server
 */
export async function syncPaths(): Promise<void> {
    const paths = await listCloudTAKPaths();

    const existing = await listMediaMTXPathsMap();

    for (const path of paths.values()) {
        const exists = existing.get(path.path);

        const payload = createPayload(path);

        if (!exists) {
            await createMediaMTXPath(payload);
        } else {
            if (
                exists.record !== payload.record
                || exists.runOnInit !== payload.runOnInit
            ) {
                await updateMediaMTXPath(payload);
            }
        }
    }

    for (const exist of existing.keys()) {
        if (!paths.has(exist)) {
            await removeMediaMTXPath(exist);
        }
    }
}

export function createPayload(path: CloudTAKRemotePath): Path {
    if (path.proxy) {
        return {
            name: path.path,
            record: path.recording,
            runOnInit: `ffmpeg -re -i '${path.proxy}' -vcodec libx264 -profile:v baseline -g 60 -acodec aac -f mpegts srt://127.0.0.1:8890?streamid=publish:${path.path}`
        };
    } else {
        return {
            name: path.path,
            record: path.recording,
            runOnInit: ''
        };
    }
}

export async function removeMediaMTXPath(uuid: string): Promise<void> {
    const url = new URL(`http://localhost:9997/v3/config/paths/delete/${uuid}`);

    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Basic ${btoa(`management:${process.env.MediaSecret}`)}`
        }
    });

    if (!res.ok) throw new Error(await res.text());
}

export async function createMediaMTXPath(path: Path): Promise<void> {
    const url = new URL(`http://localhost:9997/v3/config/paths/add/${path.name}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa(`management:${process.env.MediaSecret}`)}`,
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
            'Authorization': `Basic ${btoa(`management:${process.env.MediaSecret}`)}`,
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
                'Authorization': `Basic ${btoa(`management:${process.env.MediaSecret}`)}`
            }
        });

        if (!res.ok) {
            console.error(res);
            throw new Error(await res.text());
        }

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

    return paths;
}

export async function listCloudTAKPaths(): Promise<Map<string, CloudTAKRemotePath>> {
    let total = 0;
    const limit = 100;
    let page = 0;

    const paths = new Map();

    do {
        const url = new URL(process.env.API_URL + '/video/lease');
        url.searchParams.append('limit', String(limit));
        url.searchParams.append('expired', 'false');
        url.searchParams.append('ephemeral', 'all');
        url.searchParams.append('impersonate', 'true');
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, String(process.env.SigningSecret))}`
            }
        });

        if (!res.ok) throw new Error(await res.text());

        const body = await res.json() as CloudTAKRemotePaths;

        total = body.total;

        for (const item of body.items) {
            paths.set(item.path, item);
        }

        ++page;
    } while (total > page * limit);

    return paths;
}
