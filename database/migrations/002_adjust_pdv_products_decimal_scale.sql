ALTER TABLE public.pdv_products
  ALTER COLUMN units_per_purchase TYPE NUMERIC(12, 2) USING ROUND(units_per_purchase, 2),
  ALTER COLUMN purchase_cost_value TYPE NUMERIC(14, 2) USING ROUND(purchase_cost_value, 2),
  ALTER COLUMN cost_value TYPE NUMERIC(14, 2) USING ROUND(cost_value, 2),
  ALTER COLUMN margin_profit TYPE NUMERIC(10, 2) USING ROUND(margin_profit, 2),
  ALTER COLUMN price TYPE NUMERIC(14, 2) USING ROUND(price, 2),
  ALTER COLUMN stock TYPE NUMERIC(14, 2) USING ROUND(stock, 2);
