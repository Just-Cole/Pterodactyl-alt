const { Server } = require('ssh2');
const fs = require('fs');
const path = require('path');

class SftpServer {
    constructor(port = 2022) {
        this.port = port;
        this.hostKeyPath = path.join(__dirname, '../host.key');
        
        // Generate a host key if it doesn't exist
        if (!fs.existsSync(this.hostKeyPath)) {
            console.log('[SFTP] No host key found. Generating one...');
            // In a real production environment, you'd use ssh-keygen.
            // For now, we assume the user has one or we use a dummy for the blitz.
        }

        this.server = new Server({
            hostKeys: [fs.readFileSync(this.hostKeyPath)]
        });
    }

    start() {
        this.server.on('connection', (client) => {
            let authenticated = false;
            let userUUID = '';

            client.on('authentication', (ctx) => {
                const methods = ctx.method === 'none' ? ['password'] : [];
                if (ctx.method === 'password' && ctx.password === process.env.WINGS_TOKEN) {
                    authenticated = true;
                    const parts = ctx.username.split('.');
                    userUUID = parts.length > 1 ? parts[1] : '';
                    return ctx.accept();
                }
                ctx.reject(methods);
            }).on('ready', () => {
                client.on('session', (accept, reject) => {
                    const session = accept();
                    session.on('sftp', (accept, reject) => {
                        const sftp = accept();
                        const root = 'C:\\ptero\\volumes';

                        sftp.on('REALPATH', (id, p) => {
                            let target = p === '.' || p === '/' ? '/' : p;
                            sftp.realpath(id, target);
                        });

                        sftp.on('OPENDIR', (id, p) => {
                            const fullPath = path.join(root, userUUID, p);
                            if (!fs.existsSync(fullPath)) return sftp.status(id, 2); // No such file
                            fs.readdir(fullPath, (err, files) => {
                                if (err) return sftp.status(id, 4); // Failure
                                sftp.handle(id, Buffer.from(fullPath));
                            });
                        });

                        sftp.on('READDIR', (id, handle) => {
                            const fullPath = handle.toString();
                            fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
                                if (err || !files.length) return sftp.status(id, 1); // EOF
                                const attrs = files.map(f => {
                                    const s = fs.statSync(path.join(fullPath, f.name));
                                    return {
                                        filename: f.name,
                                        longname: `${f.isDirectory() ? 'd' : '-'}rwxr-xr-x 1 ptero ptero ${s.size} ${s.mtime.toDateString()} ${f.name}`,
                                        attrs: { mode: f.isDirectory() ? 0o40755 : 0o100644, size: s.size, atime: s.atimeMs/1000, mtime: s.mtimeMs/1000 }
                                    };
                                });
                                sftp.name(id, attrs);
                                sftp.status(id, 1); // EOF after one read for simplicity
                            });
                        });

                        sftp.on('OPEN', (id, p, flags, attrs) => {
                            const fullPath = path.join(root, userUUID, p);
                            const mode = (flags & 0x0001) ? 'r' : 'w'; // Simplistic flag check
                            fs.open(fullPath, mode, (err, fd) => {
                                if (err) return sftp.status(id, 4);
                                sftp.handle(id, Buffer.from(fd.toString()));
                            });
                        });

                        sftp.on('READ', (id, handle, offset, length) => {
                            const fd = parseInt(handle.toString());
                            const buffer = Buffer.alloc(length);
                            fs.read(fd, buffer, 0, length, offset, (err, bytesRead) => {
                                if (err) return sftp.status(id, 4);
                                if (bytesRead === 0) return sftp.status(id, 1); // EOF
                                sftp.data(id, buffer.slice(0, bytesRead));
                            });
                        });

                        sftp.on('WRITE', (id, handle, offset, data) => {
                            const fd = parseInt(handle.toString());
                            fs.write(fd, data, 0, data.length, offset, (err) => {
                                if (err) return sftp.status(id, 4);
                                sftp.status(id, 0); // OK
                            });
                        });

                        sftp.on('CLOSE', (id, handle) => {
                            const fd = parseInt(handle.toString());
                            if (!isNaN(fd)) fs.close(fd, () => sftp.status(id, 0));
                            else sftp.status(id, 0);
                        });
                        
                        sftp.on('STAT', (id, p) => {
                            const fullPath = path.join(root, userUUID, p);
                            if (!fs.existsSync(fullPath)) return sftp.status(id, 2);
                            const s = fs.statSync(fullPath);
                            sftp.attrs(id, { mode: s.isDirectory() ? 0o40755 : 0o100644, size: s.size, atime: s.atimeMs/1000, mtime: s.mtimeMs/1000 });
                        });

                        sftp.on('REMOVE', (id, p) => {
                            const fullPath = path.join(root, userUUID, p);
                            fs.unlink(fullPath, (err) => sftp.status(id, err ? 4 : 0));
                        });

                        sftp.on('RMDIR', (id, p) => {
                            const fullPath = path.join(root, userUUID, p);
                            fs.rmdir(fullPath, { recursive: true }, (err) => sftp.status(id, err ? 4 : 0));
                        });

                        sftp.on('MKDIR', (id, p) => {
                            const fullPath = path.join(root, userUUID, p);
                            fs.mkdir(fullPath, { recursive: true }, (err) => sftp.status(id, err ? 4 : 0));
                        });

                        sftp.on('RENAME', (id, oldP, newP) => {
                            fs.rename(path.join(root, userUUID, oldP), path.join(root, userUUID, newP), (err) => sftp.status(id, err ? 4 : 0));
                        });
                    });
                });
            });
        }).listen(this.port, '0.0.0.0', () => {
            console.log(`[SFTP] Server listening on port ${this.port}`);
        });
    }
}

module.exports = SftpServer;
