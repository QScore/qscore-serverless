"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const initializeSdk = function () {
    if (admin.apps.length == 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }
};
const generateIamPolicy = (effect, resource, data) => {
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
    };
    return authResponse;
};
exports.handler = async (event, context) => {
    try {
        if (!event.authorizationToken) {
            console.log("Missing token");
            return context.fail('Unauthorized');
        }
        const tokenParts = event.authorizationToken.split(' ');
        const tokenValue = tokenParts[1];
        if (!(tokenParts[0].toLowerCase() === 'bearer' && tokenValue)) {
            console.log("Header not formatted properly");
            return context.fail('Unauthorized');
        }
        initializeSdk();
        let resp = await admin.auth().verifyIdToken(tokenValue);
        console.log("Allowing request");
        return generateIamPolicy('Allow', event.methodArn, resp);
    }
    catch (err) {
        console.log("Error validating: " + err);
        return generateIamPolicy('Deny', event.methodArn, null);
    }
};
//# sourceMappingURL=firebaseAuthorizer.js.map