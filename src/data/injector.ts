import { MainRepository } from "./mainRepository";
import * as AWS from "aws-sdk"
import { RedisCache } from './redisCache';
import { MainResolver } from "./mainResolver";
import Redis from 'ioredis';


const redisUrl = process.env.REDIS_URL
const redis = new Redis(redisUrl)
const redisCache = new RedisCache(redis)
const documentClient = new AWS.DynamoDB.DocumentClient()
export const mainRepository = new MainRepository(documentClient, redisCache)
export const mainResolver = new MainResolver(mainRepository)
