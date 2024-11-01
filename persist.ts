import fs from 'node:fs/promises';
import cron from 'node-cron';
import YAML from 'yaml';

cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
    try {
        const base = await globalConfig();
        const paths = await globalPaths();

        base.paths = {};

        for (const path of paths) {
            base.paths[path.name] = path;
        }

        let config = YAML.stringify(base, (key, value) => {
            if (typeof value === 'boolean') {
                return value === true ? 'yes' : 'no';
            } else {
                return value;
            }
        });

        // This is janky but MediaMTX wants `no` as a string and not a boolean
        // and I can't get the YAML library to respect that...
        config = config.split('\n').map((line) => {
            line = line.replace(/^encryption: no/, 'encryption: "no"');
            line = line.replace(/^rtmpEncryption: no/, 'rtmpEncryption: "no"');
            return line;
        }).join('\n');

        console.log(config);

        await fs.writeFile('/opt/mediamtx/mediamtx.yml', config);
    } catch (err) {
        console.error(err);
    }
});

async function globalPaths(): any {
    let total = 0;
    let page = -1;

    const paths = [];

    do {
        ++page;

        const url = new URL('http://localhost:9997/v3/config/paths/list');
        url.searchParams.append('itemsPerPage', '1000');
        url.searchParams.append('page', String(page));

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Basic ${Buffer.from('management:' + process.env.MANAGEMENT_PASSWORD).toString('base64')}`
            }
        });

        const body = await res.json();

        total = body.itemCount;

        paths.push(...body.items);
    } while (total > page * 1000);

    return paths;
}

async function globalConfig(): any {
    const res = await fetch('http://localhost:9997/v3/config/global/get', {
        method: 'GET',
        headers: {
            Authorization: `Basic ${Buffer.from('management:' + process.env.MANAGEMENT_PASSWORD).toString('base64')}`
        }
    });

    const body = await res.json();

    return body;
}
