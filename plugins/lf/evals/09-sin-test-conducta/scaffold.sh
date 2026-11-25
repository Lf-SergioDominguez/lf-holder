#!/usr/bin/env bash
# Monta un mini repo git sintético (PHP plano, sin composer ni vendor) con lógica con ramas y un test con 2 casos.
# Escribe solo en el directorio de trabajo del eval (cwd) y no borra nada.
set -euo pipefail
[ -z "$(ls -A .)" ] || { echo "scaffold: el directorio de trabajo no está vacío" >&2; exit 1; }
mkdir -p src/Service tests
cat > src/Service/ShippingCost.php <<'PHP'
<?php

declare(strict_types=1);

namespace App\Service;

final class ShippingCost
{
    /** Coste de envío en céntimos según peso (gramos) y zona ('local' o 'national'). */
    public function cost(int $weightGrams, string $zone): int
    {
        if ($zone === 'local') {
            return $weightGrams <= 1000 ? 300 : 500;
        }

        return $weightGrams <= 1000 ? 600 : 900;
    }
}
PHP
cat > tests/ShippingCostTest.php <<'PHP'
<?php

declare(strict_types=1);

require __DIR__ . '/../src/Service/ShippingCost.php';

use App\Service\ShippingCost;

// Ejecutar con: php tests/ShippingCostTest.php  (exit 0 = verde)
$shipping = new ShippingCost();
$cases = [
    [500, 'local', 300],
    [2000, 'national', 900],
];
$failed = 0;
foreach ($cases as [$weight, $zone, $expected]) {
    $got = $shipping->cost($weight, $zone);
    if ($got !== $expected) {
        fwrite(STDERR, "FAIL cost($weight, $zone): esperado $expected, obtenido $got\n");
        $failed++;
    }
}
exit($failed === 0 ? 0 : 1);
PHP
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "fixture"
