<?php

use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Services\Nodes\NodeCreationService;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "========================================\n";
echo "   Pterodactyl-alt: NODE MAGIC (V3)\n";
echo "========================================\n\n";

// 1. Location
$location = Location::where('short', 'Local')->first();
if (!$location) {
    echo "[+] Creating Location 'Local'...\n";
    $location = Location::create([
        'short' => 'Local',
        'long' => 'Local Windows Machine',
    ]);
}

// 2. Safety Check: Only create if missing
$node = Node::where('name', 'WindowsNode')->first();

if (!$node) {
    echo "[+] Creating Node 'WindowsNode' via Service...\n";
    $service = $app->make(NodeCreationService::class);
    $node = $service->handle([
        'name' => 'WindowsNode',
        'location_id' => $location->id,
        'fqdn' => '127.0.0.1',
        'scheme' => 'http',
        'behind_proxy' => false,
        'maintenance_mode' => false,
        'memory' => 8192,
        'memory_overallocate' => 0,
        'disk' => 50000,
        'disk_overallocate' => 0,
        'upload_size' => 100,
        'daemon_listen' => 8080,
        'daemon_sftp' => 2022,
        'daemon_base' => 'C:\ptero\volumes',
    ]);

    echo "[+] Creating Allocation (127.0.0.1:25565)...\n";
    DB::table('allocations')->insert([
        'node_id' => $node->id,
        'ip' => '127.0.0.1',
        'port' => 25565,
    ]);
} else {
    echo "[OK] 'WindowsNode' (ID: {$node->id}) already exists. Preserving all data.\n";
}

// 3. Sync Token to .env
$decrypted = decrypt($node->daemon_token);
$envPath = __DIR__ . '/.env';
$env = file_get_contents($envPath);

$tokenLine = "WINGS_TOKEN={$node->daemon_token_id}.{$decrypted}";
if (str_contains($env, 'WINGS_TOKEN=')) {
    $env = preg_replace('/WINGS_TOKEN=.*/', $tokenLine, $env);
} else {
    $env .= "\n" . $tokenLine;
}

file_put_contents($envPath, $env);

// 4. Update Daemon .env
$daemonEnvPath = __DIR__ . '/daemon/.env';
$daemonEnv = "PANEL_URL=http://127.0.0.1:8000\nWINGS_TOKEN={$node->daemon_token_id}.{$decrypted}\nWINGS_PORT=8080\nSFTP_PORT=2022\n";
file_put_contents($daemonEnvPath, $daemonEnv);

echo "[SUCCESS] Node linked correctly and encrypted.\n";
