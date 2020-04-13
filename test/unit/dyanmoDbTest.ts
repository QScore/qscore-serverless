import * as AWS from "aws-sdk"
import sinon from "ts-sinon";
import * as assert from 'assert'
import { DynamoDbRepository } from "../../src/data/DynamoDbRepository";
import { UserV2, EventV2 } from "../../src/data/model/Types";
import * as faker from 'faker'

const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})

const userV2TableName = process.env.USERS_TABLE_V2
const repository = new DynamoDbRepository(documentClient)

const userId = '764f64a6-f37f-4c48-9d65-416320cca025'
const username = 'Alanna_Bogan'

describe("DynamoDb New Format Tests", () => {
    it('Should find user and events after start time', async () => {
        const oneDay = 24 * 60 * 60 * 1000
        const startTime = new Date(oneDay).toISOString()
        const result = await repository.getUserAndEventsFromStartTime(userId, startTime)

        const expectedUser: UserV2 = {
            userId: '764f64a6-f37f-4c48-9d65-416320cca025',
            username: 'Alanna_Bogan',
            followerCount: 8976,
            followingCount: 3463
        }
        assert.deepStrictEqual(result.user, expectedUser)

        result.events.forEach((event) => {
            assert(event.userId == userId)
            assert(event.eventType === "HOME" || event.eventType === "AWAY")
            assert(event.timestamp >= startTime)
        })
    });

    it('Should not create event if same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(userId)
        const testEvent: EventV2 = {
            eventType: latestEvent.eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: userId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, latestEvent)
    })

    it('Should create event if not same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(userId)
        const eventType = latestEvent.eventType == "HOME" ? "AWAY" : "HOME"
        //Last event for this user is HOME
        const testEvent: EventV2 = {
            eventType: eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: userId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, testEvent)
    });

    it('Should create new user ', async () => {
        const user: UserV2 = {
            userId: faker.random.uuid(),
            username: faker.random.uuid(),
            followerCount: 1337,
            followingCount: 1
        }
        try {
            await repository.createUserV2(user)
            assert.ok("User created successfully")
        } catch (error) {
            assert.fail(error)
        }
    });

    it('Should not create duplicate user ', async () => {
        const user: UserV2 = {
            userId: '764f64a6-f37f-4c48-9d65-416320cca025',
            username: 'Alanna_Bogan',
            followerCount: 1337,
            followingCount: 1
        }
        try {
            await repository.createUserV2(user)
            assert.fail("User should not have been created")
        } catch (error) {
            assert.ok("User was not created")
        }
    });

    it('Should not create user with same username', async () => {
        //TODO: need GSI on username
    });



    //Should not create user if user exists with same id or username
})