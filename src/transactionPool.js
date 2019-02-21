/**
 * Relay transaction to 
 */

const tx = require("./transaction");

var transactionPool = [];

function getTransactionPool() { return transactionPool; }

function addToTransactionPool(transaction) {
    const bc = require("./blockchain");

    if (!tx.isValidTransaction(transaction)) {
        console.log("Invalid transaction");
        return false;
    }
    else if (!isValidTransactionForPool(transaction, transactionPool)) {
        console.log("Trying to add invalid transaction to pool");
        return false;
    }
    else if (!isValidTransactionForChain(transaction, bc.getBlockchain())) {
        console.log("Trying to add invalid transaction to blockchain");
        return false;
    }
    console.log("Adding to transactionPool: %s", JSON.stringify(transaction));
    transactionPool.push(transaction);
    return true;
}

function isValidTransactionPool(transactionToValidate, blockIndex) {
    const coinbase = transactionToValidate[0];
    if (!tx.isValidCoinbaseTransaction(coinbase, blockIndex)) {
        console.log("Invalid coinbase transaction: %s", JSON.stringify(coinbase));
        return false;
    }
    else if (hasDuplicates(transactionToValidate)) {
        return false;
    }
    for (var i = 1; i < transactionToValidate.length; i++) {
        if (!tx.validateTransaction(transactionToValidate[i])) {
            return false;
        }
    }
    return true;
}

function isValidTransactionForPool(transaction, aTtransactionPool) {
    return !aTtransactionPool.includes(transaction);
}

function isValidTransactionForChain(transaction, aBlockchain) {
    return !aBlockchain.map(function (block) {
        return block.data;
    }).includes(transaction);
}

function hasDuplicates(aTransactionPools) {
    const uniq = Array.from(new Set(aTransactionPools));
    if (uniq.length === aTransactionPools.length) {
        return false;
    }
    return true;
}

module.exports = {
    getTransactionPool
};
