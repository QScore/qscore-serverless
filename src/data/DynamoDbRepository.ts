import * as AWS from "aws-sdk"
import './model/Event'
import './model/Location'
import './model/User'
import { Repository } from "./Repository";
import { EventType, EventFull, Event } from "./model/Event";
import { UserV2, EventV2, EventDynamo, UserDynamo } from "./model/Types";

const userTable = process.env.USERS_TABLE_NAME!
const eventsTable = process.env.GEOFENCE_EVENTS_TABLE_NAME!
const userTableV2 = process.env.USERS_TABLE_V2

export class DynamoDbRepository implements Repository {
    private documentClient: AWS.DynamoDB.DocumentClient

    constructor(documentClient: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient()) {
        this.documentClient = documentClient
    }

    async createEventV2(event: EventV2) {
        //Get most recent event and see if it is alternating event type, otherwise ignore.
        const latestEvent = await this.getLatestEventForUser(event.userId)
        if (latestEvent && latestEvent.eventType === event.eventType) {
            return latestEvent
        }
        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: userTableV2,
            Item: <EventDynamo>{
                PK: `USER#${event.userId}`,
                SK: `EVENT#${event.timestamp}`,
                type: `Event`,
                eventType: event.eventType,
                timestamp: event.timestamp,
                userId: event.userId
            },
            ConditionExpression: "attribute_not_exists(#PK)",
            ExpressionAttributeNames: {
                "#PK": "PK"
            }
        }
        return await this.documentClient.put(params).promise()
    }

    async createUserV2(user: UserV2) {
        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: userTableV2,
            Item: <UserDynamo>{
                PK: `USER#${user.userId}`,
                SK: `EVENT#9999`,
                type: `User`,
                userId: user.userId,
                username: user.username,
                usernameLowercase: user.username.toLowerCase(),
                followerCount: 0,
                followingCount: 0
            },
            ConditionExpression: "attribute_not_exists(#PK)",
            ExpressionAttributeNames: {
                "#PK": "PK"
            }
        }
        return await this.documentClient.put(params).promise()
    }

    async getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult> {
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: userTableV2,
            KeyConditionExpression: '#PK = :PK AND #SK >= :SK',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `USER#${userId}`,
                ':SK': `EVENT#${startTimestamp}`
            },
            ScanIndexForward: false
        }
        const result = await this.documentClient.query(eventParams).promise()
        if (!result.Items) {
            return <GetUserAndEventsResult>{
                user: undefined,
                events: []
            }
        }

        const userAttrs = result.Items.shift() as UserDynamo
        const user: UserV2 = {
            userId: userAttrs.userId,
            followerCount: userAttrs.followerCount,
            followingCount: userAttrs.followingCount,
            username: userAttrs.username
        }

        const events = result.Items.map((item: EventDynamo) => {
            return <EventV2>{
                eventType: item.eventType,
                timestamp: item.timestamp,
                userId: item.userId
            }
        })
        return <GetUserAndEventsResult>{
            user: user,
            events: events
        }
    }

    async getLatestEventForUser(userId: string): Promise<EventFull | undefined> {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: eventsTable,
            IndexName: "time-index",
            KeyConditionExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': "userId"
            },
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: 1,
            ScanIndexForward: false
        }

        const result = await this.documentClient.query(params).promise()
        if (!result.Items || result.Items.length == 0) {
            return undefined
        }
        const item = result.Items[0]
        return this.convertItemToEvent(item)
    }

    async updateUsername(userId: string, username: string) {
        const params = {
            TableName: userTable,
            Key: { id: userId },
            UpdateExpression: 'SET #username = :username',
            ExpressionAttributeNames: {
                '#username': 'username'
            },
            ExpressionAttributeValues: {
                ':username': username
            }
        }
        await this.documentClient.update(params).promise()
    }

    async getCurrentUser(userId: string): Promise<User | undefined> {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
            TableName: userTable,
            Key: { id: userId }
        }
        const result = await this.documentClient.get(params).promise()
        if (!result.Item) {
            return undefined
        }
        return {
            "id": result.Item.id,
            "username": result.Item.username,
            "score": result.Item.score
        }
    }

    convertItemToEvent(item: AWS.DynamoDB.DocumentClient.AttributeMap): EventFull {
        const eventType: string = item.eventType.toString()
        const typedEventType = eventType as keyof typeof EventType;
        return {
            id: item.id,
            timestamp: item.timestamp,
            eventType: EventType[typedEventType],
            userLocation: {
                latitude: item.userLocationLat,
                longitude: item.userLocationLng,
            },
            userId: item.userId
        }
    }
}



export interface GetUserAndEventsResult {
    readonly user?: UserV2,
    readonly events: EventV2[]
}

export const dynamoDbRepository = new DynamoDbRepository()