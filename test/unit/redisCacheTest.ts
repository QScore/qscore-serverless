import * as Redis from 'ioredis-mock';
import { RedisCache, LatestEventRedis } from '../../src/data/redisCache';
import { Event } from '../../src/data/model/Types';

import * as faker from 'faker'
import { assert } from 'chai';
const redisClient = new Redis()
const redisCache = new RedisCache(redisClient)
faker.seed(123)

describe("Redis cache tests", () => {
    it('Should save and get latest events', async () => {
        const event: Event = {
            userId: faker.random.uuid(),
            eventType: "HOME",
            timestamp: new Date(100).toISOString()
        }

        await redisCache.setLatestEvent(event)
        const latest = await redisCache.getLatestEvent(event.userId)
        const expected: LatestEventRedis = {
            userId: event.userId,
            eventType: event.eventType,
            timestamp: event.timestamp,
            scoreUpdatedTs: "-1"
        }
        assert.deepStrictEqual(latest, expected)
    });
})