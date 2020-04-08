import * as AWS from "aws-sdk"
import { v4 as uuid } from 'uuid';
import './model/Event'
import './model/Location'
import './model/User'

const documentClient = new AWS.DynamoDB.DocumentClient()
const userTableName: string = process.env.USERS_TABLE_NAME!
const eventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME!

class DynamoDbRepository implements Repository {
    documentClient: AWS.DynamoDB.DocumentClient
    userTableName: string
    eventsTableName: string

    constructor(documentClient: AWS.DynamoDB.DocumentClient, userTableName: string, eventsTableName: string) {
        this.documentClient = documentClient
        this.userTableName = userTableName
        this.eventsTableName = eventsTableName
    }

    async createEvent(userId: string, eventType: EventType, userLocation: Location): Promise<EventFull> {
        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: eventsTableName,
            Item: {
                id: uuid(),
                timestamp: Date.now(),
                eventType: eventType,
                userLocationLat: userLocation.lat,
                userLocationLng: userLocation.lng,
                userId: userId
            }
        }
        await documentClient.put(params).promise()
        return {
            id : params.Item.id,
            timestamp: params.Item.timestamp,
            eventType: params.Item.eventType,
            userLocation: {
                latitude: params.Item.userLocationLat,
                longitude: params.Item.userLocationLng,
            },
            userId: params.Item.userId
        }
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
        return result.Items as Event[]
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

    async getCurrentuser(userId: string): Promise<User | undefined> {
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
}

export default new DynamoDbRepository(
    new AWS.DynamoDB.DocumentClient(),
    process.env.USERS_TABLE_NAME!,
    process.env.GEOFENCE_EVENTS_TABLE_NAME!
)