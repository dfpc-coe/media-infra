import fs from 'node:fs/promises';
import cron from 'node-cron';
import YAML from 'yaml';

cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
    try {
        const base = await globalConfig();
        const paths = await globalPaths();

        base.paths = paths;

        await fs.writeFile('/opt/mediamtx/mediamtx.yml', YAML.stringify(base, (key, value) => {
            if (value instanceof Boolean) {
                return value === true ? 'yes' : 'no'
            } else {
                return value
            }
        }))
    } catch (err) {
        consoe.error(err);
    }
});

async function globalPaths(): any {
    let total = 0;
    let page = -1;
    let res: any;

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
        })

        const body = await res.json();

        total = body.itemCount;

        paths.push(...body.items);
    } while (total > page * 1000)

    return paths;
}

async function globalConfig(): any {
    const res = await fetch('http://localhost:9997/v3/config/global/get', {
        method: 'GET',
        headers: {
            Authorization: `Basic ${Buffer.from('management:' + process.env.MANAGEMENT_PASSWORD).toString('base64')}`
        }
    })

    const body = await res.json();

    return body;
}
