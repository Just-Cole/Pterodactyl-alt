const { exec, spawn } = require('child_process');
const path = require('path');

/**
 * Windows-specific system operations for Pterodactyl-alt Daemon.
 */
class WindowsSystem {
    /**
     * Set folder permissions for a specific server.
     * For now, we use a generic "AppContainer" style group or just restricted access.
     */
    static async setFolderPermissions(folderPath, sid = '*S-1-15-2-1') {
        return new Promise((resolve, reject) => {
            // Grant ALL_APP_PACKAGES access to the folder
            exec(`icacls "${folderPath}" /grant ${sid}:(OI)(CI)F /inheritance:e`, (err, stdout, stderr) => {
                if (err) return reject(stderr);
                resolve(stdout);
            });
        });
    }

    /**
     * Create a Job Object and launch a process inside it.
     */
    static launchInJobObject(executable, args, options, limits) {
        const helperPath = path.join(__dirname, 'JobRunner.exe');
        const safeLimits = limits || { memory: 512, cpu: 100 }; // Fallback to 512MB/100% CPU if undefined
        
        // Usage: JobRunner.exe [memory_mb] [cpu_percent] [working_dir] [executable] [args...]
        const helperArgs = [
            safeLimits.memory || 0,
            safeLimits.cpu || 0,
            options.cwd,
            executable,
            ...args
        ];

        console.log(`Launching via JobRunner: ${helperPath} ${helperArgs.join(' ')}`);
        
        const child = spawn(helperPath, helperArgs, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            shell: false, // Use false because JobRunner handles the execution
        });

        return child;
    }

    /**
     * Create a virtual AppContainer profile name based on the server UUID.
     */
    static getAppContainerName(uuid) {
        return `ptero_${uuid.split('-')[0]}`;
    }
}

module.exports = WindowsSystem;
