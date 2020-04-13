/**
 * USAGE: npx ts-node ./scripts/migrateDb.ts
 */
import * as dotenv from 'dotenv'
dotenv.config()

import * as AWS from "aws-sdk"
import { DynamoDbRepository } from "../src/data/DynamoDbRepository"
import { UserV2, EventV2 } from "../src/data/model/Types"

AWS.config.getCredentials(function (err) {
    if (err) console.log(err.stack);
    else { console.log("Credentials loaded, region:", AWS.config.region) }
});

const documentClientLocal = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
const documentClient = new AWS.DynamoDB.DocumentClient(AWS.config)
const dynamoDbRepositoryLocal = new DynamoDbRepository(documentClientLocal)

async function migrateUsersTable() {
    console.log("Migrating users table...")
    let lastEvaluated: any | undefined
    while (true) {
        const params: AWS.DynamoDB.DocumentClient.ScanInput = {
            TableName: 'dev-UsersTable'
        }
        //Scan to find our items
        if (lastEvaluated) {
            params.ExclusiveStartKey = lastEvaluated
        }
        const results = await documentClient.scan(params).promise()
        console.log("Scanning complete, num items: " + results.Items.length)
        results.Items.forEach(async item => {
            //Create user in V2 table
            const user: UserV2 = {
                username: item.username,
                userId: item.id,
                followerCount: 0,
                followingCount: 0
            }

            try {
                await dynamoDbRepositoryLocal.createUserV2(user)
            } catch (error) {
                console.log("ERROR: " + error)
            }
            console.log("Added user " + JSON.stringify(user))
        })

        if (!results.LastEvaluatedKey) {
            break
        }
        lastEvaluated = results.LastEvaluatedKey
    }
}

async function migrateEventsTable() {
    console.log("Migrating events table...")
    let lastEvaluated: any | undefined
    while (true) {
        const params: AWS.DynamoDB.DocumentClient.ScanInput = {
            TableName: 'dev-GeofenceEvents'
        }
        //Scan to find our items
        if (lastEvaluated) {
            params.ExclusiveStartKey = lastEvaluated
        }
        const results = await documentClient.scan(params).promise()
        console.log("Scanning complete, num items: " + results.Items.length)
        results.Items.forEach(async item => {
            //Create event in v2 table
            const event: EventV2 = {
                eventType: item.eventType,
                userId: item.userId,
                timestamp: new Date(item.timestamp).toISOString()
            }

            try {
                await dynamoDbRepositoryLocal.createEvent(event)
            } catch (error) {
                console.log("ERROR: " + error)
            }
            console.log("Added event " + JSON.stringify(event))
        })

        if (!results.LastEvaluatedKey) {
            break
        }
        lastEvaluated = results.LastEvaluatedKey
    }
}

migrateUsersTable()
migrateEventsTable()

