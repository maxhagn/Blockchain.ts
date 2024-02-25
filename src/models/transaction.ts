import {createHash, createPrivateKey, createSign, createVerify, KeyObject} from 'node:crypto';

export class Transaction {
    public id: string;
    public sender: string;
    public recipient: string;
    public amount: number;
    public signature?: string;

    constructor(id: string, sender: string, recipient: string, amount: number, signature: string = '') {
        this.id = id;
        this.sender = sender;
        this.recipient = recipient;
        this.amount = amount;
        this.signature = signature
    }

    private calculateHash(): string {
        const data = this.sender + this.recipient + this.amount;
        return createHash('SHA256').update(data).digest('hex');
    }

    signTransaction(signingKey: string) {
        const signingKeyObject: KeyObject = createPrivateKey(signingKey);

        if (signingKeyObject.asymmetricKeyType !== 'ec' || signingKeyObject.type !== 'private') {
            throw new Error('The signing key is not a valid EC private key');
        }

        const sign = createSign('SHA256');
        sign.update(this.calculateHash());
        sign.end();

        this.signature = sign.sign(signingKeyObject, 'hex');
    }

    isValid(publicKey: string): boolean {
        if (!this.signature) {
            throw new Error('No signature in this transaction');
        }

        const verify = createVerify('SHA256');
        verify.update(this.calculateHash());
        verify.end();

        return verify.verify(publicKey, this.signature, 'hex');
    }

    toString(): string {
        const idStr = this.id.substring(0, 40).padEnd(40, ' ');
        const senderStr = this.sender.substring(0, 30).padEnd(30, ' ');
        const amountStr = this.amount.toString().substring(0, 25).padEnd(25, ' ');
        const recipientStr = this.recipient.substring(0, 30).padEnd(30, ' ');

        return `${idStr}: ${senderStr} \u27F6 ${recipientStr} | ${amountStr}`;
    }

}