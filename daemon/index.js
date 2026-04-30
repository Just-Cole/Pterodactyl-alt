require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const processManager = require('./src/ProcessManager');
const SftpServer = require('./src/SftpServer');

const sftpServer = new SftpServer(process.env.SFTP_PORT || 2022);
sftpServer.start();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Basic authentication middleware (Wings uses a Token)
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${process.env.WINGS_TOKEN}`) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

// --- Wings API Routes ---

// Get daemon configuration/status
app.get('/api/system', authenticate, (req, res) => {
    res.json({
        version: '1.0.0-win',
        architecture: 'windows',
        kernel: process.platform,
    });
});

// List/Manage Servers
app.post('/api/servers', authenticate, (req, res) => {
    const { uuid, start_on_completion } = req.body;
    console.log(`Creating server ${uuid}...`);
    // TODO: Implement server creation logic (AppContainer, folder setup)
    res.status(202).json({});
});

app.get('/api/servers/:uuid', authenticate, (req, res) => {
    // TODO: Return server details
    res.json({
        uuid: req.params.uuid,
        state: 'offline',
    });
});

app.post('/api/servers/:uuid/power', authenticate, (req, res) => {
    const { action } = req.body;
    const { uuid } = req.params;
    
    console.log(`Power action ${action} for ${uuid}`);
    
    try {
        if (action === 'start') {
            // In a real scenario, we'd get these details from the Panel or a local config
            // For now, let's assume some defaults for testing
            processManager.start(uuid, 'cmd.exe', ['/c', 'echo "Server Starting..." && pause'], {
                cwd: process.cwd(),
                env: {}
            }, {
                memory: 512,
                cpu: 50
            });
        } else if (action === 'stop' || action === 'kill') {
            processManager.stop(uuid);
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upgrade WebSocket for the console
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const uuid = url.pathname.split('/')[3]; // /api/servers/:uuid/ws
    
    if (!uuid) {
        ws.terminate();
        return;
    }

    console.log(`New WebSocket connection for server ${uuid}`);

    const onConsole = (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'console output', args: [data] }));
        }
    };

    processManager.on(`console:${uuid}`, onConsole);

    ws.on('close', () => {
        processManager.off(`console:${uuid}`, onConsole);
    });

    // Handle incoming messages from the Panel (e.g. commands)
    ws.on('message', (message) => {
        try {
            const { event, args } = JSON.parse(message);
            if (event === 'send command') {
                const command = args[0];
                console.log(`[${uuid}] Executing command: ${command}`);
                // TODO: Send to process stdin
            }
        } catch (e) {
            console.error('Failed to parse WS message:', e);
        }
    });
});

const PORT = process.env.WINGS_PORT || 8080;
server.listen(PORT, () => {
    console.log(`Wings-Win Daemon listening on port ${PORT}`);
});
