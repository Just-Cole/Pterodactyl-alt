const EventEmitter = require('events');
const WindowsSystem = require('./system/windows');

class ProcessManager extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map(); // uuid -> { child, state }
    }

    start(uuid, executable, args, options, limits) {
        if (this.processes.has(uuid) && this.processes.get(uuid).state === 'running') {
            throw new Error('Server is already running');
        }

        console.log(`[ProcessManager] Starting server ${uuid}...`);
        
        try {
            const child = WindowsSystem.launchInJobObject(executable, args, options, limits);
            
            this.processes.set(uuid, {
                child,
                state: 'running',
                startTime: new Date(),
            });

            child.on('exit', (code) => {
                console.log(`[ProcessManager] Server ${uuid} exited with code ${code}`);
                this.processes.set(uuid, { ...this.processes.get(uuid), state: 'offline' });
            });

            // Handle console output (for WebSockets later)
            child.stdout.on('data', (data) => {
                const output = data.toString();
                this.emit(`console:${uuid}`, output);
                process.stdout.write(`[${uuid}] ${output}`);
            });

            child.stderr.on('data', (data) => {
                const output = data.toString();
                this.emit(`console:${uuid}`, output);
                process.stderr.write(`[${uuid}] ERR: ${output}`);
            });

        } catch (error) {
            console.error(`[ProcessManager] Failed to start server ${uuid}:`, error);
            throw error;
        }
    }

    stop(uuid) {
        const proc = this.processes.get(uuid);
        if (proc && proc.child) {
            console.log(`[ProcessManager] Stopping server ${uuid}...`);
            proc.child.kill(); // On Windows, this kills the JobRunner which should kill the tree
            proc.state = 'stopping';
        }
    }

    getState(uuid) {
        return this.processes.has(uuid) ? this.processes.get(uuid).state : 'offline';
    }
}

module.exports = new ProcessManager();
