const qs = require("qs")
const axios = require("axios").default;
const { randomBytes } = require('crypto');

exports.handler = async function(event) {
    const code = event.queryStringParameters?.code;
    if (code == null){
        return {
            statusCode: 400,
            body: "code query param required",
        };
    }
    const data = {
        grant_type: "authorization_code",
        client_id: process.env.COGNITO_CLIENT_ID,
        redirect_uri: process.env.CALLBACK_URL,
        code: code,
    };
    try{
        const res = await axios.post(
            `https://${process.env.COGNITO_DOMAIN}/oauth2/token`,
            qs.stringify(data),
            {headers: {"Content-Type": "application/x-www-form-urlencoded"}}
        );

        const { access_token, refresh_token } = res.data;

        const csrfToken = randomBytes(32).toString('hex');
        
        const httpOnly = 'Secure; HttpOnly; SameSite=Lax; Path=/';
        const readable = 'Secure; SameSite=Lax; Path=/';

        const cookies = [
            `accessToken=${access_token}; ${httpOnly}; Max-Age=3600`,
            `csrfToken=${csrfToken}; ${readable}; Max-Age=3600`,        
        ]

        if(refresh_token){
            cookies.push(`refreshToken=${refresh_token}; ${httpOnly}; Max-Age=${60 * 60 * 24 * 30}`);
        }

        return {
            statusCode: 302,
            multiValueHeaders: {
                'Set-Cookie': cookies,
                Location: [process.env.APP_URL],
            },
        };
    }
    catch(err){
        console.error('Token exchange failed:', err.response?.data ?? err.message);
        return { statusCode: 500, body: 'Token exchange failed'};
    }
};
