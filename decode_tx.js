const Web3 = require('web3');
const web3 = new Web3();

// Transaction data
const txData = {
  to: "0x504a0bdc3aea29237a6f8e53d0ecda8e4c9009f2", // EvermarkNFT contract
  value: "0x3faa25226000", // Value in hex
  input: "0x5e8a8f1f000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000035697066733a2f2f516d5975634e776746546b5a71424344574e6d526a586234644231777370783843634c55794d414b4d3747364a48000000000000000000000000000000000000000000000000000000000000000000000000000000000000265468652070726f6d69736520616e6420706572696c206f662070726f6a65637420636f696e730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a30783138413835616433343162324436413262643637666262313034423438323742393232613241336300000000000000000000000000000000000000000000"
};

// Convert hex to decimal for value
const valueInWei = web3.utils.toBN(txData.value);
const valueInEth = web3.utils.fromWei(valueInWei, 'ether');

console.log("Transaction Details:");
console.log("To (EvermarkNFT):", txData.to);
console.log("Value sent:", valueInEth, "ETH");
console.log("Value in Wei:", valueInWei.toString());

// Decode function selector
const functionSelector = txData.input.slice(0, 10);
console.log("\nFunction selector:", functionSelector);

// This appears to be mintEvermark(string,string,string)
// 0x5e8a8f1f = mintEvermark

// Decode the parameters
const params = '0x' + txData.input.slice(10);
const decoded = web3.eth.abi.decodeParameters(
  ['string', 'string', 'string'],
  params
);

console.log("\nDecoded Parameters:");
console.log("Metadata URI:", decoded[0]);
console.log("Title:", decoded[1]);
console.log("Creator:", decoded[2]);

// Parse the IPFS URL
if (decoded[0].startsWith('ipfs://')) {
  console.log("\nIPFS Gateway URL:", decoded[0].replace('ipfs://', 'https://ipfs.io/ipfs/'));
}
