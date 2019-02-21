const CryptoJS = require("crypto-js");
const ecdsa = require("elliptic");
const ec = new ecdsa.ec("secp256k1");

// 이 데이터를 마음껏 복사해서 배포할 수 있음-
// 타임스탬프로 구분되기는 하나, 내가 발행하지 않았다는 증거가 없음?
// 중복 방지가 안 됨 <- 됨
// 중복된 데이터는 들고 있지 않아도 됨 <- 체크함
// 타임스탬프 없음! 블록에 있음
// 데이터에 대한 소유를 검증 <- UTXO 적용하면서 구조 바꿔야 함
// 지금은 데이터에 대한 소유만 집중
class Transaction {
    constructor(id, signature, owner, data) {
        this.id = id
        this.signature = signature
        this.owner = owner
        this.data = data
    }
}

// Coinbase Transaction
function getCoinbaseTransaction(blockIndex) {
    const owner = blockIndex.toString(); // 유일하게 소유자가 없는 트랜잭션
    const data = "Coinbase";

    var transaction = new Transaction(null, null, owner, data);
    const id = getTransactionId(transaction);
    transaction.id = id;

    return transaction;
}

function getTransactionId(transaction) {
    return CryptoJS.SHA256(transaction.owner + transaction.data).toString().toUpperCase();
}

function signTransactionId(transaction, privateKey) {
    const ut = require("./utils");

    // Get Public Key
    const key = ec.keyFromPrivate(privateKey, "hex");
    const publicKey = key.getPublic().encode("hex");
    if (publicKey !== transaction.owner) {
        console.log("Trying to sign an transaction with private key \
            that does not match the address of owner.");
        return null;
    }

    const dataToSign = transaction.id;
    const signature = ut.toHexString(key.sign(dataToSign).toDER());
    return signature;
};

function isValidTransactionSign(transaction) {
    const address = transaction.owner;
    const key = ec.keyFromPublic(address, "hex");
    const validSignature = key.verify(transaction.id, transaction.signature);
    if (!validSignature) {
        console.log("Invalid signature: %s, id: %s, address: %s",
            transaction.signature, transaction.id, transaction.owner);
        return false;
    }
    return true;
}

function isValidTransactionStructure(transaction) {
    return typeof (transaction.id) === 'string'
        && typeof (transaction.signature) === 'string'
        && typeof (transaction.owner) === 'string'
        && typeof (transaction.data) === 'string';
}

// https://regex101.com/r/JAOVej/1
function isValidAddress(address) {
    if (address.length !== 130) {
        console.log("Invalid public key length");
        return false;
    }
    else if (address.match("^[a-fA-F0-9]+$") === null) {
        console.log("Public key must contain only hex characters");
        return false;
    }
    else if (!address.startsWith("04")) {
        console.log("Public key must start with 04");
        return false;
    }
    return true;
}

function isValidTransaction(transaction) {
    if (!isValidTransactionStructure(transaction)) {
        console.log("Invalid transaction structure: %s", JSON.stringify(transaction));
        return false;
    }
    else if (getTransactionId(transaction) !== transaction.id) {
        console.log("Invalid transaction id: " + transaction.id);
        return false;
    }
    else if (!isValidTransactionSign(transaction)) {
        console.log("Invalid transaction signature: " + transaction.signature);
        return false;
    }
    else if (!isValidAddress(transaction.owner)) {
        console.log("Invalid transaction owner: " + transaction.owner);
        return false;
    }
    return true;
}

function isValidCoinbaseTransaction(transaction, blockIndex) {
    if (!isValidTransactionStructure(transaction)) {
        console.log("Invalid coinbase transaction structure: %s", JSON.stringify(transaction));
        return false;
    }
    else if (getTransactionId(transaction) !== transaction.id) {
        console.log("Invalid coinbase transaction id: " + transaction.id);
        return false;
    }
    else if (!isValidTransactionSign(transaction)) {
        console.log("Invalid coinbase transaction signature: " + transaction.signature);
        return false;
    }
    else if (transaction.owner !== blockIndex.toString()) {
        console.log("The signature in coinbase transaction must be the block height");
        return false;
    }
    return true;
}

module.exports = {
    isValidTransaction,
    isValidCoinbaseTransaction
};
