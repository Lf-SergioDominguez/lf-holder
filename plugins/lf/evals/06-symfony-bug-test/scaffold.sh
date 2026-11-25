#!/usr/bin/env bash
# Monta un mini repo git sintético (PHP plano, sin composer ni vendor) con un test en rojo.
# Escribe solo en el directorio de trabajo del eval (cwd) y no borra nada.
set -euo pipefail
[ -z "$(ls -A .)" ] || { echo "scaffold: el directorio de trabajo no está vacío" >&2; exit 1; }
mkdir -p src/Service tests
cat > src/Service/PriceCalculator.php <<'PHP'
<?php

declare(strict_types=1);

namespace App\Service;

final class PriceCalculator
{
    /** Precio final en céntimos tras aplicar un descuento porcentual. */
    public function applyDiscount(int $cents, int $percent): int
    {
        $discount = (int) ($cents * $percent / 100);

        return $cents - $discount;
    }
}
PHP
cat > tests/PriceCalculatorTest.php <<'PHP'
<?php

declare(strict_types=1);

require __DIR__ . '/../src/Service/PriceCalculator.php';

use App\Service\PriceCalculator;

// Ejecutar con: php tests/PriceCalculatorTest.php  (exit 0 = verde)
$calc = new PriceCalculator();
$cases = [
    [1000, 10, 900],
    [999, 10, 899],  // descuento 99,9 -> 100 (redondeo), no 99
    [333, 15, 283],  // descuento 49,95 -> 50
    [1, 50, 0],      // descuento 0,5 -> 1
];
$failed = 0;
foreach ($cases as [$cents, $percent, $expected]) {
    $got = $calc->applyDiscount($cents, $percent);
    if ($got !== $expected) {
        fwrite(STDERR, "FAIL applyDiscount($cents, $percent): esperado $expected, obtenido $got\n");
        $failed++;
    }
}
exit($failed === 0 ? 0 : 1);
PHP
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "fixture"
