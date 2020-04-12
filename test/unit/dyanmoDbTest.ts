import * as AWS from "aws-sdk"
import sinon from "ts-sinon";
import * as assert from 'assert'
import { DynamoDbRepository } from "../../src/data/DynamoDbRepository";

const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})

const userV2TableName = process.env.USERS_TABLE_V2

const repository = new DynamoDbRepository(documentClient)
let clock: sinon.SinonFakeTimers

before(function () {
    clock = sinon.useFakeTimers({
        now: 24 * 60 * 60 * 1000
    });
})

before(function () {
    clock.restore();
})

describe("DynamoDb New Format Tests", () => {
    it('Should find user and events in last 24 hours', async () => {
        const userId = 123
        const startTimestamp = 1200
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: userV2TableName,
            KeyConditionExpression: '#PK = :PK AND #SK >= :SK',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': "USER#" + userId,
                ':SK': "EVENT#" + startTimestamp
            },
            ScanIndexForward: false
        }

        const result = await documentClient.query(params).promise()
        console.log("Results: " + JSON.stringify(result))
        assert.equal(result.Items.length, 2, "Wrong number of items retrieved")
    });

    // it('Should add new geofence event', async () => {
    //     const result = await repository.createEventV2("bigPhil", "HOME", { lat: "345", lng: "458" })
    //     console.log(">>RESULT:" + result)
    // })
})