const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'host.key');
if (!fs.existsSync(keyPath)) {
    console.log('Generating SSH host key...');
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    fs.writeFileSync(keyPath, privateKey);
    console.log('Host key generated.');
}
