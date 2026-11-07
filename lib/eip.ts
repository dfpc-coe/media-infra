import net from 'node:net';
import { EC2Client, AssociateAddressCommand, DescribeAddressesCommand } from '@aws-sdk/client-ec2';

const IMDS = 'http://169.254.169.254/latest';
const MEDIAMTX_API_PORT = 4000;

export async function instanceId(): Promise<string> {
    const token = await fetch(`${IMDS}/api/token`, {
        method: 'PUT',
        headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '300' },
        signal: AbortSignal.timeout(2000)
    });
    if (!token.ok) throw new Error(`IMDS token request failed: ${token.status}`);

    const res = await fetch(`${IMDS}/meta-data/instance-id`, {
        headers: { 'X-aws-ec2-metadata-token': await token.text() },
        signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) throw new Error(`IMDS instance-id request failed: ${res.status}`);

    return res.text();
}

export function portOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host });
        socket.setTimeout(1000);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('error', () => resolve(false));
    });
}

export class EIP {
    allocationId: string;
    instance: string;
    ec2: EC2Client;

    constructor(allocationId: string, instance: string) {
        this.allocationId = allocationId;
        this.instance = instance;
        this.ec2 = new EC2Client({});
    }

    async reconcile(): Promise<boolean> {
        const res = await this.ec2.send(new DescribeAddressesCommand({
            AllocationIds: [this.allocationId]
        }));

        const current = res.Addresses?.[0]?.InstanceId;
        if (current === this.instance) return false;

        await this.ec2.send(new AssociateAddressCommand({
            AllocationId: this.allocationId,
            InstanceId: this.instance,
            AllowReassociation: true
        }));

        console.log(`ok - associated EIP ${this.allocationId} with ${this.instance} (was ${current || 'unassociated'})`);

        return true;
    }

    static async start(allocationId: string, interval = 60000): Promise<EIP> {
        const eip = new EIP(allocationId, await instanceId());

        while (!await portOpen(MEDIAMTX_API_PORT)) {
            console.log(`ok - waiting for MediaMTX on :${MEDIAMTX_API_PORT} before claiming EIP`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        const tick = async () => {
            try {
                await eip.reconcile();
            } catch (err) {
                console.error('warn - EIP reconcile failed (will retry):', err);
            }
        };

        await tick();
        setInterval(tick, interval);

        return eip;
    }
}
