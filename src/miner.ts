import process from 'node:process';
import {MinerNode} from './p2p/miner-node.js';

async function start() {

    const p2pNode = new MinerNode();

    console.log('MinerNode started.');

    process.on('SIGTERM', p2pNode.stop);
    process.on('SIGINT', p2pNode.stop);

    await p2pNode.start();
}

start().catch((error) => {
    console.error(error);
});

