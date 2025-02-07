import os from 'node:os';
import YAML from 'yaml';
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

test('Create Read/Write Path/User', async (t) => {
    const uuid = 'pathrw';

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

    const res2 = await fetch(new URL(`http://localhost:9997/v3/config/global/get`), {
        headers: {
            Authorization: `Basic ${Buffer.from('management' + ':' + process.env.MANAGEMENT_PASSWORD).toString('base64')}`
        },
    });

    if (!res2.ok) {
        t.fail(await res2.text());
    }

    const current = await res2.json();

    current.authInternalUsers.push({
        user: 'pathrw-publish',
        permissions: [{
            action: 'publish',
            path: uuid
        }]
    })

    current.authInternalUsers.push({
        user: 'pathrw-read',
        permissions: [{
            action: 'read',
            path: uuid
        }]
    });

    const res3 = await fetch(new URL(`http://localhost:9997/v3/config/global/patch`), {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from('management' + ':' + process.env.MANAGEMENT_PASSWORD).toString('base64')}`
        },
        body: JSON.stringify({
            authInternalUsers: current.authInternalUsers
        })
    });

    if (!res2.ok) {
        t.fail(await res2.text());
    }

    t.end()
});

test('Read/Write Paths', async (t) => {
    const config = await persist();

    const fixture = new URL('./fixtures/ReadWritePaths.yml', import.meta.url);

    if (UPDATE) {
        fs.writeFileSync(fixture, config);
    }

    t.deepEqual(config, String(fs.readFileSync(fixture)));

    t.deepEquals(YAML.parse(config).authInternalUsers, [{
        user: 'management',
        pass: 'localtesting123',
        ips: [],
        permissions: [
            { action: 'publish' },
            { action: 'read' },
            { action: 'playback' },
            { action: 'api' },
            { action: 'metrics' },
            { action: 'pprof' }
        ]
    },{
        user: 'any',
        pass: '',
        ips: [],
        permissions: [
            { action: 'read', path: 'path0' },
            { action: 'publish', path: 'path0' },
            { action: 'read', path: 'path1' },
            { action: 'publish', path: 'path1' },
            { action: 'read', path: 'path2' },
            { action: 'publish', path: 'path2' },
            { action: 'read', path: 'path3' },
            { action: 'publish', path: 'path3' },
            { action: 'read', path: 'path4' },
            { action: 'publish', path: 'path4' }
        ]
    },{
        user: 'pathrw-publish',
        pass: '',
        ips: [],
        permissions: [
            { action: 'publish', path: 'pathrw' }
        ]
    },{
        user: 'pathrw-read',
        pass: '',
        ips: [],
        permissions: [
            { action: 'read', path: 'pathrw' }
        ]
    }])

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
