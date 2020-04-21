/**
 * USAGE: npx ts-node ./scripts/migrateDb.ts
 */
import * as dotenv from 'dotenv'
dotenv.config()

import * as AWS from "aws-sdk"
import { MainRepository } from '../src/data/mainRepository';
import { User, Event } from "../src/data/model/Types"
import { MainResolver } from '../src/graphql/resolvers/mainResolver';
import Redis from "ioredis";
import { RedisCache } from '../src/data/redisCache';

AWS.config.getCredentials(function (err) {
    if (err) console.log(err.stack);
    else { console.log("Credentials loaded, region:", AWS.config.region) }
});

const redis = new Redis()
const documentClient = new AWS.DynamoDB.DocumentClient(AWS.config)
const redisCache = new RedisCache(redis)
const dynamoDbRepository = new MainRepository(documentClient, redisCache)
const userResolver = new MainResolver(dynamoDbRepository)

async function testUserScore() {
    const userId = "2MSAXIAGtDgXMgn1W58BNu76BYp2"
    try {
        const result = await userResolver.getCurrentUser(userId)
        console.log(JSON.stringify(result))
    } catch (error) {
        console.log("ERROR: " + error)
    }
}

async function testStuff() {
    const redis = new Redis()
    await redis.set("foo", "bar"); // returns promise which resolves to string, "OK"
    redis.del("foo");

    // Arguments to commands are flattened, so the following are the same:
    redis.sadd("set", 1, 3, 5, 7);
    redis.sadd("set", [1, 3, 5, 7]);
    redis.spop("set"); // Promise resolves to "5" or another item in the set

    // Most responses are strings, or arrays of strings
    redis.zadd("sortedSet", "1", "one", "2", "dos", "4", "quatro", "3", "three");
    redis.zrange("sortedSet", 0, 2, "WITHSCORES").then((res) => console.log(res)); // Promise resolves to ["one", "1", "dos", "2", "three", "3"] as if the command was ` redis> ZRANGE sortedSet 0 2 WITHSCORES `

    // Some responses have transformers to JS values
    redis.hset("myhash", "field1", "Hello");
    redis.hgetall("myhash").then((res) => console.log(res)); // Promise resolves to Object {field1: "Hello"} rather than a string, or array of strings

    // All arguments are passed directly to the redis server:
    redis.set("key", 100, "EX", 10); // set's key to value 100 and expires it after 10 seconds
}