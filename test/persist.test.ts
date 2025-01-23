import os from 'node:os';
import { randomUUID } from 'node:crypto';
import persist from '../persist.js';
import fs from 'node:fs'
import CP from 'node:child_process';
import test from 'tape';

const UPDATE = process.env.UPDATE;
process.env.MANAGEMENT_PASSWORD = 'localtesting123'

test('Start Docker', async (t) => {
    const version = String(fs.readFileSync(new URL('../Dockerfile', import.meta.url))).split('\n')[0].replace(/FROM\s+/, '');

    const tmp = os.tmpdir();

    t.pass(tmp);

    const docker = CP.spawn('docker', ['compose', 'up', '--build'], {
        cwd: new URL('../', import.meta.url).pathname
    });

    docker.stderr.pipe(process.stderr);

    await new Promise((resolve, reject) => {
        docker.stdout.on('data', (data) => {
            const log = String(data);

            console.log(log);

            if (log.includes('listener opened on :9997')) {
                return resolve();
            }
        })
    });

    t.end();
});

test('Create Basic Path', async (t) => {
    for (let i = 0; i < 5; i++) {
        const uuid = `path${i}`;

        const res = await fetch(new URL(`http://localhost:9997/v3/config/paths/add/${uuid}`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from('management' + ':' + process.env.MANAGEMENT_PASSWORD).toString('base64')}`
            },
            body: JSON.stringify({
                name: uuid
            })
        });

        if (!res.ok) {
            t.fail(await res.text());
        }
    }

    t.end()
});

test('Simple Paths', async (t) => {
    const config = await persist();

    const fixture = new URL('./fixtures/SimplePaths.yml', import.meta.url);

    if (UPDATE) {
        fs.writeFileSync(fixture, config);
    }

    t.deepEqual(config, String(fs.readFileSync(fixture)));

    t.end()
});

test('Stop Docker', async (t) => {
    const docker = CP.spawn('docker', ['compose', 'kill'], {
        cwd: new URL('../', import.meta.url).pathname
    });

    docker.stderr.pipe(process.stderr);
    docker.stdout.pipe(process.stdout);

    t.end();
});
