import {createLibp2p, Libp2p} from 'libp2p';
import {tcp} from '@libp2p/tcp';
import {noise} from '@chainsafe/libp2p-noise';
import {yamux} from '@chainsafe/libp2p-yamux';
import {kadDHT, removePrivateAddressesMapper} from '@libp2p/kad-dht';
import {mdns} from '@libp2p/mdns';
import {Transaction} from '../models/transaction.js';
import * as lp from 'it-length-prefixed';
import process from 'node:process';
import {Connection, Stream} from '@libp2p/interface';

export class ActorNode {

    libp2p: Libp2p | null;

    constructor() {
        this.libp2p = null;
    }

    async start() {
        this.libp2p = await createLibp2p({
            addresses: {
                listen: ['/ip4/0.0.0.0/tcp/0']
            },
            transports: [tcp()],
            connectionEncryption: [noise()],
            streamMuxers: [yamux()],
            services: {
                dht: kadDHT({
                    protocol: '/ipfs/kad/1.0.0',
                    peerInfoMapper: removePrivateAddressesMapper,
                    clientMode: false
                })
            },
            peerDiscovery: [
                mdns()
            ]
        });

        this.libp2p.addEventListener('peer:discovery', async (peer: any) => {
            if (!this.libp2p) {
                console.error('P2P Node not initialized.');
                return;
            }
            //console.log('Discovered: ', JSON.stringify(peer.detail));
            await this.libp2p.dial(peer.detail.multiaddrs);
        });
        //console.log('Actor listening on addresses:');
        //this.libp2p.getMultiaddrs().forEach((addr: any) => {
        //    console.log(addr.toString());
        //});
    }

    async broadcastTransaction(transaction: Transaction) {
        if (!this.libp2p) {
            console.error('P2P Node not initialized.');
            return;
        }

        const data = JSON.stringify(transaction);
        const buffer = new TextEncoder().encode(data);

        for (let peer of this.libp2p.getPeers()) {
            const connection: Connection[] = this.libp2p.getConnections(peer);
            const encodedBuffer = lp.encode([buffer]);
            if (connection) {
                try {
                    const stream: Stream = await connection[0].newStream('/transaction/1.0.0');
                    await stream.sink(encodedBuffer);
                    await stream.close();
                } catch (error) {
                    console.error('Transaction could not be send ', error, '.');
                }
            }
        }
    }

    async stop() {
        if (this.libp2p) {
            await this.libp2p.stop();
        }
        console.log('');
        console.log('Actor has been stopped.');
        process.exit(0);
    }
}