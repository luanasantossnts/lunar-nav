-- AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
-- Optional MySQL cache for Lunar Nav (set cache.driver = 'mysql' in config.php).
CREATE TABLE IF NOT EXISTS lunarnav_cache (
  k CHAR(40) NOT NULL PRIMARY KEY,
  v MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
