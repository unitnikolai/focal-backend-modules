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
        const { user_info } = await pool.query(
            "SELECT email, given_name, family_name, organization_id FROM users WHERE id = $1",
            [userId]
        );
        if (!user_info[0]){
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user_info[0]);
    } finally {
        await pool.release()
    }
}