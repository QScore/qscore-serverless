import {DynamoRepo} from "./dynamoRepo";
import * as AWS from "aws-sdk"
import RedisMock from 'ioredis-mock';
import Redis from 'ioredis'
import {RedisCache} from './redisCache';
import {MainResolver} from "./mainResolver";
import {LazyGetter} from "lazy-get-decorator";

class TestInjector {
    @LazyGetter(true)
    public get localDocumentClient(): RedisMock {
        return new AWS.DynamoDB.DocumentClient({
            region: 'localhost',
            endpoint: 'http://localhost:8000'
        })
    }

    @LazyGetter(true)
    public get testRedis(): RedisMock {
        return new RedisMock()
    }

    @LazyGetter(true)
    public get testRedisCache(): RedisCache {
        return new RedisCache(this.testRedis)
    }

    @LazyGetter(true)
    public get testRepository(): DynamoRepo {
        return new DynamoRepo(this.localDocumentClient)
    }

    @LazyGetter(true)
    public get testResolver(): MainResolver {
        return new MainResolver(this.testRepository, this.testRedisCache)
    }

    @LazyGetter(true)
    public get localRedis(): Redis.Redis {
        return new Redis()
    }

    @LazyGetter(true)
    public get localRedisCache(): RedisCache {
        return new RedisCache(this.localRedis)
    }

    @LazyGetter(true)
    public get localRepository(): DynamoRepo {
        return new DynamoRepo(this.localDocumentClient)
    }

    @LazyGetter(true)
    public get localResolver(): MainResolver {
        return new MainResolver(this.localRepository, this.localRedisCache)
    }
}

export const testInjector = new TestInjector()