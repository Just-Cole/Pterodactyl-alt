const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

const processManager = require('./src/ProcessManager');
const SftpServer = require('./src/SftpServer');
const runtimeManager = require('./src/RuntimeManager');

const app = express();
const PORT = process.env.WINGS_PORT || 8080;

// Initialize SFTP
const sftpServer = new SftpServer(process.env.SFTP_PORT || 2022);
sftpServer.start();

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

// Global Handshake Spy
app.use((req, res, next) => {
    console.log(`[SPY] ${req.method} ${req.url}`);
    next();
});

// Authentication Guard
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && (authHeader.trim() === `Bearer ${process.env.WINGS_TOKEN}` || authHeader.trim().endsWith(process.env.WINGS_TOKEN.split('.')[1] || ''))) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// --- FILE MANAGER (VIP ROUTE - Captures raw data before global JSON parser) ---
app.post('/api/servers/:uuid/files/write', authenticate, express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
    const file = req.query.file || req.query.path;
    const filePath = path.join('C:', 'ptero', 'volumes', req.params.uuid, file);
    console.log(`[EDITOR] Writing: ${file}`);
    
    try {
        const parentDir = path.dirname(filePath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

        let content = req.body;
        if (Buffer.isBuffer(content)) {
            const rawString = content.toString();
            try {
                const json = JSON.parse(rawString);
                if (json && json.content !== undefined) content = json.content;
                else content = rawString;
            } catch (e) { content = rawString; }
        }

        fs.writeFileSync(filePath, content);
        res.status(204).send();
    } catch (e) { 
        console.error(`[WRITE ERROR] ${e.message}`);
        res.status(500).json({ error: e.message }); 
    }
});

// --- GLOBAL MIDDLEWARE ---
app.use(express.json({ limit: '500mb' }));
app.use(express.text({ type: 'text/*', limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
// System Info & Health Check
app.get('/api/system', authenticate, (req, res) => res.json({
    version: '1.0.0-win-blitz',
    architecture: 'windows',
    kernel: process.platform,
    os: 'windows',
    cpu_count: require('os').cpus().length
}));

// Server Discovery
app.get('/api/servers', authenticate, (req, res) => {
    const list = Array.from(processManager.processes.keys()).map(uuid => {
        const proc = processManager.processes.get(uuid);
        return {
            uuid,
            status: (proc && proc.is_installing) ? 'installing' : (processManager.getState(uuid) || 'offline'),
            is_suspended: false
        };
    });
    res.json({ servers: list });
});

app.get('/api/servers/:uuid', authenticate, (req, res) => {
    const { uuid } = req.params;
    const proc = processManager.processes.get(uuid) || {};
    res.json({
        uuid,
        status: proc.is_installing ? 'installing' : (processManager.getState(uuid) || 'offline'),
        is_suspended: false,
        task_count: 0
    });
});

// --- FILE MANAGER MEGA-SUITE ---
app.get('/api/servers/:uuid/files/list-directory', authenticate, (req, res) => {
    const dir = req.query.directory || '/';
    const fullPath = path.join('C:', 'ptero', 'volumes', req.params.uuid, dir);
    
    try {
        if (!fs.existsSync(fullPath)) return res.json([]);
        const list = fs.readdirSync(fullPath, { withFileTypes: true })
            .filter(f => !['ptero_start.bat', 'install.ps1', 'install.sh'].includes(f.name)) // STEALH MODE
            .map(f => {
                const p = path.join(fullPath, f.name);
                let s = { size: 0, mtime: new Date(), atime: new Date(), ctime: new Date() };
                try { s = fs.statSync(p); } catch (e) {}
                
                const isDir = f.isDirectory();
                const mime = isDir ? 'inode/directory' : 'text/plain';

                return {
                    name: f.name,
                    size: s.size,
                    is_file: !isDir,
                    is_symlink: f.isSymbolicLink(),
                    mimetype: mime,
                    mime: mime,
                    modified_at: s.mtime.toISOString(),
                    created_at: s.ctime.toISOString(),
                    is_editable: !isDir,
                    mode: isDir ? 'drwxr-xr-x' : '-rw-r--r--',
                    file: !isDir,
                    directory: isDir
                };
            });
        res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/servers/:uuid/files/contents', authenticate, (req, res) => {
    const file = req.query.file || req.query.path;
    const filePath = path.join('C:', 'ptero', 'volumes', req.params.uuid, file);
    console.log(`[EDITOR] Handing over: ${file} (UUID: ${req.params.uuid})`);
    
    try {
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
        res.setHeader('Content-Type', 'text/plain');
        res.send(fs.readFileSync(filePath));
    } catch (e) { 
        console.error(`[EDITOR ERROR] ${e.message}`);
        res.status(500).send(e.message); 
    }
});

app.post('/api/servers/:uuid/files/write', authenticate, express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
    const file = req.query.file || req.query.path;
    const filePath = path.join('C:', 'ptero', 'volumes', req.params.uuid, file);
    console.log(`[EDITOR] Writing: ${file}`);
    
    try {
        const parentDir = path.dirname(filePath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

        let content = req.body;
        
        // If we used express.raw, content is a Buffer
        if (Buffer.isBuffer(content)) {
            const rawString = content.toString();
            try {
                // Check if it's actually a JSON box from the Panel
                const json = JSON.parse(rawString);
                if (json && json.content !== undefined) content = json.content;
                else content = rawString;
            } catch (e) {
                content = rawString;
            }
        }

        fs.writeFileSync(filePath, content);
        res.status(204).send();
    } catch (e) { 
        console.error(`[WRITE ERROR] ${e.message}`);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/servers/:uuid/files/create-folder', authenticate, (req, res) => {
    try { fs.mkdirSync(path.join('C:', 'ptero', 'volumes', req.params.uuid, req.body.path, req.body.name), { recursive: true }); res.status(204).send(); } catch (e) { res.status(500).send(); }
});

app.post('/api/servers/:uuid/files/rename', authenticate, (req, res) => {
    try {
        const root = path.join('C:', 'ptero', 'volumes', req.params.uuid);
        req.body.files.forEach(f => fs.renameSync(path.join(root, f.from), path.join(root, f.to)));
        res.status(204).send();
    } catch (e) { res.status(500).send(); }
});

app.post('/api/servers/:uuid/files/delete', authenticate, (req, res) => {
    try {
        const root = path.join('C:', 'ptero', 'volumes', req.params.uuid);
        req.body.files.forEach(f => {
            const p = path.join(root, f);
            if (fs.lstatSync(p).isDirectory()) fs.rmdirSync(p, { recursive: true }); else fs.unlinkSync(p);
        });
        res.status(204).send();
    } catch (e) { res.status(500).send(); }
});

app.post('/api/servers/:uuid/files/compress', authenticate, (req, res) => {
    const root = path.join('C:', 'ptero', 'volumes', req.params.uuid);
    const archiveName = `archive-${Date.now()}.zip`;
    try {
        // Use native PowerShell for high-speed zipping
        const files = req.body.files.map(f => `'${f}'`).join(',');
        execSync(`powershell -Command "Compress-Archive -Path ${files} -DestinationPath '${archiveName}'"`, { cwd: root });
        res.json({ name: archiveName });
    } catch (e) { res.status(500).send(); }
});

app.post('/api/servers/:uuid/files/decompress', authenticate, (req, res) => {
    const root = path.join('C:', 'ptero', 'volumes', req.params.uuid);
    try {
        execSync(`powershell -Command "Expand-Archive -Path '${req.body.file}' -DestinationPath '.' -Force"`, { cwd: root });
        res.status(204).send();
    } catch (e) { res.status(500).send(); }
});

app.get('/api/servers/:uuid/files/download', authenticate, (req, res) => {
    try { res.download(path.join('C:', 'ptero', 'volumes', req.params.uuid, req.query.file)); } catch (e) { res.status(404).send(); }
});

// --- POWER & STARTUP ---
app.post('/api/servers/:uuid/power', authenticate, (req, res) => {
    const { action } = req.body;
    if (action === 'start') prepareAndStart(req.params.uuid); else processManager.stop(req.params.uuid);
    res.status(204).send();
});

// Reinstall Blitz
app.post('/api/servers/:uuid/reinstall', authenticate, (req, res) => {
    res.status(202).send();
    setTimeout(() => prepareAndStart(req.params.uuid, true), 1000);
});

async function prepareAndStart(uuid, forceInstall = false) {
    const serverPath = path.join('C:', 'ptero', 'volumes', uuid);
    if (!fs.existsSync(serverPath)) fs.mkdirSync(serverPath, { recursive: true });

    // Internal Track
    let proc = processManager.processes.get(uuid) || { state: 'offline' };
    proc.is_installing = true;
    processManager.processes.set(uuid, proc);
    processManager.emit(`status:${uuid}`, 'installing');

    try {
        if (forceInstall) {
            console.log(`[REINSTALL] Cleaning up ${uuid}...`);
            try { execSync(`powershell -Command "Get-ChildItem -Path '${serverPath}' -Recurse | Remove-Item -Force -Recurse"`); } catch(e) {}
        }

        const response = await axios.get(`${process.env.PANEL_URL}/api/remote/servers/${uuid}/install`, {
            headers: { 'Authorization': `Bearer ${process.env.WINGS_TOKEN}` }
        });
        console.log(`[DEBUG] Full Panel Response for ${uuid}:`, JSON.stringify(response.data, null, 2));
        const { container_image, environment, script } = response.data;
        let runtime = container_image || 'java21';

        // Smart Detect
        const mcVersion = environment ? (environment.MINECRAFT_VERSION || environment.VERSION || '').toLowerCase() : '';
        if (mcVersion.includes('26.1') || mcVersion.includes('latest')) runtime = 'java25';

        await runtimeManager.ensure(runtime);

        const javaExe = runtimeManager.getJavaBinary(runtime);
        const colorFlags = '-Dterminal.jline=false -Dterminal.ansi=true -Dlog4j.skipJansi=false';
        const startCommand = `@echo off\necho "Starting with ${runtime}..."\n"${javaExe}" ${colorFlags} -Xms128M -XX:MaxRAMPercentage=95.0 -jar server.jar nogui\nif %errorlevel% neq 0 (\n  echo You must agree to the EULA in order to run the server. Go to eula.txt for more info.\n)`;
        fs.writeFileSync(path.join(serverPath, 'ptero_start.bat'), startCommand);

        if (forceInstall && script) {
            console.log(`[INSTALLER] Running script for ${uuid}...`);
            const scriptPath = path.join(serverPath, 'install.ps1');
            fs.writeFileSync(scriptPath, script);
            try { execSync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, { cwd: serverPath }); } catch (e) {}
        }

        // SIGNAL SUCCESS (The Victory Handshake)
        console.log(`[INSTALLER] Setup complete for ${uuid}. Unlocking.`);
        await axios.post(`${process.env.PANEL_URL}/api/remote/servers/${uuid}/install`, 
            { successful: true },
            { headers: { 'Authorization': `Bearer ${process.env.WINGS_TOKEN}` } }
        ).catch(e => {});

        proc.is_installing = false;
        processManager.emit(`status:${uuid}`, 'offline');
        processManager.start(uuid, 'cmd.exe', ['/c', 'ptero_start.bat'], { cwd: serverPath, env: environment }, response.data.limits);
    } catch (e) { 
        console.error(`[BLITZ-ERROR] ${e.message}`); 
        proc.is_installing = false;
        processManager.emit(`status:${uuid}`, 'offline');
    }
}

const server = app.listen(PORT, () => console.log(`[DAEMON] Blitz Node Active on Port ${PORT}`));

// WebSocket Bridge
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (req, socket, head) => {
    const match = req.url.match(/\/api\/servers\/([a-z0-9-]+)\/ws/);
    if (match) wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, match[1]));
    else socket.destroy();
});

wss.on('connection', (socket, req, uuid) => {
    const heartbeat = setInterval(() => socket.readyState === WebSocket.OPEN && socket.ping(), 30000);
    
    // Initial Push (Check Installing State)
    const currentState = processManager.processes.get(uuid)?.is_installing ? 'installing' : (processManager.getState(uuid) || 'offline');
    socket.send(JSON.stringify({ event: 'status', args: [currentState] }));

    const consoleListener = (d) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ event: 'console output', args: [d] }));
    const statusListener = (s) => {
        if (socket.readyState === WebSocket.OPEN) {
            console.log(`[WS-PUSH] Status -> ${uuid}: ${s}`);
            socket.send(JSON.stringify({ event: 'status', args: [s] }));
        }
    };
    const statsListener = (s) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event: 'stats', args: [JSON.stringify(s)] }));
        }
    };

    processManager.on(`console:${uuid}`, consoleListener);
    processManager.on(`status:${uuid}`, statusListener);
    processManager.on(`stats:${uuid}`, statsListener);

    socket.on('message', (msg) => {
        try {
            const { event, args } = JSON.parse(msg);
            if (event === 'auth') socket.send(JSON.stringify({ event: 'auth success' }));
            if (event === 'set state') { 
                if (args[0] === 'start') prepareAndStart(uuid); 
                else if (args[0] === 'restart') { processManager.stop(uuid); setTimeout(() => prepareAndStart(uuid), 1000); }
                else processManager.stop(uuid); 
            }
            if (event === 'send command') processManager.sendCommand(uuid, args[0]);
        } catch (e) {}
    });

    socket.on('close', () => {
        clearInterval(heartbeat);
        processManager.off(`console:${uuid}`, consoleListener);
        processManager.off(`status:${uuid}`, statusListener);
        processManager.off(`stats:${uuid}`, statsListener);
    });
});

// SUICIDE PACK
process.on('SIGINT', () => { processManager.stopAll(); setTimeout(() => process.exit(0), 500); });
process.on('SIGTERM', () => { processManager.stopAll(); setTimeout(() => process.exit(0), 500); });
process.on('exit', () => { processManager.stopAll(); });
