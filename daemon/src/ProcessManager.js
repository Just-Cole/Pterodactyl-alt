const EventEmitter = require('events');
const WindowsSystem = require('./system/windows');
const { exec, execSync } = require('child_process');
const upnp = require('nat-upnp');
const fs = require('fs');
const path = require('path');
const ip = require('ip');
const axios = require('axios');

class ProcessManager extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map(); // uuid -> { child, state }
        this.lineBuffers = new Map(); // uuid -> string
        this.upnpClient = upnp.createClient();
        this.publicIp = 'Detecting...';
        
        console.log(`[NETWORK] Local IP detected: ${ip.address()}`);
        this.discoverPublicIp();
        this.startStatsLoop();
    }

    async discoverPublicIp() {
        try {
            const res = await axios.get('https://api.ipify.org');
            this.publicIp = res.data;
            console.log(`[NETWORK] Public IPv4 detected: ${this.publicIp}`);
        } catch (e) {
            this.publicIp = 'Unknown';
        }
    }

    startStatsLoop() {
        setInterval(() => {
            for (const [uuid, proc] of this.processes) {
                if (proc.state === 'running' && proc.child && proc.child.pid) {
                    const pid = proc.child.pid;
                    
                    // 1. Resource Pulse (CPU/RAM/IO)
                    const cmd = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid} or ParentProcessId = ${pid}\\" | Select-Object -Property WorkingSetSize, UserModeTime, ReadTransferCount, WriteTransferCount | ConvertTo-Json"`;
                    exec(cmd, (err, stdout) => {
                        if (!err && stdout) {
                            try {
                                let data = JSON.parse(stdout);
                                if (!Array.isArray(data)) data = [data];
                                let totalMem = 0;
                                let totalCpu = 0;
                                let totalRead = 0;
                                let totalWrite = 0;
                                
                                data.forEach(p => { 
                                    if (p) {
                                        totalMem += (p.WorkingSetSize || 0);
                                        totalCpu += (p.UserModeTime || 0);
                                        totalRead += (p.ReadTransferCount || 0);
                                        totalWrite += (p.WriteTransferCount || 0);
                                    }
                                });

                                // Calculate Network (IO) Speed
                                const rxSpeed = proc.lastRead ? Math.max(0, totalRead - proc.lastRead) : 0;
                                const txSpeed = proc.lastWrite ? Math.max(0, totalWrite - proc.lastWrite) : 0;
                                proc.lastRead = totalRead;
                                proc.lastWrite = totalWrite;

                                // 2. Disk Pulse (Update every ~30s)
                                if (!proc.lastDiskCheck || Date.now() - proc.lastDiskCheck > 30000) {
                                    const diskCmd = `powershell -Command "(Get-ChildItem -Path 'C:\\ptero\\volumes\\${uuid}' -Recurse | Measure-Object -Property Length -Sum).Sum"`;
                                    exec(diskCmd, (err, dStdout) => {
                                        if (!err) proc.disk_bytes = parseInt(dStdout) || 0;
                                        proc.lastDiskCheck = Date.now();
                                    });
                                }

                                if (totalMem > 0) {
                                    this.emit(`stats:${uuid}`, {
                                        memory_bytes: totalMem,
                                        memory_limit_bytes: 4 * 1024 * 1024 * 1024,
                                        cpu_absolute: (totalCpu % 100),
                                        network: { rx_bytes: rxSpeed, tx_bytes: txSpeed },
                                        disk_bytes: proc.disk_bytes || 0,
                                        uptime: 0
                                    });
                                }
                            } catch (e) {}
                        }
                    });
                }
            }
        }, 3000);
    }

    mapPort(port, uuid) {
        if (!port) return;
        const p = parseInt(port);
        console.log(`[FIREWALL] Opening port ${p} in Windows Firewall...`);
        try {
            execSync(`netsh advfirewall firewall add rule name="Blitz-Server-${p}" dir=in action=allow protocol=TCP localport=${p} profile=any`);
            execSync(`netsh advfirewall firewall add rule name="Blitz-Server-${p}-UDP" dir=in action=allow protocol=UDP localport=${p} profile=any`);
        } catch (e) {}

        console.log(`[UPnP] Attempting to map port ${p} for ${uuid}...`);
        this.upnpClient.portMapping({
            public: p,
            private: p,
            ttl: 0
        }, (err) => {
            if (err) {
                console.error(`[UPnP ERROR] Could not map port ${p}: ${err.message}`);
                console.warn(`[TIP] Router UPnP might be disabled. To go live:`);
                console.warn(`      1. Forward Port ${p} to your Local IP: ${ip.address()}`);
                console.warn(`      2. Friends join at: ${this.publicIp}:${p}`);
            }
            else console.log(`[UPnP SUCCESS] Port ${p} is now open!`);
        });
    }

    unmapPort(port) {
        if (!port) return;
        const p = parseInt(port);
        try {
            execSync(`netsh advfirewall firewall delete rule name="Blitz-Server-${p}"`);
            execSync(`netsh advfirewall firewall delete rule name="Blitz-Server-${p}-UDP"`);
        } catch (e) {}
        this.upnpClient.portUnmapping({ public: p });
    }

    async start(uuid, executable, args, options, limits) {
        if (this.processes.has(uuid) && this.processes.get(uuid).state === 'running') {
            throw new Error('Server is already running');
        }

        // --- DIRECT PORT PROBE ---
        let detectedPort = options.env?.SERVER_PORT || options.env?.PORT;
        
        // If Panel is silent, ask the file directly
        if (!detectedPort || detectedPort == 0) {
            const propsPath = path.join('C:', 'ptero', 'volumes', uuid, 'server.properties');
            if (fs.existsSync(propsPath)) {
                const props = fs.readFileSync(propsPath, 'utf8');
                const match = props.match(/server-port=(\d+)/);
                if (match) detectedPort = match[1];
            }
        }
        
        // Final Robust Fallback
        const finalPort = parseInt(detectedPort) || 25565;
        
        console.log(`[ProcessManager] Final Port Detection for ${uuid}: ${finalPort}`);
        this.mapPort(finalPort, uuid);

        console.log(`[ProcessManager] Cleaning up any zombie processes for ${uuid}...`);
        try {
            // Kill any JobRunner or Java process that might be holding files in this volume
            const volumePath = `C:\\ptero\\volumes\\${uuid}`;
            execSync(`powershell -Command "Get-Process | Where-Object { $_.Path -like '${volumePath}*' -or $_.CommandLine -like '*${uuid}*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`);
        } catch (e) {}

        console.log(`[ProcessManager] Starting server ${uuid}...`);
        
        try {
            const child = WindowsSystem.launchInJobObject(executable, args, options, limits);
            
            this.processes.set(uuid, {
                child,
                state: 'running',
                startTime: new Date(),
                port: finalPort // Store for unmapping
            });

            child.on('exit', (code) => {
                console.log(`[ProcessManager] Server ${uuid} exited with code ${code}`);
                this.processes.set(uuid, { ...this.processes.get(uuid), state: 'offline' });
                this.emit(`status:${uuid}`, 'offline');
            });

            this.lineBuffers.set(uuid, '');

            const processOutput = (data) => {
                let currentBuffer = this.lineBuffers.get(uuid) || '';
                currentBuffer += data.toString().replace(/\r/g, ''); // Nuke Carriage Returns
                
                const lines = currentBuffer.split('\n');
                this.lineBuffers.set(uuid, lines.pop()); // Save partial line

                lines.forEach(line => {
                    const clean = line.trim();
                    if (!clean) return;

                    // Filter Noise (Broad Java Warnings)
                    if (clean.startsWith('WARNING:') && (
                        clean.includes('java.lang.System') || 
                        clean.includes('sun.misc.Unsafe') ||
                        clean.includes('native access') ||
                        clean.includes('future release') ||
                        clean.includes('reporting this') ||
                        clean.includes('restricted method')
                    )) return;

                    let colored = clean;
                    if (clean.includes('joined the game')) colored = `\x1b[33m${clean}\x1b[0m`;
                    else if (clean.includes('left the game')) colored = `\x1b[31m${clean}\x1b[0m`;
                    else if (clean.includes('[INFO]')) colored = `\x1b[36m${clean}\x1b[0m`;
                    else if (clean.includes('[WARN]')) colored = `\x1b[33m${clean}\x1b[0m`;
                    else if (clean.includes('[ERROR]')) colored = `\x1b[31m${clean}\x1b[0m`;
                    else if (clean.toLowerCase().includes('done')) colored = `\x1b[32m${clean}\x1b[0m`;
                    
                    this.emit(`console:${uuid}`, colored);
                });
            };

            child.stdout.on('data', processOutput);
            child.stderr.on('data', processOutput);

            this.emit(`status:${uuid}`, 'running');

        } catch (error) {
            console.error(`[ProcessManager] Failed to start server ${uuid}:`, error);
            throw error;
        }
    }

    stop(uuid) {
        const proc = this.processes.get(uuid);
        console.log(`[ProcessManager] Stopping server ${uuid}...`);
        
        try {
            // 1. Force Kill the specific PID tree if we have it
            if (proc && proc.child && proc.child.pid) {
                execSync(`taskkill /F /T /PID ${proc.child.pid}`, { stdio: 'ignore' });
            }
            
            // 2. Final Sweep: Kill anything else with the UUID in the command line
            const volumePath = `C:\\ptero\\volumes\\${uuid}`;
            execSync(`powershell -Command "Get-Process | Where-Object { $_.Path -like '${volumePath}*' -or $_.CommandLine -like '*${uuid}*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`);
            
            if (proc) {
                if (proc.port) this.unmapPort(proc.port);
                proc.state = 'offline';
                this.emit(`status:${uuid}`, 'offline');
            }
        } catch (e) {
            console.error(`[ProcessManager] Error during stop: ${e.message}`);
        }
    }

    sendCommand(uuid, command) {
        const proc = this.processes.get(uuid);
        if (proc && proc.child && proc.child.stdin) {
            proc.child.stdin.write(command + '\n');
        }
    }

    stopAll() {
        console.log('[ProcessManager] Daemon shutting down. Force closing all servers...');
        for (const uuid of this.processes.keys()) {
            this.stop(uuid);
        }
    }

    getState(uuid) {
        return this.processes.has(uuid) ? this.processes.get(uuid).state : 'offline';
    }
}

module.exports = new ProcessManager();
