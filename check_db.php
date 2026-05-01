<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$s = Pterodactyl\Models\Server::orderBy('id', 'desc')->first();
$n = Pterodactyl\Models\Node::orderBy('id', 'desc')->first();

if (!$s) {
    echo "NO SERVERS FOUND\n";
} else {
    echo "Server UUID: " . $s->uuid . "\n";
    echo "Server Node ID: " . $s->node_id . "\n";
}

if (!$n) {
    echo "NO NODES FOUND\n";
} else {
    echo "Latest Node ID: " . $n->id . "\n";
}
