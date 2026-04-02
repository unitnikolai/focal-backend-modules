import { Client } from "pg";

export const handler = async (req, res) => {
    const userId = req.user.sub;
    const client = new Client({
      host: creds.host, 
      user: creds.username,
      password: creds.password,
      database: creds.dbname,
      port: 5432,
      ssl: true,
      connectionTimeoutMillis: 5000
    });

    await client.connect();

    await client.query(
        "SELECT email, given_name, family_name, organization_id FROM users WHERE id = $1",
        [id]
    )
}