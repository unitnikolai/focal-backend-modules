import { Pool } from "pg";

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
            "SELECT admin_status, organization_id FROM users WHERE id = $1",
            [userId]
        );
        if (adminCheck.rows[0].admin_status !== true) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const { rows: sessions } = await pool.query(
            "SELECT s.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE u.organization_id = $1",
            [adminCheck.rows[0].organization_id]
        );
        if (!sessions[0]) {
            return res.status(404).json({ error: "Sessions not found" });
        }
        res.json(sessions);
    } finally {
        await pool.end();
    }
}
