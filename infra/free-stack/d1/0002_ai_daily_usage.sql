-- Preview TapFlow only: contador diário global para evitar gastos.
CREATE TABLE IF NOT EXISTS ai_daily_usage(day_utc TEXT PRIMARY KEY, request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count BETWEEN 0 AND 5));
