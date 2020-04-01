import * as admin from 'firebase-admin'
const serviceAccount = require('./serviceAccountKey.json');

const initializeSdk = function () {
    // Check if Firebase Admin SDK is already initialized, if not, then do it
    if (admin.apps.length == 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }
}

// Helper funtion for generating the response API Gateway requires to handle the token verification
const generateIamPolicy = (effect, resource, data) => {
    // Map values into context object passed into Lambda function, if data is present
    console.log(">>DATA: " + JSON.stringify(data))

    const authResponse = {
        principalId: data ? data.user_id : 'unavailable',
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: effect,
                    Resource: resource
                }
            ]
        },
        context: {
            userId: data.user_id,
            email: data.email,
            name: data.name,
            picture: data.picture
        }
    }
    console.log(">> Authresponse: " + JSON.stringify(authResponse))

    return authResponse;
}

console.log(">>Starting up")
export const handler = async (event, context) => {
    try {
        console.log(">>inside exports")
        // Return from function if no authorizationToken present in header
        // context.fail('Unauthorized') will trigger API Gateway to return 401 response
        if (!event.authorizationToken) {
            console.log(">> missing token")
            return context.fail('Unauthorized');
        }

        // If auhorizationToken is present, split on space looking for format 'Bearer <token value>'
        const tokenParts = event.authorizationToken.split(' ');
        const tokenValue = tokenParts[1];

        // Return from function if authorization header is not formatted properly
        if (!(tokenParts[0].toLowerCase() === 'bearer' && tokenValue)) {
            console.log(">> header not formatted properly")
            return context.fail('Unauthorized');
        }

        // Prepare for validating Firebase JWT token by initializing SDK
        initializeSdk();
        console.log(">> initialized sdk")

        // Call the firebase-admin provided token verification function with
        // the token provided by the client
        // Generate Allow on successful validation, otherwise catch the error and Deny the request
        let resp = await admin.auth().verifyIdToken(tokenValue);

        console.log(">> FIREBASE authorization response: " + JSON.stringify(resp))
        return generateIamPolicy('Allow', event.methodArn, resp);

    } catch (err) {
        console.log(">> error validating: " + err)
        return generateIamPolicy('Deny', event.methodArn, null);
    }
}