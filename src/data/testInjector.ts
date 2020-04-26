import { MainRepository } from "./mainRepository";
import * as AWS from "aws-sdk"
import Redis from 'ioredis-mock';
import { RedisCache } from './redisCache';
import { MainResolver } from "../graphql/resolvers/mainResolver";


export const testDocumentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
export const testRedis = new Redis()
export const testRedisCache = new RedisCache(testRedis)
export const testRepository = new MainRepository(testDocumentClient, testRedisCache)
export const testResolver = new MainResolver(testRepository)