const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

class RuntimeManager {
    constructor() {
        this.basePath = 'C:\\ptero\\runtime';
        if (!fs.existsSync(this.basePath)) fs.mkdirSync(this.basePath, { recursive: true });
        
        this.runtimes = {
            'java25': 'https://download.java.net/java/GA/jdk25/bd75d5f9689641da8e1daabeccb5528b/36/GPL/openjdk-25_windows-x64_bin.zip',
            'java21': 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2+13/OpenJDK21U-jdk_x64_windows_hotspot_21.0.2_13.zip',
            'java17': 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10+7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip',
            'java8': 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u402-b06/OpenJDK8U-jdk_x64_windows_hotspot_8u402b06.zip',
            'steamcmd': 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip'
        };

        this.locks = new Map(); // Store promises for ongoing downloads
    }

    async ensure(name) {
        const runtimePath = path.join(this.basePath, name);
        if (fs.existsSync(runtimePath)) return runtimePath;

        // Check if someone else is already downloading this
        if (this.locks.has(name)) {
            console.log(`[RUNTIME] Waiting for existing download of ${name}...`);
            return this.locks.get(name);
        }

        // Start a new download and lock it
        const downloadPromise = (async () => {
            const url = this.runtimes[name];
            if (!url) throw new Error(`Unknown runtime: ${name}`);

            console.log(`[RUNTIME] Downloading ${name}...`);
            const zipPath = path.join(this.basePath, `${name}.zip`);
            
            try {
                const response = await axios({ url, method: 'GET', responseType: 'stream' });
                const writer = fs.createWriteStream(zipPath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                console.log(`[RUNTIME] Extracting ${name}...`);
                const tempDir = path.join(this.basePath, `temp_${name}`);
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                
                execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`);
                
                const contents = fs.readdirSync(tempDir);
                if (contents.length === 1 && fs.lstatSync(path.join(tempDir, contents[0])).isDirectory()) {
                    execSync(`move "${path.join(tempDir, contents[0])}\\*" "${runtimePath}\\"`);
                } else {
                    execSync(`move "${tempDir}\\*" "${runtimePath}\\"`);
                }
                
                fs.rmdirSync(tempDir, { recursive: true });
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                
                return runtimePath;
            } finally {
                this.locks.delete(name); // Unlock when done
            }
        })();

        this.locks.set(name, downloadPromise);
        return downloadPromise;
    }

    getJavaBinary(name) {
        return path.join(this.basePath, name, 'bin', 'java.exe');
    }

    getSteamCmd() {
        return path.join(this.basePath, 'steamcmd', 'steamcmd.exe');
    }
}

module.exports = new RuntimeManager();
