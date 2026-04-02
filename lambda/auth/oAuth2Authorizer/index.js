const { CognitoJwtVerifier } = require("aws-jwt-verify");


function extractCookie(cookiesArray, cookieName) {
    for (const cookieStr of cookiesArray) {
        const pairs = cookieStr.split(';');
        for (const pair of pairs) {
            const [key, ...rest] = pair.trim().split('=');
            if (key === cookieName) return rest.join('=');
        }
    }
    return null;
}

function safeEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
        let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.COGNITO_CLIENT_ID,
});

exports.handler = async (event) => {
    if (event.cookies == null){
        console.log("No cookies found");
        return {
            isAuthorized: false,
        };
    }
    const accessToken = extractCookie(event.cookies, 'accessToken');
    if (accessToken == null){
        console.log("Access token not found in cookies");
        return {
            isAuthorized: false,
        };
    }

    const method = (event.requestContext?.http?.method ?? 'GET').toUpperCase();
    const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    
    if(isMutating){
        const csrfCookie = extractCookie(event.cookies, 'csrfToken');
        const csrfHeader = 
            event.headers?.['x-csrf-token'] || 
            event.headers?.['X-Csrf-Token'] ||
            event.headers?.['X-CSRF-Token'];
        
        if (!csrfCookie || !csrfHeader || !safeEqual(csrfCookie, csrfHeader)){
            console.log('CSRF validation failed', {
                hasCookie: !!csrfCookie,
                hasHeader: !!csrfHeader,
            });
            return { isAuthorized: false };
        }
    }
    try{
        await verifier.verify(accessToken);
        return {
            isAuthorized: true,
        };
    } catch (e) {
        console.error(e);
        return {
            isAuthorized: false,
        };
    }
};