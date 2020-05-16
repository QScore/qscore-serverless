import https from 'https'
import querystring from 'querystring'
import CognitoIdentityServiceProvider from 'aws-sdk/clients/cognitoidentityserviceprovider'

const region = process.env.AWS_REGION
const userPoolId = process.env.COGNITO_USER_POOL_ID
const cognito = new CognitoIdentityServiceProvider({
    region: region
});

export const facebookLoginHandler = async (event, context, callback) => {
    const json = querystring.parse(event.body)
    const accessToken = json.token

    try {
        const fbInfo = await getFacebookInfo(accessToken)
        console.log(fbInfo)

        const clientId = process.env.COGNITO_APP_CLIENT_ID
        const userId = fbInfo.id
        const password = generatePassword(30)
        const email = fbInfo.email ? fbInfo.email : `${userId}@test.qscore`
        const avatar = fbInfo.picture.data.url
        const userExists = await checkUserExists(email, userId)
        if (userExists) {
            await setPassword(email, password)
        } else {
            const tempPassword = "L5oKeM0mmG1SIa"
            await createUser({
                clientId: clientId,
                username: email,
                email: email,
                password: tempPassword,
                avatar: avatar
            })
            await setPassword(email, password)
            await addUserToGroup("Facebook", email)
        }
        const body = {
            username: email,
            password: password
        }

        console.log(`Finished, username: ${email}, password: ${password}`)
        return {
            statusCode: 200,
            body: JSON.stringify(body)
        }
    } catch (error) {
        console.log(error.stack)
        return {
            statusCode: 500,
            body: error.stack
        }
    }
}

function addUserToGroup(groupName, username) {
    const params = {
        GroupName: groupName,
        UserPoolId: userPoolId,
        Username: username
    };
    return new Promise((resolve, reject) => {
        cognito.adminAddUserToGroup(params, function (err, data) {
            if (err) reject(err)
            else resolve(true)
        });
    })
}

function setPassword(username, password) {
    const params = {
        Username: username,
        Password: password,
        UserPoolId: userPoolId,
        Permanent: true
    };
    return new Promise((resolve, reject) => {
        cognito.adminSetUserPassword(params, function (err, data) {
            if (err) reject(err)
            else resolve(true)
        });
    })
}

function checkUserExists(username) {
    const params = {
        UserPoolId: userPoolId,
        Username: username
    };
    return new Promise((resolve, reject) => {
        cognito.adminGetUser(params, (err, data) => {
            if (err) resolve(false)
            else resolve(true)
        })
    })
}

function createUser({ username, email, password, avatar }) {
    const params = {
        UserPoolId: userPoolId,
        MessageAction: 'SUPPRESS',
        TemporaryPassword: password,
        Username: username, //username,
        UserAttributes: [
            {
                Name: 'email',
                Value: email
            }
        ]
    };

    return new Promise((resolve, reject) => {
        cognito.adminCreateUser(params, function (err, data) {
            if (err) {
                console.log(err)
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

function generatePassword(passwordLength) {
    var numberChars = "0123456789";
    var upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var lowerChars = "abcdefghijklmnopqrstuvwxyz";
    var allChars = numberChars + upperChars + lowerChars;
    var randPasswordArray = Array(passwordLength);
    randPasswordArray[0] = numberChars;
    randPasswordArray[1] = upperChars;
    randPasswordArray[2] = lowerChars;
    randPasswordArray = randPasswordArray.fill(allChars, 3);
    return shuffleArray(randPasswordArray.map(function (x) { return x[Math.floor(Math.random() * x.length)] })).join('');
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function getFacebookInfo(token) {
    const url = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${token}`
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            var body = ''
            res.on('data', (chunk) => {
                body += chunk
            })
            res.on('end', () => {
                try {
                    var json = JSON.parse(body);
                    console.log('id', json.id);
                    console.log('name', json.name);
                    console.log('email', json.email);
                    console.log('url', json.picture.data.url)
                    console.log('success');
                    resolve(json)
                } catch (error) {
                    console.log('error', error);
                    reject(error)
                }
            });
        }).on('error', function (error) {
            console.log(error)
            reject(error)
        })
    })
}