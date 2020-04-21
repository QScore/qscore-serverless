import { MainRepository } from "./mainRepository";
import AWS from "aws-sdk";
import * as Redis from 'ioredis';
import { RedisCache } from './redisCache';
import { MainResolver } from "../graphql/resolvers/mainResolver";


const documentClient = new AWS.DynamoDB.DocumentClient()
const redisUrl = process.env.REDIS_URL
const redis = new Redis(redisUrl)
const redisCache = new RedisCache(redis)
export const dynamoDbRepository = new MainRepository(documentClient, redisCache)

export const mainResolver = new MainResolver(dynamoDbRepository)