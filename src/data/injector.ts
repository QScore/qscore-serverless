import * as AWS from "aws-sdk"
import {RedisCache} from './redisCache';
import {MainResolver} from "./mainResolver";
import Redis from 'ioredis';
import {LazyGetter} from "lazy-get-decorator";
import {DynamoRepo} from "./dynamoRepo";


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
    public get dynamoRepo(): DynamoRepo {
        return new DynamoRepo(this.documentClient)
    }

    @LazyGetter(true)
    public get mainResolver(): MainResolver {
        return new MainResolver(this.dynamoRepo, this.redisCache)
    }
}

export const injector = new Injector()