import { DynamoDbRepository } from "./dynamoDbRepository";
import AWS from "aws-sdk";
import * as Redis from 'ioredis';


const documentClient = new AWS.DynamoDB.DocumentClient()
const redisUrl = process.env.REDIS_URL
const redis = new Redis(redisUrl)
export const dynamoDbRepository = new DynamoDbRepository(documentClient, redis)
