import { MainRepository } from "./mainRepository";
import * as AWS from "aws-sdk"
import RedisMock from 'ioredis-mock';
import Redis from 'ioredis'
import { RedisCache } from './redisCache';
import { MainResolver } from "../graphql/resolvers/mainResolver";


export const localDocumentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
export const testRedis = new RedisMock()
export const testRedisCache = new RedisCache(testRedis)
export const testRepository = new MainRepository(localDocumentClient, testRedisCache)
export const testResolver = new MainResolver(testRepository)

export const localRedis = new Redis()
export const localRedisCache = new RedisCache(localRedis)
export const localRepository = new MainRepository(localDocumentClient, localRedisCache)
export const localResolver = new MainResolver(localRepository)
