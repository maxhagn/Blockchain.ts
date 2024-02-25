import {Transaction} from './models/transaction.js';
import {generateKeyPairSync} from 'node:crypto';
import {ActorNode} from './p2p/actor-node.js';
import { faker } from '@faker-js/faker';
import process from 'node:process';
import { v4 as getUuid } from 'uuid';

const {privateKey, publicKey} = generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

function getRandomFloat(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

async function start() {

    const actorP2PNode = new ActorNode();
    console.log('ActorNode started.');

    process.on('SIGTERM', actorP2PNode.stop);
    process.on('SIGINT', actorP2PNode.stop);

    await actorP2PNode.start();

    setTimeout(() => {

        const transaction = new Transaction(getUuid(), 'Block Reward', 'Max', 50);
        transaction.signTransaction(privateKey);
        if (transaction.isValid(publicKey)) {
            actorP2PNode.broadcastTransaction(transaction);
        } else {
            console.error('Invalid transaction');
        }


        setInterval(() => {
            const transaction = new Transaction(getUuid(), faker.internet.userName(), faker.internet.userName(), getRandomFloat(0, 100000));
            transaction.signTransaction(privateKey);
            if (transaction.isValid(publicKey)) {
                actorP2PNode.broadcastTransaction(transaction);
            } else {
                console.error('Invalid transaction');
            }
        }, 200);
    }, 2000);

}

start().catch((error) => {
    console.error(error);
});

