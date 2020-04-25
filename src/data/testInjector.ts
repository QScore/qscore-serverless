import { MainRepository } from "./mainRepository";
import * as AWS from "aws-sdk"
import * as Redis from 'ioredis-mock';
import { RedisCache } from './redisCache';
import { MainResolver } from "../graphql/resolvers/mainResolver";


export const testDocumentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
const redis = new Redis()
export const testRedisCache = new RedisCache(redis)
export const testRepository = new MainRepository(testDocumentClient, testRedisCache)
export const testResolver = new MainResolver(testRepository)

