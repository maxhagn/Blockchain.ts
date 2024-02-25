import {Transaction} from './transaction.js';

export class TransactionPool {
    pool: Transaction[];

    constructor(pool: Transaction[] = []) {
        this.pool = pool;
    }

    getPool(): Transaction[] {
        return JSON.parse(JSON.stringify(this.pool));
    }

    getTransaction(): Transaction | undefined {
        return this.pool.pop();
    }

    addTransaction(transaction: Transaction) {
        this.pool.push(transaction)
    }

    removeTransactionsById(ids: string[]): void {
        this.pool = this.pool.filter(transaction => !ids.includes(transaction.id));
    }

    print(): void {
      console.log('Current pool is ', this.pool, '.');
    }
}