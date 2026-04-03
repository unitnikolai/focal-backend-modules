import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient();
let pool; 

const getPool = async () => {
    if (pool) return pool;
    const secret = await sm.send(
        new GetSecretValueCommand({
            SecretId: process.env.DB_SECRET_ID
        })
    );
    const creds = JSON.parse(secret.SecretString);
    pool = new Pool({
        host: creds.host,
        user: creds.username,
        password: creds.password,
        database: creds.dbname,
        port: 5432,
        ssl: { rejectUnauthorized : true},
        connectionTimeoutMillis: 5000
    });
    return pool;
};

export const handler = async (req, res) => {
    const userId = req.user.sub;
    const pool = await getPool();
    try {
        const { rows } = await pool.query(
            "SELECT email, given_name, family_name, organization_id FROM users WHERE id = $1",
            [userId]
        );
        if (!rows[0]){
            return res.status(404).json({ error: "User not found" });
        }
        res.json(rows[0]);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal server error" });
}
};