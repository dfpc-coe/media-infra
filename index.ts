import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import cors from 'cors';
import { config } from './lib/config.js';
import type { Config } from './lib/config.js';
import { sync, schedule } from './lib/persist.js';
import express from 'express';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from './lib/types.js';

const pkg = JSON.parse(String(fs.readFileSync(new URL('./package.json', import.meta.url))));
const SERVER_KEY_PATH = '/server.key';
const SERVER_CERT_PATH = '/server.crt';
const INTERNAL_AUTH_PORT = 9995;

process.on('uncaughtExceptionMonitor', (exception, origin) => {
    console.trace('FATAL', exception, origin);
});

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!process.env.API_URL) throw new Error('API_URL Env Var not set');
    if (!process.env.CLOUDTAK_Config_media_url) throw new Error('CLOUDTAK_Config_media_url Env Var not set');
    if (!process.env.SigningSecret) throw new Error('SigningSecret Env Var not set');

    await server(config);

    try {
        await sync(config);
    } catch (err) {
        console.error('warn - Failed initial sync (Will retry shortly):', err);
    }

    await schedule(config);
}

export default async function server(config: Config): Promise<void> {
    const app = express();

    app.disable('x-powered-by');
    app.use(cors({
        origin: '*',
        exposedHeaders: [
            'Content-Disposition'
        ],
        allowedHeaders: [
            'Content-Type',
            'Content-Length',
            'User-Agent',
            'Authorization',
            'x-requested-with'
        ],
        credentials: true
    }));

    app.get('/', (req, res) => {
        res.json({
            version: pkg.version
        });
    });

    const schema = new Schema(express.Router(), {
        prefix: '/',
        logging: {
            skip: function (req, res) {
                return res.statusCode <= 399 && res.statusCode >= 200;
            }
        },
        limit: 50,
        error: {
            400: StandardResponse,
            401: StandardResponse,
            403: StandardResponse,
            404: StandardResponse,
            500: StandardResponse
        }
    });

    app.use('/', schema.router);

    await schema.api();

    await schema.load(
        new URL('./routes/', import.meta.url),
        config,
        {
            silent: config.silent
        }
    );

    const tls = process.env.ACM_CERTIFICATE_ARN ? {
        key: fs.readFileSync(SERVER_KEY_PATH),
        cert: fs.readFileSync(SERVER_CERT_PATH)
    } : undefined;
    const protocol = tls ? 'https' : 'http';
    const nodeServer = tls ? https.createServer(tls, app) : http.createServer(app);
    const authServer = http.createServer(app);

    return new Promise((resolve) => {
        authServer.listen(INTERNAL_AUTH_PORT, '127.0.0.1', () => {
            nodeServer.listen(9997, () => {
                if (!config.silent) {
                    console.log(`ok - ${protocol}://localhost:9997`);
                    console.log(`ok - http://127.0.0.1:${INTERNAL_AUTH_PORT}`);
                }

                return resolve();
            });
        });
    });
}
