/**
 * USAGE: npx ts-node ./scripts/migrateDb.ts
 */
import * as dotenv from 'dotenv'
dotenv.config()

import * as AWS from "aws-sdk"
import { DynamoDbRepository } from '../src/data/DynamoDbRepository';
import { User, Event } from "../src/data/model/Types"
import { UserResolver } from '../src/graphql/resolvers/UserResolver';

AWS.config.getCredentials(function (err) {
    if (err) console.log(err.stack);
    else { console.log("Credentials loaded, region:", AWS.config.region) }
});

const documentClient = new AWS.DynamoDB.DocumentClient(AWS.config)
const dynamoDbRepository = new DynamoDbRepository(documentClient)
const userResolver = new UserResolver(dynamoDbRepository)

async function testUserScore() {
    const userId = "2MSAXIAGtDgXMgn1W58BNu76BYp2"
    try {
        const result = await userResolver.getCurrentUser(userId)
        console.log(JSON.stringify(result))
    } catch (error) {
        console.log("ERROR: " + error)
    }
}

testUserScore()