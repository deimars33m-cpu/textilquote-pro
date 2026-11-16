-- ==============================================================
-- Migración: Mover pagos registrados como Yape a QR en Pedidos y Gastos
-- ==============================================================

-- 1. Actualizar pagos en el historial de Pedidos (orders.payment_history)
UPDATE orders
SET payment_history = (
  SELECT COALESCE(
    jsonb_agg(
      CASE 
        WHEN LOWER(elem->>'method') IN ('yape', 'yape_plin', 'plin') 
             OR (elem->>'method') ILIKE '%yape%'
        THEN jsonb_set(elem, '{method}', '"qr"')
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(payment_history) elem
)
WHERE payment_history IS NOT NULL 
  AND payment_history::text ILIKE '%yape%';

-- 2. Actualizar si hubiese registros en Gastos (expenses)
UPDATE expenses
SET payment_method = 'qr'
WHERE LOWER(payment_method) IN ('yape', 'yape_plin', 'plin')
   OR payment_method ILIKE '%yape%';

UPDATE expenses
SET payment_history = (
  SELECT COALESCE(
    jsonb_agg(
      CASE 
        WHEN LOWER(elem->>'method') IN ('yape', 'yape_plin', 'plin') 
             OR (elem->>'method') ILIKE '%yape%'
        THEN jsonb_set(elem, '{method}', '"qr"')
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(payment_history) elem
)
WHERE payment_history IS NOT NULL 
  AND payment_history::text ILIKE '%yape%';
