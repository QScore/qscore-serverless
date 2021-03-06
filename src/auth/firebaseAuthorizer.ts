import * as admin from 'firebase-admin'
import {Context} from 'aws-lambda';
import * as serviceAccount from './serviceAccount.json'

const initializeSdk = function (): void {
    // Check if Firebase Admin SDK is already initialized, if not, then do it
    if (admin.apps.length == 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount.FIREBASE_SERVICE_ACCOUNT as admin.ServiceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }
}

// Helper function for generating the response API Gateway requires to handle the token verification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generateIamPolicy = (effect: any, resource: any, data: any): any => {
    // Map values into context object passed into Lambda function, if data is present
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
            userId: data ? data.user_id : 'unavailable',
            email: data ? data.email : 'unavailable',
            name: data ? data.name : 'unavailable',
            picture: data ? data.picture : 'unavailable'
        }
    }
    return authResponse;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any, context: Context): Promise<any> => {
    try {
        if (process.env.SLS_OFFLINE) {
            return generateIamPolicy('Allow', event.methodArn, {
                // eslint-disable-next-line @typescript-eslint/camelcase
                user_id: "bb463b8b-b76c-4f6a-9726-65ab5730b69b",
            });
        }

        // Prepare for validating Firebase JWT token by initializing SDK
        initializeSdk();

        // Return from function if no authorizationToken present in header
        // context.fail('Unauthorized') will trigger API Gateway to return 401 response
        if (!event.authorizationToken) {
            console.log("Missing token")
            return context.fail('Unauthorized');
        }

        // If auhorizationToken is present, split on space looking for format 'Bearer <token value>'
        const tokenParts = event.authorizationToken.split(' ');
        const tokenValue = tokenParts[1];

        // Return from function if authorization header is not formatted properly
        if (!(tokenParts[0].toLowerCase() === 'bearer' && tokenValue)) {
            console.log("Header not formatted properly")
            return context.fail('Unauthorized');
        }

        // Call the firebase-admin provided token verification function with
        // the token provided by the client
        // Generate Allow on successful validation, otherwise catch the error and Deny the request
        const resp = await admin.auth().verifyIdToken(tokenValue);

        console.log("Allowing request")
        return generateIamPolicy('Allow', event.methodArn, resp);
    } catch (err) {
        console.log("Error validating: " + err)
        return generateIamPolicy('Deny', event.methodArn, null);
    }
}