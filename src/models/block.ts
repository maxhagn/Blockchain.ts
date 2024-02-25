import * as crypto from 'crypto';
import {Transaction} from './transaction.js';
import {isMining} from './mining-status.js';
import {de} from '@faker-js/faker';
import {Hash} from 'node:crypto';

export class Block {
    depth: number;
    miner: string;
    nonce: number;
    hash: string;
    previousHash: string;
    timestamp: number;
    valid: boolean;
    difficulty: number;
    miningDuration: number;
    transactions: Transaction[];

    constructor(
        transactions: Transaction[],
        previousHash: string = '',
        depth: number = 0,
        miner: string = '',
        hash: string = '',
        nonce: number = 0,
        timestamp: number = Date.now(),
        valid: boolean = false,
        difficulty: number = 5,
        miningDuration: number = 0,
    ) {
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.depth = depth;
        this.miner = miner;
        this.nonce = nonce;
        this.timestamp = timestamp;
        this.hash = hash || this.calculateHash();
        this.valid = valid;
        this.difficulty = difficulty;
        this.miningDuration = miningDuration;
    }

    calculateHash(): string {
        const data = this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    setMiner(miner: string): void {
        this.miner = miner;
    }

    async mineBlock(difficulty: number) {
        this.difficulty = difficulty;

        const target = Array(difficulty + 1).join('0');

        while (isMining() && this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
            await new Promise(resolve => setImmediate(resolve));
        }

        if (this.hash.substring(0, difficulty) === target) {
            console.log('Block ', this.hash, ' mined.');
            this.valid = true;
        } // else {
           // console.log('Current block was destroyed.');
        //}
    }

    isValid(): boolean {
        return true;
    }

    setMiningDuration(miningDuration: number) {
        this.miningDuration = miningDuration;
    }

    getHash(): string {
        return this.hash;
    }

    toString() {
        //this.transactions = this.transactions.map((t: Transaction) => new Transaction(t.id, t.sender, t.recipient, t.amount, t.signature));
        let str = `\n    Block {\n        depth: ${this.depth},\n        miner: ${this.miner},\n        nonce: ${this.nonce},\n        hash: '${this.hash}',\n        previousHash: '${this.previousHash}',\n        timestamp: ${this.timestamp},\n        valid: ${this.valid},\n        difficulty: ${this.difficulty},\n        miningDuration: ${this.miningDuration},\n        transactions: [`;
        this.transactions.forEach((transaction: Transaction) => {
            str += `\n            ${transaction.toString()}`;
        });
        str += '\n        ]\n    }';
        return str;
    }

    static from(blockMessage: string): Block {
        const parsedMessage = JSON.parse(blockMessage);
        const transactions = parsedMessage.transactions.map((t: Transaction) => new Transaction(t.id, t.sender, t.recipient, t.amount, t.signature));
        return new Block(transactions, parsedMessage.previousHash, parsedMessage.depth, parsedMessage.miner, parsedMessage.hash, parsedMessage.nonce, parsedMessage.timestamp, parsedMessage.valid, parsedMessage.difficulty, parsedMessage.miningDuration);
    }
}