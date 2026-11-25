#!/usr/bin/env bash
# Monta un mini repo git sintético (PHP plano, sin composer ni vendor) con una consulta N+1 y un test en verde.
# Escribe solo en el directorio de trabajo del eval (cwd) y no borra nada.
set -euo pipefail
[ -z "$(ls -A .)" ] || { echo "scaffold: el directorio de trabajo no está vacío" >&2; exit 1; }
mkdir -p src/Service src/Repository tests
cat > src/Repository/CustomerRepository.php <<'PHP'
<?php

declare(strict_types=1);

namespace App\Repository;

final class CustomerRepository
{
    /** @param array<int, array{id: int, name: string}> $customers */
    public function __construct(private array $customers)
    {
    }

    /** @return array{id: int, name: string}|null */
    public function find(int $id): ?array
    {
        return $this->customers[$id] ?? null;
    }

    /**
     * Una sola consulta para varios ids.
     *
     * @param list<int> $ids
     * @return array<int, array{id: int, name: string}> clientes indexados por id
     */
    public function findByIds(array $ids): array
    {
        $found = [];
        foreach ($ids as $id) {
            if (isset($this->customers[$id])) {
                $found[$id] = $this->customers[$id];
            }
        }

        return $found;
    }
}
PHP
cat > src/Service/OrderReport.php <<'PHP'
<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\CustomerRepository;

final class OrderReport
{
    public function __construct(private CustomerRepository $customers)
    {
    }

    /**
     * @param list<array{id: int, customerId: int, total: int}> $orders
     * @return list<string> una línea por pedido: "#id nombre total"
     */
    public function lines(array $orders): array
    {
        $lines = [];
        foreach ($orders as $order) {
            $customer = $this->customers->find($order['customerId']);
            $name = $customer['name'] ?? 'desconocido';
            $lines[] = sprintf('#%d %s %d', $order['id'], $name, $order['total']);
        }

        return $lines;
    }
}
PHP
cat > tests/OrderReportTest.php <<'PHP'
<?php

declare(strict_types=1);

require __DIR__ . '/../src/Repository/CustomerRepository.php';
require __DIR__ . '/../src/Service/OrderReport.php';

use App\Repository\CustomerRepository;
use App\Service\OrderReport;

// Ejecutar con: php tests/OrderReportTest.php  (exit 0 = verde)
$repo = new CustomerRepository([
    1 => ['id' => 1, 'name' => 'Ana'],
    2 => ['id' => 2, 'name' => 'Luis'],
]);
$orders = [
    ['id' => 10, 'customerId' => 1, 'total' => 500],
    ['id' => 11, 'customerId' => 2, 'total' => 120],
    ['id' => 12, 'customerId' => 1, 'total' => 75],
    ['id' => 13, 'customerId' => 9, 'total' => 30],
];
$expected = [
    '#10 Ana 500',
    '#11 Luis 120',
    '#12 Ana 75',
    '#13 desconocido 30',
];
$got = (new OrderReport($repo))->lines($orders);
if ($got !== $expected) {
    fwrite(STDERR, "FAIL OrderReport::lines: " . json_encode($got) . "\n");
    exit(1);
}
exit(0);
PHP
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "fixture"
