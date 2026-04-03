const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        const { device_id, user_id, tag_id, status  } = JSON.parse(event.body);
        if (!device_id || !user_id || !tag_id) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" })};
        }
        const now = Math.floor(Date.now() / 1000);

        await dynamo.update({
            TableName: process.env.SESSIONS_TABLE,
        })
    }catch (error) {
        console.error("", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};