import * as AWS from "aws-sdk"
import { v4 as uuid } from 'uuid';
import './model/Event'
import './model/Location'
import './model/User'
import { Repository } from "./Repository";
import { EventType, EventFull, Event } from "./model/Event";
import { Location } from "./model/Location";

const documentClient = new AWS.DynamoDB.DocumentClient()
const userTableName: string = process.env.USERS_TABLE_NAME!
const eventsTableName: string = process.env.GEOFENCE_EVENTS_TABLE_NAME!

export class DynamoDbRepository implements Repository {
    documentClient: AWS.DynamoDB.DocumentClient
    userTableName: string
    eventsTableName: string

    constructor(documentClient: AWS.DynamoDB.DocumentClient, userTableName: string, eventsTableName: string) {
        this.documentClient = documentClient
        this.userTableName = userTableName
        this.eventsTableName = eventsTableName
    }

    async createEvent(userId: string, eventType: EventType, userLocation: Location): Promise<EventFull> {
        //Get most recent event and see if it is alternating event type, otherwise ignore.
        const latestEvent = await this.getLatestEventForUser(userId)
        if (latestEvent && latestEvent.eventType === eventType) {
            return latestEvent
        }
        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: eventsTableName,
            Item: {
                id: uuid(),
                timestamp: Date.now(),
                eventType: eventType.toString(),
                userLocationLat: userLocation.lat,
                userLocationLng: userLocation.lng,
                userId: userId
            }
        }
        await documentClient.put(params).promise()
        return this.convertItemToEvent(params.Item)
    }

    async updateUserScore(userId: string, score: number) {
        const userParams: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: userTableName,
            Key: { id: userId },
            UpdateExpression: 'set #score = :score',
            ExpressionAttributeNames: {
                '#score': 'score'
            },
            ExpressionAttributeValues: {
                ':score': score
            }
        }
        await documentClient.update(userParams).promise()
    }

    async getEventsFromStartTime(userId: string, startTimestamp: number): Promise<Event[]> {
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: eventsTableName,
            IndexName: "time-index",
            KeyConditionExpression: '#userId = :userId AND #timestamp >= :startTimestamp',
            ExpressionAttributeNames: {
                '#userId': "userId",
                '#timestamp': "timestamp"
            },
            ExpressionAttributeValues: {
                ':userId': userId,
                ':startTimestamp': startTimestamp
            }
        }

        const result = await documentClient.query(eventParams).promise()
        if (!result.Items) {
            return []
        }
        return result.Items.map((item: any) => {
            return this.convertItemToEvent(item)
        })
    }

    async getLatestEventForUser(userId: string): Promise<EventFull | undefined> {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: eventsTableName,
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

        const result = await documentClient.query(params).promise()
        if (!result.Items || result.Items.length == 0) {
            return undefined
        }
        const item = result.Items[0]
        return this.convertItemToEvent(item)
    }

    async updateUsername(userId: string, username: string) {
        const params = {
            TableName: userTableName,
            Key: { id: userId },
            UpdateExpression: 'SET #username = :username',
            ExpressionAttributeNames: {
                '#username': 'username'
            },
            ExpressionAttributeValues: {
                ':username': username
            }
        }
        await documentClient.update(params).promise()
    }

    async getCurrentUser(userId: string): Promise<User | undefined> {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
            TableName: userTableName,
            Key: { id: userId }
        }
        const result = await documentClient.get(params).promise()
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

export default new DynamoDbRepository(
    new AWS.DynamoDB.DocumentClient(),
    process.env.USERS_TABLE_NAME!,
    process.env.GEOFENCE_EVENTS_TABLE_NAME!
)