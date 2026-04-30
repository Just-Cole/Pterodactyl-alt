<?php

namespace Pterodactyl\Contracts\Repository;

use Pterodactyl\Models\Allocation;

interface AllocationRepositoryInterface extends RepositoryInterface
{
    /**
     * Return all the allocations that exist for a node that are not currently
     * allocated.
     */
    public function getUnassignedAllocationIds(int $node): array;

    /**
     * Return a single allocation from those meeting the requirements.
     */
    public function getRandomAllocation(array $nodes, array $ports, bool $dedicated = false): ?Allocation;

    /**
     * Checks if a specific port is already in use by any server on a node.
     */
    public function isPortInUse(int $nodeId, int $port): bool;

    /**
     * Creates a new allocation record for a node.
     */
    public function createAllocation(int $nodeId, string $ip, int $port): Allocation;
}
