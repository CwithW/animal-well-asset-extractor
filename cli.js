
globalThis.window = { console };
globalThis.log = console.log
window.CryptoJS = require("./extra/crypto-js.min.js");
window.JSZip = require("./extra/jszip.min.js");
require("./extra/aes1.js");
const tool = require("./src/index.js");
const fs = require('fs');

async function main() {

    let inputFile = process.argv[2];
    let outputFile = process.argv[3];
    if (!inputFile || !outputFile) {
        console.log("Usage: node cli.js <inputExeFile> <outputZipFile>");
    }
    let data = fs.readFileSync(inputFile);
    try {
        await tool.loadExe(data);
    } catch (e) {
        // console.log(e);
        window.sizeOfAssetEntry = 48;
        await tool.loadExe(data);
    }
    console.log("number of entries: "+window.assetEntries.length);
    let result = await tool.extractEverything();
    fs.writeFileSync(outputFile, result);
    console.log("extract to zip success")

}
main();