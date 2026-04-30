const { Server } = require('ssh2');
const fs = require('fs');
const path = require('path');

class SftpServer {
    constructor(port = 2022) {
        this.port = port;
        this.server = new Server({
            hostKeys: [fs.readFileSync(path.join(__dirname, '../host.key'))]
        });
    }

    start() {
        this.server.on('connection', (client) => {
            console.log('SFTP client connected');

            client.on('authentication', (ctx) => {
                // TODO: Implement actual authentication against Panel/Database
                if (ctx.method === 'password' && ctx.username === 'admin' && ctx.password === 'password') {
                    return ctx.accept();
                }
                ctx.reject();
            }).on('ready', () => {
                client.on('session', (accept, reject) => {
                    const session = accept();
                    session.on('sftp', (accept, reject) => {
                        console.log('SFTP session started');
                        const sftp = accept();
                        // TODO: Implement SFTP logic (readdir, readfile, writefile)
                        // This would use fs-to-s3 or local fs with path restriction
                    });
                });
            });
        }).listen(this.port, '0.0.0.0', () => {
            console.log(`SFTP server listening on port ${this.port}`);
        });
    }
}

module.exports = SftpServer;
