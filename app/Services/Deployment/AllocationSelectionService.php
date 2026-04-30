<?php

namespace Pterodactyl\Services\Deployment;

use Pterodactyl\Models\Allocation;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Services\Allocations\AssignmentService;
use Pterodactyl\Contracts\Repository\AllocationRepositoryInterface;
use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;

class AllocationSelectionService
{
    protected bool $dedicated = false;

    protected array $nodes = [];

    protected array $ports = [];

    /**
     * AllocationSelectionService constructor.
     */
    public function __construct(private AllocationRepositoryInterface $repository)
    {
    }

    /**
     * Toggle if the selected allocation should be the only allocation belonging
     * to the given IP address. If true an allocation will not be selected if an IP
     * already has another server set to use on if its allocations.
     */
    public function setDedicated(bool $dedicated): self
    {
        $this->dedicated = $dedicated;

        return $this;
    }

    /**
     * A list of node IDs that should be used when selecting an allocation. If empty, all
     * nodes will be used to filter with.
     */
    public function setNodes(array $nodes): self
    {
        $this->nodes = $nodes;

        return $this;
    }

    /**
     * An array of individual ports or port ranges to use when selecting an allocation. If
     * empty, all ports will be considered when finding an allocation. If set, only ports appearing
     * in the array or range will be used.
     *
     * @throws DisplayException
     */
    public function setPorts(array $ports): self
    {
        $stored = [];
        foreach ($ports as $port) {
            if (is_digit($port)) {
                $stored[] = $port;
            }

            // Ranges are stored in the ports array as an array which can be
            // better processed in the repository.
            if (preg_match(AssignmentService::PORT_RANGE_REGEX, $port, $matches)) {
                if (abs($matches[2] - $matches[1]) > AssignmentService::PORT_RANGE_LIMIT) {
                    throw new DisplayException(trans('exceptions.allocations.too_many_ports'));
                }

                $stored[] = [$matches[1], $matches[2]];
            }
        }

        $this->ports = $stored;

        return $this;
    }

    /**
     * Return a single allocation that should be used as the default allocation for a server.
     *
     * @throws NoViableAllocationException
     */
    public function handle(): Allocation
    {
        $allocation = $this->repository->getRandomAllocation($this->nodes, $this->ports, $this->dedicated);

        if (is_null($allocation) && !empty($this->ports) && !empty($this->nodes)) {
            // If we have specific ports and nodes, but no allocation was found,
            // attempt to find the next available port using auto-increment logic.
            $allocation = $this->getAutoIncrementAllocation();
        }

        if (is_null($allocation)) {
            throw new NoViableAllocationException(trans('exceptions.deployment.no_viable_allocations'));
        }

        return $allocation;
    }

    /**
     * Attempts to find the next available port by incrementing from the first
     * requested port.
     */
    protected function getAutoIncrementAllocation(): ?Allocation
    {
        $nodeId = $this->nodes[0]; // Just pick the first node for now
        $basePort = is_array($this->ports[0]) ? $this->ports[0][0] : $this->ports[0];

        // We need an IP to create the allocation on.
        // Pick the IP from the first existing allocation on this node.
        $existing = Allocation::query()->where('node_id', $nodeId)->first();
        if (!$existing) {
            return null;
        }

        $ip = $existing->ip;
        $port = (int) $basePort;

        // Loop up to 1000 ports to find a free one.
        for ($i = 0; $i < 1000; $i++) {
            if (!$this->repository->isPortInUse($nodeId, $port)) {
                // Check if an unassigned allocation record already exists for this port.
                $allocation = Allocation::query()
                    ->where('node_id', $nodeId)
                    ->where('port', $port)
                    ->whereNull('server_id')
                    ->first();

                if ($allocation) {
                    return $allocation;
                }

                // Otherwise, create a new allocation record.
                return $this->repository->createAllocation($nodeId, $ip, $port);
            }
            $port++;
        }

        return null;
    }
}
