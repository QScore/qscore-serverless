import {DynamoRepo} from "./dynamoRepo";
import * as AWS from "aws-sdk"
import {RedisCache} from './redisCache';
import {MainResolver} from "./mainResolver";
import Redis from 'ioredis';
import {LazyGetter} from "lazy-get-decorator";


const redisUrl = process.env.REDIS_HOST

class Injector {
    @LazyGetter(true)
    public get redis(): Redis.Redis {
        return new Redis({
            host: redisUrl,
            port: 6379
        })
    }

    @LazyGetter(true)
    public get redisCache(): RedisCache {
        return new RedisCache(this.redis)
    }

    @LazyGetter(true)
    public get documentClient(): AWS.DynamoDB.DocumentClient {
        return new AWS.DynamoDB.DocumentClient()
    }

    @LazyGetter(true)
    public get mainRepository(): DynamoRepo {
        return new DynamoRepo(this.documentClient)
    }

    @LazyGetter(true)
    public get mainResolver(): MainResolver {
        return new MainResolver(this.mainRepository, this.redisCache)
    }
}

export const injector = new Injector()