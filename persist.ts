import cron from 'node-cron';
import YAML from 'yaml';

cron.schedule('0,10,20,30,40,50 * * * * *', async () => {
    try {
        const res = await fetch('http://localhost:9997/v3/config/global/get', {
            method: 'GET',
            headers: {
                Authorization: `Basic ${Buffer.from('management:' + process.env.MANAGEMENT_PASSWORD)}`
            }
        })

        console.error(JSON.stringify(res));
    } catch (err) {
        consoe.error(err);
    }
});
