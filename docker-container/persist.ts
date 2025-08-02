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

    // Read current config (base config is copied at startup)
    const currentConfig = YAML.parse(String(fs.readFileSync('/opt/mediamtx/mediamtx.yml')));
    
    writeConfig(defaultConfig(currentConfig));

    // Using 1-second sync for faster path availability
    
    await schedule();
}

let syncInProgress = false;
const CLEANUP_GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes

export async function schedule() {
    // Add new paths every 10 seconds (avoid race with CloudTAK API calls)
    cron.schedule('*/10 * * * * *', async () => {
        if (syncInProgress) {
            console.error('Sync already in progress, skipping');
            return;
        }
        
        syncInProgress = true;
        try {
            const currentConfig = await readConfig();
            const newPaths = await globalPaths();
            
            let pathsAdded = false;
            let pathsRemoved = false;
            
            // Ensure paths object exists
            if (!currentConfig.paths) {
                currentConfig.paths = {};
            }
            
            // Add new paths
            for (const remote of newPaths) {
                if (remote.proxy && !currentConfig.paths[remote.path]) {
                    currentConfig.paths[remote.path] = {
                        name: remote.path,
                        source: remote.proxy,
                        sourceOnDemand: true
                    };
                    pathsAdded = true;
                    console.error(`Added new path: ${remote.path}`);
                }
            }
            
            // Lazy cleanup with grace period
            const remotePaths = new Set(newPaths.map(p => p.path));
            const now = Date.now();
            
            for (const [pathName, pathConfig] of Object.entries(currentConfig.paths)) {
                if (!remotePaths.has(pathName)) {
                    // Track when path was first marked for cleanup
                    if (!pathConfig.cleanupMarkedAt) {
                        pathConfig.cleanupMarkedAt = now;
                    } else if (now - pathConfig.cleanupMarkedAt > CLEANUP_GRACE_PERIOD) {
                        delete currentConfig.paths[pathName];
                        pathsRemoved = true;
                        console.error(`Removed stale path: ${pathName}`);
                    }
                } else {
                    // Path exists in CloudTAK - clear cleanup marker
                    delete pathConfig.cleanupMarkedAt;
                }
            }
            
            if (pathsAdded || pathsRemoved) {
                writeConfig(defaultConfig(currentConfig));
                console.error(`Sync completed - ${Object.keys(currentConfig.paths).length} total paths`);
            }
        } catch (err) {
            console.error('Path sync failed:', err instanceof Error ? err.message : err);
        } finally {
            syncInProgress = false;
        }
    });

    console.error('Path sync started - checking every 10 seconds');
    console.error('Lazy cleanup enabled - 5 minute grace period');
}

export function defaultConfig(config: Record<string, any>): string {
    config.authMethod = 'http';
    config.authHTTPAddress = process.env.CLOUDTAK_URL + '/api/video/auth';
    config.authHTTPExclude = [];
    config.authInternalUsers = [];

    config.readTimeout = '10s';
    config.writeTimeout = '10s';
    
    // Path server handles on-demand requests via HTTP

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
        line = line.replace(/^rtspEncryption: no/, 'rtspEncryption: "no"');
        line = line.replace(/^rtmpEncryption: no/, 'rtmpEncryption: "no"');
        return line;
    }).join('\n');

    return configstr;
}

async function readConfig(): Promise<Record<string, any>> {
    try {
        const configData = await fsp.readFile('/opt/mediamtx/mediamtx.yml', 'utf8');
        return YAML.parse(configData);
    } catch (err) {
        console.error('Failed to read config file:', err instanceof Error ? err.message : err);
        throw new Error('Config file read failed');
    }
}

export function writeConfig(config: string): void {
    try {
        fs.writeFileSync('/opt/mediamtx/mediamtx.yml.new', config);
        // Ref: https://github.com/bluenviron/mediamtx/issues/937
        fs.renameSync(
            '/opt/mediamtx/mediamtx.yml.new',
            '/opt/mediamtx/mediamtx.yml'
        );
    } catch (err) {
        console.error('Failed to write config file:', err instanceof Error ? err.message : err);
        throw new Error('Config file write failed');
    }
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
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            let total = 0;
            const limit = 100;
            let page = 0;
            const paths = [];

            do {
                const url = new URL(process.env.CLOUDTAK_URL + '/api/video/lease');
                url.searchParams.append('limit', String(limit));
                url.searchParams.append('expired', 'false');
                url.searchParams.append('ephemeral', 'all');
                url.searchParams.append('impersonate', 'true');
                url.searchParams.append('page', String(page));

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer etl.${jwt.sign({ access: 'lease', id: 'any', internal: true }, process.env.SigningSecret)}`
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!res.ok) {
                    throw new Error(`CloudTAK API error: ${res.status} ${await res.text()}`);
                }

                const body = await res.json() as RemotePaths;
                total = body.total;
                paths.push(...body.items);
                ++page;
            } while (total > page * limit);

            return paths;
        } catch (err) {
            retryCount++;
            console.error(`CloudTAK API attempt ${retryCount}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
            
            if (retryCount >= maxRetries) {
                throw new Error(`CloudTAK API failed after ${maxRetries} attempts: ${err instanceof Error ? err.message : err}`);
            }
            
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
    }
    
    return []; // Should never reach here
}

export async function globalConfig(): Promise<any> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch('http://localhost:9997/v3/config/global/get', {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${Buffer.from(`management:${process.env.MediaSecret}`).toString('base64')}`
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`MediaMTX API error: ${res.status} ${await res.text()}`);
            }

            return await res.json();
        } catch (err) {
            retryCount++;
            console.error(`MediaMTX API attempt ${retryCount}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
            
            if (retryCount >= maxRetries) {
                throw new Error(`MediaMTX API failed after ${maxRetries} attempts: ${err instanceof Error ? err.message : err}`);
            }
            
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return {}; // Should never reach here
}
