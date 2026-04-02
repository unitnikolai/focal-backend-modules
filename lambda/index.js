const { Pool } = require("pg");

export const handler = async (req, res) => {
    const userId = req.user.sub;
    const pool = new Pool({
      host: creds.host,
      user: creds.username,
      password: creds.password,
      database: creds.dbname,
      port: 5432,
      ssl: true,
      connectionTimeoutMillis: 5000
    });
    try {
        const adminCheck = await pool.query(
            "SELECT admin_status FROM users WHERE id = $1",
            [userId]
        );
        if (adminCheck.rows[0].admin_status !== true) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const unblock = async () => {
            
        }