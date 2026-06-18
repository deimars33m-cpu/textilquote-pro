-- ==============================================================
-- NYX Pro — KPI Materialized Views & Refresh Triggers
-- Ejecutar en la consola SQL de Supabase
-- ==============================================================

-- Limpiar vistas anteriores si existen
DROP TRIGGER IF EXISTS tg_refresh_kpis_orders ON orders;
DROP TRIGGER IF EXISTS tg_refresh_kpis_expenses ON expenses;
DROP MATERIALIZED VIEW IF EXISTS mv_kpi_financial_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_kpi_expense_by_subcategory CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_kpi_sales_by_subcategory CASCADE;
DROP FUNCTION IF EXISTS refresh_all_kpi_views() CASCADE;

-- 1. Vista Materializada: Resumen Financiero Diario
CREATE MATERIALIZED VIEW mv_kpi_financial_summary AS
SELECT 
  COALESCE(o.dia, e.dia) AS dia,
  COALESCE(o.total_ingresos, 0) AS total_ingresos,
  COALESCE(o.total_cobrado, 0) AS total_cobrado,
  COALESCE(o.total_pedidos, 0) AS total_pedidos,
  COALESCE(e.total_egresos, 0) AS total_egresos
FROM (
  SELECT 
    created_at::date AS dia,
    SUM(total_amount) AS total_ingresos,
    SUM(paid_amount) AS total_cobrado,
    COUNT(*) AS total_pedidos
  FROM orders
  WHERE status != 'cancelado'
  GROUP BY 1
) o
FULL OUTER JOIN (
  SELECT 
    date AS dia,
    SUM(amount) AS total_egresos
  FROM expenses
  GROUP BY 1
) e ON o.dia = e.dia
ORDER BY 1 DESC;

CREATE UNIQUE INDEX idx_mv_financial_summary_dia 
  ON mv_kpi_financial_summary(dia);

-- 2. Vista Materializada: Gastos por Subcategoría
CREATE MATERIALIZED VIEW mv_kpi_expense_by_subcategory AS
SELECT 
  category_key,
  subcategory,
  date_trunc('month', date)::date AS mes,
  date_trunc('week', date)::date AS semana,
  SUM(amount) AS total_gastado,
  COUNT(*) AS num_transacciones
FROM expenses
GROUP BY category_key, subcategory, mes, semana
ORDER BY mes DESC, category_key, subcategory;

CREATE UNIQUE INDEX idx_mv_expense_subcat 
  ON mv_kpi_expense_by_subcategory(category_key, subcategory, mes, semana);

-- 3. Vista Materializada: Ventas por Subcategoría (via order_items)
CREATE MATERIALIZED VIEW mv_kpi_sales_by_subcategory AS
SELECT 
  oi.category,
  oi.product_category,
  ord.created_at::date AS dia,
  date_trunc('week', ord.created_at)::date AS semana,
  date_trunc('month', ord.created_at)::date AS mes,
  SUM(oi.total_price) AS total_vendido,
  COUNT(DISTINCT ord.id) AS num_pedidos
FROM order_items oi
JOIN orders ord ON ord.id = oi.order_id
WHERE ord.status IN ('pendiente', 'en_proceso', 'listo', 'entregado')
GROUP BY oi.category, oi.product_category, dia, semana, mes
ORDER BY dia DESC;

CREATE UNIQUE INDEX idx_mv_sales_subcat 
  ON mv_kpi_sales_by_subcategory(category, product_category, dia);

-- ==============================================================
-- Función y Triggers de Refresco Automático
-- ==============================================================

CREATE OR REPLACE FUNCTION refresh_all_kpi_views()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpi_financial_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpi_expense_by_subcategory;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpi_sales_by_subcategory;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_refresh_kpis_orders
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH STATEMENT EXECUTE FUNCTION refresh_all_kpi_views();

CREATE TRIGGER tg_refresh_kpis_expenses
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH STATEMENT EXECUTE FUNCTION refresh_all_kpi_views();
