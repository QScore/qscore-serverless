import { MainRepository } from "./mainRepository";
import * as AWS from "aws-sdk"
import * as Redis from 'ioredis';
import { RedisCache } from './redisCache';
import { MainResolver } from "../graphql/resolvers/mainResolver";


const redisUrl = process.env.REDIS_URL
const redis = new Redis(redisUrl)
const redisCache = new RedisCache(redis)
const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
export const mainRepository = new MainRepository(documentClient, redisCache)
export const mainResolver = new MainResolver(mainRepository)

