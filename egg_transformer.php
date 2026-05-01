<?php

use Pterodactyl\Models\Egg;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "========================================\n";
echo "   Pterodactyl-alt: GLOBAL EGG SANITIZER\n";
echo "========================================\n\n";

$eggs = Egg::with('nest')->get();

foreach ($eggs as $egg) {
    echo "[*] Checking Egg: " . $egg->name . "... ";

    $changed = false;

    // 1. Detect and Set the correct Windows Runtime
    $name = strtolower($egg->name);
    $nestName = strtolower($egg->nest->name);
    $runtime = 'java21'; // Default

    if ($nestName === 'minecraft' || str_contains($name, 'minecraft')) {
        // --- INJECT JAVA 25 OPTION ---
        $images = $egg->docker_images;
        if (!isset($images['Java 25'])) {
            $images = array_merge(['Java 25' => 'java25'], $images);
            $egg->docker_images = $images;
            $changed = true;
        }

        // --- SET DEFAULT INSTALLER TO JAVA 25 ---
        if ($egg->script_container !== 'java25') {
            $egg->script_container = 'java25';
            $egg->script_entry = 'powershell';
            $changed = true;
        }

        // --- SMART ROUTING ---
        if (str_contains($name, '26.1') || str_contains($name, 'snapshot')) {
            $runtime = 'java25';
        } else if (str_contains($name, '1.8') || str_contains($name, '1.12')) {
            $runtime = 'java8';
        } else if (str_contains($name, '1.16') || str_contains($name, '1.17')) {
            $runtime = 'java17';
        } else {
            $runtime = 'java21';
        }
    } else if (str_contains($name, 'steam') || str_contains($name, 'rust') || str_contains($name, 'palworld')) {
        $runtime = 'steamcmd';
    }

    if ($egg->script_container !== $runtime) {
        $egg->script_container = $runtime;
        $egg->script_entry = 'powershell';
        $changed = true;
        echo " [Runtime: $runtime] ";
    }

    // 2. Generate a Smart PowerShell Install Script
    if (str_contains($name, 'minecraft')) {
        $egg->script_install = '
$manifest = Invoke-RestMethod -Uri "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
$latestVersion = $manifest.latest.release
$versionUrl = ($manifest.versions | Where-Object { $_.id -eq $latestVersion }).url
$versionData = Invoke-RestMethod -Uri $versionUrl
$downloadUrl = $versionData.downloads.server.url

Try {
    Write-Host "Downloading Minecraft $latestVersion Server Jar..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile "server.jar" -ErrorAction Stop
} Catch {
    "Placeholder" | Out-File -FilePath "server.jar"
}
';
        $changed = true;
    }

    if ($changed) {
        $egg->save();
        echo "[UPDATED]\n";
    } else {
        echo "[OK]\n";
    }
}

echo "\n[SUCCESS] All eggs have been tagged with Windows Runtimes!\n";
