import {Block} from './block.js';
import {TransactionPool} from './transaction-pool.js';
import {Transaction} from './transaction.js';
import {startMining, stopMining} from './mining-status.js';
import {de} from '@faker-js/faker';

const MIN_DIFFICULTY = 1;
const TARGET_DURATION = 60;

export class Blockchain {
    private readonly chain: Block[];
    private readonly transactionPool: TransactionPool;
    private difficulty: number;

    constructor(chain: Block[] = [],
                transactionPool: TransactionPool = new TransactionPool(),
                difficulty: number = 5) {
        this.chain = chain;
        this.transactionPool = transactionPool;
        this.difficulty = difficulty;
    }

    getChain(): Block[] {
        return this.chain;
    }

    getLatestBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    getTransactionPool(): TransactionPool {
        return this.transactionPool;
    }

    async addBlock(block: Block) {
        const latestBlock = this.getLatestBlock();

        this.transactionPool.removeTransactionsById(block.transactions.map(transaction => transaction.id));

        this.difficulty = block.difficulty;
        if (block.miningDuration < TARGET_DURATION * 0.5) {
            this.difficulty += 1;
        } else if (block.miningDuration > TARGET_DURATION * 1.5) {
            this.difficulty = Math.max(MIN_DIFFICULTY, this.difficulty - 1);
        }

        console.info(`Adds Block {depth: ${block.depth}, miner: ${block.miner}, nonce: ${block.nonce}, timestamp: ${block.timestamp}, valid: ${block.valid}, difficulty: ${block.difficulty}, miningDuration: ${block.miningDuration} }`);
        if (!latestBlock) {
            this.chain.push(block);
            return;
        }

        if (block.previousHash !== latestBlock.getHash()) {
            throw new Error('Invalid block: previousHash does not match.');
        }

        if (!block.isValid()) {
            throw new Error('Invalid block: failed validation.');
        }

        this.chain.push(block);
    }

    async startMining(): Promise<Block | null> {
        startMining();
        const startTime = Date.now();

        let hash: string = '';
        let depth: number = 0;
        if (this.getLatestBlock()) {
            hash = this.getLatestBlock().hash;
            depth = this.getLatestBlock().depth;
            depth++;
        }

        const transactions: Transaction[] = this.transactionPool.getPool();

        const block: Block = new Block(transactions, hash, depth);
        await block.mineBlock(this.difficulty);

        if (!block.valid) {
            return null;
        }

        const endTime = Date.now();
        const miningDuration: number = ((endTime as number) - (startTime as number)) / 1000;
        block.setMiningDuration(miningDuration);
        console.log('Mining took', miningDuration, 'seconds');

        stopMining();
        return block;
    }

    isValid() {
        if (this.chain.length < 2) {
            return true;
        }
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const prevBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== prevBlock.hash) {
                return false;
            }
        }
        return true;
    }

    print(): void {
        let str: string = 'Blockchain {';
        this.chain.forEach((block) => {
            str += block.toString();
        });
        str += '\n}';
        console.info(str);
    }

    static from(blockchainString: string): Blockchain {
        const parsed = JSON.parse(blockchainString);
        const chain = parsed.chain.map((block: any) => Block.from(JSON.stringify(block)));
        const transactionPool = new TransactionPool(parsed.transactionPool.pool.map((tObj: any) => new Transaction(tObj.id, tObj.sender, tObj.recipient, tObj.amount, tObj.signature)));
        const difficulty = parsed.difficulty;
        return new Blockchain(chain, transactionPool, difficulty);
    }

}