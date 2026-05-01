<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "--- SERVERS ---\n";
$servers = DB::table('servers')->get();
foreach($servers as $s) {
    echo "ID: {$s->id} | UUID: {$s->uuid} | NodeID: {$s->node_id}\n";
}

echo "\n--- NODES ---\n";
$nodes = DB::table('nodes')->get();
foreach($nodes as $n) {
    echo "ID: {$n->id} | Name: {$n->name}\n";
}
