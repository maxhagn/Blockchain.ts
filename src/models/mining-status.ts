let mining = false;

export const isMining = () => mining;

export const startMining = () => {
    mining = true;
    console.log('Set mining status to true.');
};

export const stopMining = () => {
    mining = false;
    console.log('Set mining status to false.');
};