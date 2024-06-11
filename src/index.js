
window.Buffer = window.Buffer || require("buffer").Buffer;
const { load } = require('pe-library/cjs');

/*
static std::array<uint8_t, 16> keys[3] = {
    {'G', 'o', 'o', 'd', 'L', 'U', 'c', 'K', 'M', 'y', 'F', 'r', 'i', 'E', 'n', 'd'},
    {0xC9, 0x9B, 0x64, 0x96, 0x5C, 0xCE, 0x04, 0xF0, 0xF5, 0xCB, 0x54, 0xCA, 0xC9, 0xAB, 0x62, 0xC6}, // bunny works for 30/52
    {0x11, 0x14, 0x18, 0x14, 0x88, 0x82, 0x42, 0x82, 0x28, 0x24, 0x88, 0x82, 0x11, 0x18, 0x44, 0x11}  // time capsule works for 222/277/377
};
*/
const keys = [
    "476f6f644c55634b4d79467269456e64",
    "c99b64965cce04f0f5cb54cac9ab62c6",
    "11141814888242822824888211184411"
];

function swapkey(key) {
    const swap = function (data, a, b) {
        let t = data[a];
        data[a] = data[b];
        data[b] = t;
    }
    let tArray = Buffer.from(key, "hex");
    swap(tArray, 1, 4);
    swap(tArray, 2, 8);
    swap(tArray, 3, 12);
    swap(tArray, 6, 9);
    swap(tArray, 7, 13);
    swap(tArray, 11, 14);
    return tArray.toString("hex");
}

function toHex(str) {
    let hex, i;

    let result = "";
    for (i = 0; i < str.length; i++) {
        hex = str.charCodeAt(i).toString(16);
        result += ("0" + hex).slice(-2);
    }

    return result
}

/*
enum class AssetType : uint8_t {
    Text = 0,
    MapData = 1,
    Png = 2,
    Ogg = 3,
    SpriteData = 5,
    Shader = 7,
    Font = 8,

    Encrypted_XPS = 64,
    Encrypted_MapData = 65,
    Encrypted_Png = 66,
    Encrypted_Ogg = 67
};
*/


function a(id, name, extension) {
    return { id: id, name: name, extension: extension };
}

const AssetType = [
    a(0, "Text/XPS", ".txt"),
    a(1, "Map", ".map"),
    a(2, "Png", ".png"),
    a(3, "Ogg", ".ogg"),
    a(5, "Sprite", ".sprite"),
    a(6, "OldSprite?", ".sprite"),
    a(7, "Shader", ".shader"),
    a(8, "Font", ".font"),
]



/*struct asset_entry {
    AssetType type;
    uint8_t unknown1[7];

    uint64_t ptr; // offset by 0x140001200
    uint32_t length;

    uint32_t unknown2;
    uint64_t unknown3;

    uint8_t unknown4[16];
};*/

class AssetEntry {
    constructor(data, index) {
        this.type = data.readUInt32LE(0);
        this.ptr = Number(data.readBigUInt64LE(8));
        this.length = data.readUInt32LE(16);
        this.index = index;
    }
    get typeWithoutBits() {
        return this.type & 0b00111111;
    }
    getExtension() {
        let assetType = AssetType.find((assetType) => assetType.id == this.typeWithoutBits)
        if (assetType) {
            return assetType.extension;
        }
        return ".bin";
    }
    getAssetTypeName() {
        let result = "unknown(" + this.typeWithoutBits + ")";
        let assetType = AssetType.find((assetType) => assetType.id == this.typeWithoutBits)
        if (assetType) {
            result = assetType.name;
        }
        if (this.isEncrypted()) {
            result = "Encrypted " + result;
        }
        if (this.isUnknownFlag()) {
            result = "UnknownFlag " + result;
        }
        return result;

    }
    toString() {
        return `AssetEntry {index: ${this.index}, type: ${this.getAssetTypeName()}, ptr: ${this.ptr.toString(16)}, length: ${this.length} }`;
    }
    toPrettyString() {
        return `Asset ${this.index}, type: ${this.getAssetTypeName()}, length: ${this.length}  `;
    }
    parseData(exe) {
        let imageBase = exe.getImageBase();
        let rdataSection = exe.getAllSections().filter((section) => section.info.name === '.rdata')[0];
        let rdataBuffer = Buffer.from(rdataSection.data);
        // rdata_offset = section.rva + image_base;
        let rdata_offset = rdataSection.info.virtualAddress + imageBase;
        // auto dat = sections.rdata.subspan(asset.ptr - sections.rdata_pointer_offset, asset.length);
        let dat = rdataBuffer.slice(this.ptr - rdata_offset, this.ptr - rdata_offset + this.length);
        this.data = dat;
        if (this.data.length != this.length) {
            throw new Error("Data length mismatch. try change AssetEntry size");
        }
    }
    isEncrypted() {
        return (this.type & 64  // new version
            || this.type & 256 // old version
        ) > 0;
    }
    isUnknownFlag() {
        return (this.type & 128) > 0;
    }
    async tryDecrypt(doAlert = true) {
        if (!this.isEncrypted()) return this.data;
        let iv = this.data.slice(0, 16).toString("hex");
        iv = CryptoJS.enc.Hex.parse(iv);
        let enc = this.data.slice(16).toString("base64");
        for (const key of keys) {
            let decrypted = CryptoJS.AES1.decrypt(enc, CryptoJS.enc.Hex.parse(key), {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }).toString();
            // console.log(decrypted);
            if (decrypted.startsWith(swapkey(key))) {
                return Buffer.from(decrypted, "hex").slice(16);
            }
        }
        if (doAlert) {
            alert("error: all keys cannot decrypt this asset");
        }
        return false;
    }
}

function decryptTest() {
    iv = CryptoJS.enc.Hex.parse("101112131415161718191a1b1c1d1e1f");
    CryptoJS.AES1.encrypt("GoodLUcKMyFriEnd", CryptoJS.enc.Hex.parse("476f6f644c55634b4d79467269456e64"), { iv });
}

decryptTest();


function test(input) {

    load().then((PE) => {
        // window.PE = PE;
        // load and parse data
        let data = Buffer.from(input);
        // (the Node.js Buffer instance can be specified directly to NtExecutable.from)
        let exe = PE.NtExecutable.from(data);
        // window.exe = exe;
        // get section data

        let dataSection = exe.getAllSections().filter((section) => section.info.name === '.data')[0];
        let dataBuffer = Buffer.from(dataSection.data);

        let assetEntries = [];
        let ptr = 0;
        let i = 0;
        const sizeOfAssetEntry = Number(document.getElementById("sizeOfAssetEntry").options[document.getElementById("sizeOfAssetEntry").selectedIndex].value);
        if (isNaN(sizeOfAssetEntry)) {
            throw new Error("Invalid size of asset entry");
        }
        while (true) {
            let sliced = dataBuffer.slice(ptr, ptr + sizeOfAssetEntry);
            if (sliced.length < sizeOfAssetEntry) break;
            let entry = new AssetEntry(sliced, i);
            if (entry.length == 0) break;
            entry.parseData(exe);
            assetEntries.push(entry);

            ptr += sizeOfAssetEntry;
            i++;
        }
        window.assetEntries = assetEntries;
        let itemsDiv = document.getElementById("items");
        itemsDiv.innerHTML = "";
        assetEntries.forEach((entry) => {
            let div = document.createElement("div");
            div.innerText = entry.toPrettyString();
            let button = document.createElement("button");
            button.innerText = "Download";
            button.onclick = () => {
                downloadItem(entry);
            };
            div.appendChild(button);
            itemsDiv.appendChild(div);
        });
        if (assetEntries.length < 10) {
            log("too few items, try change AssetEntry size");
        }
    }).catch((err) => {
        window.console.error(err);
        log("error: " + err);
    });
}
async function downloadItem(entry) {
    let data = await entry.tryDecrypt();
    if (data === false) {
        return;
    }
    let blob = new Blob([data], { type: "application/octet-stream" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.style.display = "none";
    a.download = entry.index + entry.getExtension();
    a.href = url;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        a.remove();
        URL.revokeObjectURL(url);
    }, 1000);
}

async function extractEverything() {
    if (!window.assetEntries) {
        return;
    }
    let zip = new JSZip();
    let zipFolder = zip.folder("assets");
    for (let entry of window.assetEntries) {
        let data = await entry.tryDecrypt(false);
        if (data === false) {
            log(`error: cannot decrypt asset ${entry.index}， ignoring`);
            continue;
        }
        zipFolder.file(entry.index + entry.getExtension(), data);
    }
    let content = await zip.generateAsync({ type: "blob" });
    let url = URL.createObjectURL(content);
    let a = document.createElement("a");
    a.style.display = "none";
    a.download = "assets.zip";
    a.href = url;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        a.remove();
        URL.revokeObjectURL(url);
    }, 1000);
}
window.extractEverything = extractEverything;


/*
   std::string ext = ".bin";
            switch(item.type) {
                case AssetType::Text:
                    ext = ".txt";
                    break;
                case AssetType::MapData:
                case AssetType::Encrypted_MapData:
                    ext = ".map";
                    break;
                case AssetType::Png:
                case AssetType::Encrypted_Png:
                    ext = ".png";
                    break;
                case AssetType::Ogg:
                case AssetType::Encrypted_Ogg:
                    ext = ".ogg";
                    break;
                case AssetType::SpriteData:
                    ext = ".sprite";
                    break;
                case AssetType::Shader:
                    ext = ".shader";
                    break;
                case AssetType::Font:
                    ext = ".font";
                    break;
                case AssetType::Encrypted_XPS:
                    ext = ".xps";
                    break;
            }
                    */

window.test = test;