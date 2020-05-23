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

    it('Should get leaderboard rank', async () => {
        //Test for nonexistent user
        const result = await redisCache.getGlobalRank(uuid())
        assert.equal(result, -1)

        //Add some scores and test with real user
        const secondUserId = uuid()
        const thirdUserId = uuid()
        const fourthUserId = uuid()
        await redisCache.saveGlobalAllTimeScore(secondUserId, 500)
        await redisCache.saveGlobalAllTimeScore(thirdUserId, 300)
        await redisCache.saveGlobalAllTimeScore(fourthUserId, 200)

        assert.equal(await redisCache.getGlobalRank(secondUserId), 0)
        assert.equal(await redisCache.getGlobalRank(thirdUserId), 1)
        assert.equal(await redisCache.getGlobalRank(fourthUserId), 2)
    })
})