import dns from 'dns';
import net from 'net';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.log('DATABASE_URL missing');
    process.exit(1);
}

const match = connectionString.match(/@([^:]+):(\d+)/);
if (!match) {
    console.log('Could not parse host/port from DATABASE_URL');
    process.exit(1);
}

const host = match[1];
const port = parseInt(match[2], 10);

console.log(`Target Host: ${host}`);

const results: Record<string, string> = {};

async function checkPort(port: number, name: string) {
    return new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        const start = Date.now();

        socket.connect(port, host, () => {
            results[name] = `✅ Open (${Date.now() - start}ms)`;
            socket.destroy();
            resolve();
        });

        socket.on('error', (err) => {
            results[name] = `❌ Error: ${err.message}`;
            resolve();
        });

        socket.on('timeout', () => {
            results[name] = `❌ Timeout`;
            socket.destroy();
            resolve();
        });
    });
}

async function checkOutbound() {
    return new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        socket.connect(53, '8.8.8.8', () => {
            results['Outbound (8.8.8.8:53)'] = `✅ Working`;
            socket.destroy();
            resolve();
        });
        socket.on('error', (err) => {
            results['Outbound (8.8.8.8:53)'] = `❌ Error: ${err.message}`;
            resolve();
        });
        socket.on('timeout', () => {
            results['Outbound (8.8.8.8:53)'] = `❌ Timeout`;
            socket.destroy();
            resolve();
        });
    });
}

dns.lookup(host, async (err, address, family) => {
    if (err) {
        console.log(`DNS Lookup: ❌ Failed (${err.message})`);
    } else {
        console.log(`DNS Lookup: ✅ Resolved to ${address} (IPv${family})`);

        await checkPort(port, `Port ${port} (DB)`);
        await checkPort(6543, `Port 6543 (Session)`);
        await checkPort(443, `Port 443 (HTTPS)`);
        await checkOutbound();

        console.log('\n--- RESULTS ---');
        console.table(results);
    }
});

