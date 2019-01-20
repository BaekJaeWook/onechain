"use strict";
const CryptoJS = require("crypto-js");
const ecdsa = require("elliptic");

const ec = new ecdsa.ec("secp256k1");

// coinbase reward amount
// WARNING!! there are no a half-life period implementation here.
// Make it yourself if you need.
const COINBASE_AMOUNT = 50;

// UnspentTxOut
class UTXO {
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

class TxIn {
    constructor(txOutId, txOutIndex, signature) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.signature = signature;
    }
}

class TxOut {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}

class Transaction {
    constructor(id, txIns, txOuts) {
        this.id = id;
        this.txIns = txIns;
        this.txOuts = txOuts;
    }
}

function getTransactionId(transaction) {
    var txInContent = "";
    transaction.txIns.forEach(function (txIn) {
        // callback    
        txInContent += (txIn.txOutId + txIn.txOutIndex);
    });
    /*
     * Same as the following code.
     *
     * Using 'map' is preferred to avoid side effects.
     * But we use 'forEach' in this program,
     * because it improves not only readability
     * but usability about porting to the other PLs.
     */
    /*
        const txInContent = transaction.txIns
        .map((txIn) => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, '');
    */

    var txOutContent = "";
    transaction.txOuts.forEach(function (txOut) {
        txOutContent += (txOut.address + txOut.amount);
    });

    return CryptoJS.SHA256(txInContent + txOutContent).toString();
}

function validateTransaction(transaction, aUnspentTxOuts) {
    if (getTransactionId(transaction) !== transaction.id) {
        console.log("invalid tx id: " + transaction.id);
        return false;
    }

    var hasValidTxIns = true;
    transaction.txIns.forEach(function (txIn) {
        hasValidTxIns = hasValidTxIns && validateTxIn(txIn, transaction, aUnspentTxOuts);
    });
    if (!hasValidTxIns) {
        console.log("some of the txIns are invalid in tx: " + transaction.id);
        return false;
    }

    /// WARNING!! there are no consideration about fees.
    var totalTxInValues = 0;
    transaction.txIns.forEach(function (txIn) {
        totalTxInValues += getTxInAmount(txIn, aUnspentTxOuts);
    });
    var totalTxOutValues = 0;
    transaction.txOuts.forEach(function (txOut) {
        totalTxOutValues += txOut.amount;
    });
    if (totalTxInValues !== totalTxOutValues) {
        console.log("totalTxInValues !== totalTxOutValues in tx: " + transaction.id);
        return false;
    }

    return true;
}

function validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex) {
    const coinbaseTx = aTransactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log("invalid coinbase transaction: " + JSON.stringify(coinbaseTx));
        return false;
    }

    // check for duplicate txIns. Each txIn can be included only once
    var txIns = [];
    aTransactions.forEach(function (tx) {
        txIns = txIns.concat(tx.txIns);
    });
    if (hasDuplicates(txIns)) {
        return false;
    }

    // all but coinbase transactions
    const normalTransactions = aTransactions.slice(1);
    var hasValidTx = true;
    normalTransactions.forEach(function (tx) {
        hasValidTx = hasValidTx && validateTransaction(tx, aUnspentTxOuts);
    });
    return hasValidTx;
}

function hasDuplicates(txIns) {
    const uniq = Array.from(new Set(txIns));
    if (uniq.length === txIns.length) {
        return false;
    }

    return true;
}

function validateCoinbaseTx(transaction, blockIndex) {
    if (transaction == null) {
        console.log("the first transaction in the block must be coinbase transaction");
        return false;
    }

    if (getTransactionId(transaction) !== transaction.id) {
        console.log("invalid coinbase tx id: " + transaction.id);
        return false;
    }

    if (transaction.txIns.length !== 1) {
        console.log("one txIn must be specified in the coinbase transaction");
        return false;
    }

    if (transaction.txIns[0].txOutIndex !== blockIndex) {
        console.log("the txIn signature in coinbase tx must be the block height");
        return false;
    }

    if (transaction.txOuts.length !== 1) {
        console.log("invalid number of txOuts in coinbase transaction");
        return false;
    }

    if (transaction.txOuts[0].amount !== COINBASE_AMOUNT) {
        console.log("invalid coinbase amount in coinbase transaction");
        return false;
    }

    return true;
}

function validateTxIn(txIn, transaction, aUnspentTxOuts) {
    /*
     * The find() method returns the value of the first element
     * in the array that satisfies the provided testing function.
     * Otherwise undefined is returned.
     */
    const referencedUTxOut = aUnspentTxOuts.find(function (uTxO) {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    if (referencedUTxOut == null) {
        console.log("referenced txOut not found: " + JSON.stringify(txIn));
        return false;
    }

    const address = referencedUTxOut.address;
    const key = ec.keyFromPublic(address, "hex");
    const validSignature = key.verify(transaction.id, txIn.signature);
    if (!validSignature) {
        console.log("invalid txIn signature: %s txId: %s address: %s", txIn.signature, transaction.id, referencedUTxOut.address);
        return false;
    }

    return true;
}

function getTxInAmount(txIn, aUnspentTxOuts) {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
}

function findUnspentTxOut(transactionId, index, aUnspentTxOuts) {
    return aUnspentTxOuts.find(function (uTxO) {
        return uTxO.txOutId === transactionId && uTxO.txOutIndex === index;
    });
}

function getCoinbaseTransaction(address, blockIndex) {
    var t = new Transaction();
    var txIn = new TxIn();

    txIn.signature = "";
    txIn.txOutId = "";
    txIn.txOutIndex = blockIndex;

    t.txIns = [txIn];
    t.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
}

function signTxIn(transaction, txInIndex, privateKey, aUnspentTxOuts) {
    const ut = require("./utils");
    
    const txIn = transaction.txIns[txInIndex];
    const dataToSign = transaction.id;
    const referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
    if (referencedUnspentTxOut == null) {
        console.log("could not find referenced txOut");
        throw Error();
    }

    const referencedAddress = referencedUnspentTxOut.address;
    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log("trying to sign an input with private key " +
            "that does not match the address that is referenced in txIn");
        throw Error();
    }

    const key = ec.keyFromPrivate(privateKey, "hex");
    const signature = ut.toHexString(key.sign(dataToSign).toDER());
    return signature;
}

function updateUnspentTxOuts(aTransactions, aUnspentTxOuts) {
    var newUnspentTxOuts = [];
    aTransactions.forEach(function (t, index) {
        var eachUnspentTxOuts = [];
        t.txOuts.forEach(function (txOut, index) {
            eachUnspentTxOuts.push(new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
        });
        newUnspentTxOuts = newUnspentTxOuts.concat(eachUnspentTxOuts);
    });

    var consumedTxOuts = [];
    var eachConsumedTxOuts = [];
    aTransactions.forEach(function (t) {
        eachConsumedTxOuts = eachConsumedTxOuts.concat(t.txIns);
    });
    eachConsumedTxOuts.forEach(function (txIn) {
        consumedTxOuts.push(new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));
    });

    // Remains
    var resultingUnspentTxOuts = [];
    aUnspentTxOuts.forEach(function (uTxO) {
        if (!findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)) {
            resultingUnspentTxOuts.push(uTxO);
        }
    });
    /*
     * Same as the following code.
     * 
     * The filter() method creates a new array
     * with all elements that pass the test implemented by the provided function.
     */
    /*
        aUnspentTxOuts.filter(function (uTxO) {
            return !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts);
        })
    */

    // Gathering remains and new UTXOs
    resultingUnspentTxOuts = resultingUnspentTxOuts.concat(newUnspentTxOuts);
    return resultingUnspentTxOuts;
}

function processTransactions(aTransactions, aUnspentTxOuts, blockIndex) {
    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log("invalid block transactions");
        return null;
    }
    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
}

// WARNING!! the current implementation uses ECDSA public key cipher.
// The valid address is a valid ECDSA public key
// in the 04(prefix) + X-coordinate + Y-coordinate format.
function getPublicKey(aPrivateKey) {
    return ec.keyFromPrivate(aPrivateKey, "hex").getPublic().encode("hex");
}

function isValidAddress(address) {
    // 65 Bytes == 130 alphanumerics in hex string
    if (address.length !== 130) {
        console.log(address);
        console.log("invalid public key length");
        return false;
    }
    else if (address.match("^[a-fA-F0-9]+$") === null) {
        console.log("public key must contain only hex characters");
        return false;
    }
    else if (!address.startsWith("04")) {
        console.log("public key must start with 04");
        return false;
    }
    else {
        return true;
    }
}
