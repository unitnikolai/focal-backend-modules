const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();

export const handler = async (req, res) => {
    try{
        const userID = req.user.sub;
        const organizationID = req.user["custom:organization_id"]; //Change to real way organization ID is stored

        const now = Math.floor(Date.now() / 1000);

        const sessions = data.Items.filter(item => item.organization_id === organizationID)
            .map(item => ({
                device_id: item.device_id,
                tag_id: item.tag_id,
                status: item.status,
                timestamp: item.timestamp   
            }));
        res.json({ sessions });
        return{
            statusCode: 200,
            body: JSON.stringify({ sessions })
        }
    }catch (error) {
        console.error("", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    } 
}