import {Event} from '../../src/data/model/types';

import faker from 'faker';
import {assert} from 'chai';
import {v4 as uuid} from 'uuid';
import {testInjector} from "../../src/data/testInjector";

const redisClient = testInjector.testRedis
const redisCache = testInjector.testRedisCache
faker.seed(123)

describe("Redis cache tests", () => {
    beforeEach('flush cache', async () => {
        await redisClient.flushall()
    })

    it('Should save and get latest events', async () => {
        const event: Event = {
            userId: faker.random.uuid(),
            eventType: "HOME",
            timestamp: new Date(100).toISOString()
        }

        await redisCache.setLatestEvent(event)
        const latest = await redisCache.getLatestEvent(event.userId)
        const expected: Event = {
            userId: event.userId,
            eventType: event.eventType,
            timestamp: event.timestamp,
        }
        assert.deepStrictEqual(latest, expected)
    })

    it('Should return null for nonexistent event', async () => {
        const result = await redisCache.getLatestEvent(uuid())
        assert.isUndefined(result)
    })

    it('Should get leaderboard rank', async () => {
        //Test for nonexistent user
        const result = await redisCache.getLeaderboardRank(uuid())
        assert.equal(result, -1)

        //Add some scores and test with real user
        const secondUserId = uuid()
        const thirdUserId = uuid()
        const fourthUserId = uuid()
        await redisCache.saveScoreToLeaderboard(secondUserId, 500)
        await redisCache.saveScoreToLeaderboard(thirdUserId, 300)
        await redisCache.saveScoreToLeaderboard(fourthUserId, 200)

        assert.equal(await redisCache.getLeaderboardRank(secondUserId), 0)
        assert.equal(await redisCache.getLeaderboardRank(thirdUserId), 1)
        assert.equal(await redisCache.getLeaderboardRank(fourthUserId), 2)
    })

    it('Should get current user with all time score', async () => {
        const result = await redisCache.getLatestEvent(uuid())
        assert.isUndefined(result)
    })

})