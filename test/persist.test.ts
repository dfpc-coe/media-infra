import os from 'node:os';
import persist from '../persist.js';
import fs from 'node:fs'
import CP from 'node:child_process';
import test from 'tape';

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

test('Simple Paths', async (t) => {
    const config = await persist();

    console.error(config);

    t.end()
})

test('Stop Docker', async (t) => {
    const docker = CP.spawn('docker', ['compose', 'kill'], {
        cwd: new URL('../', import.meta.url).pathname
    });

    docker.stderr.pipe(process.stderr);
    docker.stdout.pipe(process.stdout);

    t.end();
});
