import {createLibp2p, Libp2p} from 'libp2p';
import {noise} from '@chainsafe/libp2p-noise';
import {yamux} from '@chainsafe/libp2p-yamux';
import {tcp} from '@libp2p/tcp';
import type {Connection, Stream, Peer} from '@libp2p/interface';
import {mdns} from '@libp2p/mdns';
import {kadDHT, removePrivateAddressesMapper} from '@libp2p/kad-dht';
import {Blockchain} from '../models/blockchain.js';
import process from 'node:process';
import {Block} from '../models/block.js';
import {toString as uint8ArrayToString} from 'uint8arrays/to-string';
import * as lp from 'it-length-prefixed';
import map from 'it-map';
import {stopMining, isMining} from '../models/mining-status.js';


export class MinerNode {

    libp2p: Libp2p | null;
    blockchain: Blockchain;
    receiving: boolean;
    setUp: boolean;

    constructor() {
        this.blockchain = new Blockchain();
        this.libp2p = null;
        this.receiving = false;
        this.setUp = false;
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

        await this.libp2p.handle('/block/1.0.0', async ({stream}: { stream: Stream }) => {
            this.receiving = true;
            //console.log('Received new block.');
            stopMining();

            try {
                const buffer = lp.decode(stream.source);
                const decodedBuffer = map(buffer, (buf) => uint8ArrayToString(buf.subarray()));
                for await (const blockStr of decodedBuffer) {
                    let block: Block = Block.from(JSON.stringify(JSON.parse(blockStr)));

                    if (this.blockchain.getLatestBlock() && block.previousHash !== this.blockchain.getLatestBlock().getHash()) {
                        this.setUp = false;
                        console.error('Hash does not match. Switch to setup mode.');
                        this.requestBlockchain().then(() => {
                            this.setUp = true;
                            console.info('Blockchain was updated.');
                        });
                        return;
                    }

                    this.blockchain.addBlock(block).then();
                }

            } catch (error) {
                console.error('Error processing block stream:', error);
            } finally {
                await stream.close();
                this.receiving = false;
            }
        });

        await this.libp2p.handle('/blockchain/1.0.0', async ({stream}: { stream: Stream }) => {
            //console.log('Blockchain requested.');
            this.sendBlockchain(stream, this.blockchain).then(() => {
                //console.log('Blockchain send.');
            });
        });

        await this.libp2p.handle('/transaction/1.0.0', async ({stream}: { stream: Stream }) => {
            //console.log('Received new transaction.');

            const buffer = lp.decode(stream.source);
            const decodedBuffer = map(buffer, (buf) => uint8ArrayToString(buf.subarray()));

            for await (const transaction of decodedBuffer) {
                this.blockchain.getTransactionPool().addTransaction(JSON.parse(transaction));
            }

            await stream.close();

            if (this.setUp && !isMining() && !this.receiving) {
                setImmediate(() => this.blockchain.startMining().then((block: Block | null) => {
                    if (block && this.libp2p?.peerId.toString()) {
                        block = Block.from(JSON.stringify(block));
                        block.setMiner(this.libp2p?.peerId.toString())
                        this.blockchain.addBlock(block);
                        this.broadcastBlock(block);
                        this.blockchain.print();
                    }
                }));
            }
        });

        this.libp2p.addEventListener('peer:discovery', async (peer: any) => {
            if (!this.libp2p) {
                console.error('P2P Node not initialized.');
                return;
            }
            //console.log('Discovered: ', JSON.stringify(peer.detail));
            await this.libp2p.dial(peer.detail.multiaddrs);
        });

        this.libp2p.addEventListener('peer:connect', async (peer: any) => {
            if (!this.libp2p) {
                console.error('P2P Node not initialized.');
                return;
            }
            console.log('Connected: ', JSON.stringify(peer.detail));
            //console.log('All connected peers: ', JSON.stringify(this.libp2p.getPeers()));
        });

        //console.log('Miner listening on addresses:');
        //this.libp2p.getMultiaddrs().forEach((addr: any) => {
        //    console.log(addr.toString());
        //});

        setTimeout(async () => {
            await this.requestBlockchain().then(() => {
                this.setUp = true;
            });
        }, 3000);

    }

    async stop() {
        if (this.libp2p) {
            await this.libp2p.stop();
        }
        console.log('');
        console.log('Miner has been stopped.');
        process.exit(0);
    }

    async broadcastBlock(block: Block) {
        if (!this.libp2p) {
            console.error('P2P Node not initialized.');
            return;
        }

        const data = JSON.stringify(block);

        const peers: Peer[] = await this.libp2p.peerStore.all();
        ///console.info('Distributes mined block to ', JSON.stringify(peers), '.');
        for (const peer of peers) {
            const buffer = new TextEncoder().encode(data);
            const encodedBuffer = lp.encode([buffer]);
            try {
                const connection = this.libp2p.getConnections(peer.id)[0];
                if (connection) {
                    const stream = await connection.newStream('/block/1.0.0');
                    await stream.sink(encodedBuffer);
                    await stream.close();
                }
            } catch (error) {
                const e = error as { code?: string };
                if (e.code === 'ERR_UNSUPPORTED_PROTOCOL') {
                    //console.info('Actor was reached.');
                    return;
                }
                console.error('Block could not be send ', e, '.');
            }
        }
    }

    async sendBlockchain(stream: Stream, blockchain: Blockchain) {
        if (!this.libp2p) {
            console.error('P2P Node not initialized.');
            return;
        }

        const data = JSON.stringify(blockchain);
        const buffer = new TextEncoder().encode(data);
        const encodedBuffer = lp.encode([buffer]);

        try {
            await stream.sink(encodedBuffer);
            await stream.close();
        } catch (error) {
            const e = error as { code?: string };
            if (e.code === 'ERR_UNSUPPORTED_PROTOCOL') {
                //console.info('Actor was reached.');
                return;
            }
            console.error('Block could not be send ', e, '.');
        }
    }

    async requestBlockchain() {
        if (!this.libp2p) {
            console.error('P2P Node not initialized.');
            return;
        }

        const peers: Peer[] = await this.libp2p.peerStore.all();
        for (const peer of peers) {
            console.info('Requests blockchain from ', peer.id.toString(), '.');
            try {
                const connection = this.libp2p.getConnections(peer.id)[0];
                if (connection) {
                    const stream = await connection.newStream('/blockchain/1.0.0');

                    const buffer = lp.decode(stream.source);
                    const decodedBuffer = map(buffer, (buf) => uint8ArrayToString(buf.subarray()));

                    for await (const blockchainMessage of decodedBuffer) {
                        let blockchain: Blockchain = Blockchain.from(blockchainMessage);
                        if (blockchain.getChain().length > 0) {
                            for (let block of blockchain.getChain()) {
                                block = Block.from(JSON.stringify(block));
                                this.blockchain.addBlock(block).then(
                                    () => {
                                        console.log('Chain initialized.');
                                    }
                                );
                            }
                        }
                    }

                    await stream.close();
                }
            } catch (error) {
                const e = error as { code?: string };
                if (e.code === 'ERR_UNSUPPORTED_PROTOCOL') {
                    //console.info('Actor was reached.');
                    return;
                }
                console.error('Block could not be send ', e, '.');
            }
        }
    }
}