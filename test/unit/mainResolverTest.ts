import sinon, { stubInterface } from "ts-sinon";
import { Event, User } from '../../src/data/model/Types';
import { MainResolver } from '../../src/graphql/resolvers/mainResolver';
import { GetUserAndEventsResult, MainRepository } from '../../src/data/mainRepository';
import { Repository } from '../../src/data/repository';
import * as faker from 'faker';
import { Redis as RedisInterface } from "ioredis";
import * as Redis from 'ioredis-mock';
import { v4 as uuid } from 'uuid';
import { RedisCache } from "../../src/data/redisCache";
import * as AWS from "aws-sdk"
import { assert, expect } from "chai";

let clock: sinon.SinonFakeTimers
const testRepository = stubInterface<Repository>()
const testResolver = new MainResolver(testRepository)

const redis: RedisInterface = new Redis()
const redisCache = new RedisCache(redis)
const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})

const repository = new MainRepository(documentClient, redisCache)
const realResolver = new MainResolver(repository)

const fakeUser: User = {
    userId: faker.random.uuid(),
    username: faker.random.uuid(),
    followerCount: 1337,
    followingCount: 1,
    allTimeScore: 0,
    score: 0
}

describe('Main Resolver Unit Tests', function () {
    beforeEach(function () {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000
        });
    })

    afterEach(function () {
        clock.restore();
    })

    it('should calculate score with first event Home', async () => {
        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
            {
                timestamp: new Date(200000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            }]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0.11574074074074073), "Scores do not match!")
    })

    it('should calculate score with first event Away', async () => {
        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
            {
                timestamp: new Date(200000).toISOString(),
                eventType: "HOME",
                userId: "na"
            }
        ]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(99.88426208496094), "Scores do not match!")
    })

    it('should calculate score with only one away event at time 100000', async () => {
        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            }
        ]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0.11574074074074073), "Scores do not match!")
    })

    it('should calculate score with only one away event at time 0', async () => {
        const events: Event[] = [
            {
                timestamp: new Date(0).toISOString(),
                eventType: "AWAY",
                userId: "na"
            }
        ]
        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
    })

    it('should calculate score with only one home event at time 0', async () => {
        const events: Event[] = [
            {
                timestamp: new Date(0).toISOString(),
                eventType: "HOME",
                userId: "na"
            }
        ]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
    })

    it('should calculate score with single home event', async () => {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000 //2 days after 0
        });

        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
        ]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(99.88426208496094), "Scores do not match!")
    })


    it('should calculate score with single away event', async () => {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000//2 days after 0
        });
        const events: Event[] = [
            {
                timestamp: new Date(0).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
        ]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
    })

    it('should calculate score with multiple duplicate events', async () => {
        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
            {
                timestamp: new Date(200000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
            {
                timestamp: new Date(300000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
            {
                timestamp: new Date(400000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
            {
                timestamp: new Date(500000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
            {
                timestamp: new Date(600000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
            {
                timestamp: new Date(700000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
            {
                timestamp: new Date(800000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
        ]

        const mockResult: GetUserAndEventsResult = {
            events: events,
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0.4629629629629629), "Scores do not match!")
    })

    it('should calculate score with no events and last event was HOME', async () => {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000 * 2
        });

        const mockResult: GetUserAndEventsResult = {
            events: [],
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)

        const latestEventResult: Event = {
            eventType: "HOME",
            timestamp: new Date(0).toISOString(),
            userId: fakeUser.userId
        }
        testRepository.getLatestEventForUser.resolves(latestEventResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
    })

    it('should calculate score with no events and last event was AWAY', async () => {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000 * 2
        });

        const mockResult: GetUserAndEventsResult = {
            events: [],
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)

        const latestEventResult: Event = {
            eventType: "AWAY",
            timestamp: new Date(0).toISOString(),
            userId: fakeUser.userId
        }
        testRepository.getLatestEventForUser.resolves(latestEventResult)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
    })

    it('should calculate score with no events at all', async () => {
        const mockResult: GetUserAndEventsResult = {
            events: [],
            user: fakeUser
        }
        testRepository.getUserAndEventsFromStartTime.resolves(mockResult)
        testRepository.getLatestEventForUser.resolves(undefined)
        const result = await testResolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
    })


    it('should search users', async () => {
        testRepository.searchUsers.resolves([
            {
                userId: 'user1',
                username: 'gertrude',
                allTimeScore: 0,
                followerCount: 0,
                followingCount: 0,
                score: 0
            },
            {
                userId: 'user2',
                username: 'gerbert',
                allTimeScore: 0,
                followerCount: 0,
                followingCount: 0,
                score: 0
            }
        ])

        testRepository.getWhichUsersAreFollowed.resolves([
            'user1'
        ])

        const result = await testResolver.searchUsers(fakeUser.userId, 'g')
        const expectedResult = {
            users: [{
                userId: 'user1',
                username: 'gertrude',
                isCurrentUserFollowing: true,
                followingCount: 0,
                followerCount: 0,
                score: 0,
                allTimeScore: 0
            }, {
                userId: 'user2',
                username: 'gerbert',
                isCurrentUserFollowing: false,
                followingCount: 0,
                followerCount: 0,
                score: 0,
                allTimeScore: 0
            }]
        }

        assert.deepStrictEqual(result, expectedResult, "Users do not match")
    })
})

describe('Main Resolver Integration tests', function () {
    it('should get user', async () => {
        const user = await repository.createUser(uuid(), uuid())
        const result = await repository.getUser(user.userId)
        assert.deepStrictEqual(result, user)
    })

    it('should follow and unfollow user', async () => {
        const user1 = await repository.createUser(uuid(), uuid())
        const user2 = await repository.createUser(uuid(), uuid())

        assert.equal(user1.followingCount, 0)
        assert.equal(user2.followingCount, 0)

        await realResolver.followUser(user1.userId, user2.userId)

        const user1Result = await realResolver.getUser(user1.userId)
        const user2Result = await realResolver.getUser(user2.userId)

        assert.equal(user1Result.user?.followingCount, 1)
        assert.equal(user1Result.user?.followerCount, 0)
        assert.equal(user2Result.user?.followerCount, 1)
        assert.equal(user2Result.user?.followingCount, 0)

        //Check follows for user 1
        const followingUser1 = await realResolver.getFollowers(user1.userId)
        const user1Follows = await realResolver.getFollowedUsers(user1.userId)
        assert.equal(followingUser1.users.length, 0)
        assert.equal(user1Follows.users.length, 1)
        const expected1: User = Object.assign(user2, { followerCount: 1 })
        const actual1: User = user1Follows.users[0]
        assert.deepStrictEqual(actual1, expected1)

        //Check follows for user 2
        const followingUser2 = await realResolver.getFollowers(user2.userId)
        const user2Follows = await realResolver.getFollowedUsers(user2.userId)
        assert.equal(followingUser2.users.length, 1)
        assert.equal(user2Follows.users.length, 0)
        const expected2: User = Object.assign(user1, { followingCount: 1 })
        const actual2: User = followingUser2.users[0]
        assert.deepStrictEqual(actual2, expected2)

        //User 1 unfollows user 2
        await realResolver.unfollowUser(user1.userId, user2.userId)
        assert.equal((await realResolver.getFollowers(user1.userId)).users.length, 0)
        assert.equal((await realResolver.getFollowedUsers(user1.userId)).users.length, 0)
        assert.equal((await realResolver.getFollowers(user2.userId)).users.length, 0)
        assert.equal((await realResolver.getFollowedUsers(user2.userId)).users.length, 0)
        assert.equal((await realResolver.getUser(user1.userId)).user?.followingCount, 0)
        assert.equal((await realResolver.getUser(user1.userId)).user?.followerCount, 0)
        assert.equal((await realResolver.getUser(user2.userId)).user?.followingCount, 0)
        assert.equal((await realResolver.getUser(user2.userId)).user?.followerCount, 0)
    })

    it('should search users', async () => {
        const userSuffix = uuid()
        const user = await repository.createUser(uuid(), "Billy" + userSuffix)
        const searchResults1 = (await realResolver.searchUsers(user.userId, "billy")).users
        const searchResults2 = (await realResolver.searchUsers(user.userId, "billy" + userSuffix)).users
        const expected: User = Object.assign(user, {
            isCurrentUserFollowing: false,
            followerCount: undefined,
            followingCount: undefined,
            allTimeScore: undefined,
            score: undefined
        } as User)
        assert(searchResults1.length > 0)
        assert.deepStrictEqual(searchResults2[0], expected)

        //Should show that we are following user
        const user2 = await repository.createUser(uuid(), "Someone" + userSuffix)
        await realResolver.followUser(user.userId, user2.userId)
        const expected2: User = Object.assign(user2, {
            isCurrentUserFollowing: true,
            followerCount: undefined,
            followingCount: undefined,
            allTimeScore: undefined,
            score: undefined
        } as User)
        const searchResults3 = (await realResolver.searchUsers(user.userId, "someone" + userSuffix)).users
        assert.deepStrictEqual(searchResults3[0], expected2)
    })


    it('should update user info', async () => {
        const user1 = await repository.createUser(uuid(), uuid())
        const newUsername = user1.username + "zzz"
        await realResolver.updateUserInfo(user1.userId, user1.username + "zzz")
        const result = await realResolver.getUser(user1.userId)
        assert.equal(result.user?.username, newUsername)
    })

    it('should throw error if user does not exist', async () => {
        try {
            await realResolver.getUser(uuid())
            assert.fail("Returned a user that does not exist")
        } catch (error) {
            assert.ok("Threw error")
        }
    })

    it('creating event should update all time score', async () => {
        const user = await repository.createUser(uuid(), uuid())
        clock = sinon.useFakeTimers({ now: 100 })
        await realResolver.createEvent(user.userId, "HOME")
        let result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0)

        clock = sinon.useFakeTimers({ now: 200 });
        await realResolver.createEvent(user.userId, "AWAY")
        result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 100)

        clock = sinon.useFakeTimers({ now: 300 });
        await realResolver.createEvent(user.userId, "HOME")
        result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 100)

        clock = sinon.useFakeTimers({ now: 500 });
        await realResolver.createEvent(user.userId, "AWAY")
        result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 300)

        //Time elapses, score is the same because last event was AWAY
        clock = sinon.useFakeTimers({ now: 1000 });
        result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 300)

        //Now Home event comes in
        clock = sinon.useFakeTimers({ now: 1500 });
        await realResolver.createEvent(user.userId, "HOME")
        result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 300)

        //Now recheck 500ms later
        clock = sinon.useFakeTimers({ now: 2000 });
        result = await realResolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 800)
    })
})