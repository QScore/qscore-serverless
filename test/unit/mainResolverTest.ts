import sinon, { stubInterface } from "ts-sinon";
import { Event, User, SearchResult } from '../../src/data/model/types';
import { MainResolver } from '../../src/data/mainResolver';
import { GetUserAndEventsResult } from '../../src/data/mainRepository';
import { Repository } from '../../src/data/repository';
import * as faker from 'faker';
import { v4 as uuid } from 'uuid';
import { assert } from "chai";
import { testResolver, testRepository, testRedis } from '../../src/data/testInjector';

let clock: sinon.SinonFakeTimers

const fakeUser: User = {
    userId: faker.random.uuid(),
    username: faker.random.uuid(),
    followerCount: 1337,
    followingCount: 1,
    allTimeScore: 0,
    score: 0,
    avatar: undefined
}

describe('Main Resolver Unit Tests', function () {
    const redis = testRedis
    beforeEach(async function () {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000
        });
        await redis.flushall()
    })

    afterEach(function () {
        clock.restore();
    })

    const testRepository = stubInterface<Repository>()
    const resolver = new MainResolver(testRepository)

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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
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
        const result = await resolver.getCurrentUser(fakeUser.userId)
        const score = result.user.score ?? assert.fail("No score found")
        assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
    })


    it('should search users', async () => {
        testRepository.searchUsers.resolves({
            users: [
                {
                    userId: 'user1',
                    username: 'gertrude',
                    allTimeScore: 0,
                    followerCount: 0,
                    followingCount: 0,
                    score: 0,
                    avatar: undefined
                },
                {
                    userId: 'user2',
                    username: 'gerbert',
                    allTimeScore: 0,
                    followerCount: 0,
                    followingCount: 0,
                    score: 0,
                    avatar: undefined
                }
            ],
            nextCursor: undefined
        })

        testRepository.getWhichUsersAreFollowed.resolves([
            'user1'
        ])

        const result = await resolver.searchUsers(fakeUser.userId, 'g', 50)
        const expectedResult: SearchResult = {
            users: [{
                userId: 'user1',
                username: 'gertrude',
                isCurrentUserFollowing: true,
                followingCount: 0,
                followerCount: 0,
                score: 0,
                allTimeScore: 0,
                avatar: undefined
            }, {
                userId: 'user2',
                username: 'gerbert',
                isCurrentUserFollowing: false,
                followingCount: 0,
                followerCount: 0,
                score: 0,
                allTimeScore: 0,
                avatar: undefined
            }],
            nextCursor: undefined
        }
        assert.deepStrictEqual(result, expectedResult, "Users do not match")
    })
})

describe('Main Resolver Integration tests', function () {
    const repository = testRepository
    const resolver = testResolver
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

        await resolver.followUser(user1.userId, user2.userId)

        const user1Result = await resolver.getUser(user1.userId)
        const user2Result = await resolver.getUser(user2.userId)

        assert.equal(user1Result.user?.followingCount, 1)
        assert.equal(user1Result.user?.followerCount, 0)
        assert.equal(user2Result.user?.followerCount, 1)
        assert.equal(user2Result.user?.followingCount, 0)

        //Check follows for user 1
        const followingUser1 = await resolver.getFollowers(user1.userId)
        const user1Follows = await resolver.getFollowedUsers(user1.userId)
        assert.equal(followingUser1.users.length, 0)
        assert.equal(user1Follows.users.length, 1)
        const expected1: User = Object.assign(user2, { followerCount: 1 })
        const actual1: User = user1Follows.users[0]
        assert.deepStrictEqual(actual1, expected1)

        //Check follows for user 2
        const followingUser2 = await resolver.getFollowers(user2.userId)
        const user2Follows = await resolver.getFollowedUsers(user2.userId)
        assert.equal(followingUser2.users.length, 1)
        assert.equal(user2Follows.users.length, 0)
        const expected2: User = Object.assign(user1, { followingCount: 1 })
        const actual2: User = followingUser2.users[0]
        assert.deepStrictEqual(actual2, expected2)

        //User 1 unfollows user 2
        await resolver.unfollowUser(user1.userId, user2.userId)
        assert.equal((await resolver.getFollowers(user1.userId)).users.length, 0)
        assert.equal((await resolver.getFollowedUsers(user1.userId)).users.length, 0)
        assert.equal((await resolver.getFollowers(user2.userId)).users.length, 0)
        assert.equal((await resolver.getFollowedUsers(user2.userId)).users.length, 0)
        assert.equal((await resolver.getUser(user1.userId)).user?.followingCount, 0)
        assert.equal((await resolver.getUser(user1.userId)).user?.followerCount, 0)
        assert.equal((await resolver.getUser(user2.userId)).user?.followingCount, 0)
        assert.equal((await resolver.getUser(user2.userId)).user?.followerCount, 0)
    })

    it('should search users', async () => {
        const userSuffix = uuid()
        const user = await repository.createUser(uuid(), "Billy" + userSuffix)
        const searchResults1 = (await resolver.searchUsers(user.userId, "billy", 50)).users
        const searchResults2 = (await resolver.searchUsers(user.userId, "billy" + userSuffix, 50)).users
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
        await resolver.followUser(user.userId, user2.userId)
        const expected2: User = Object.assign(user2, {
            isCurrentUserFollowing: true,
            followerCount: undefined,
            followingCount: undefined,
            allTimeScore: undefined,
            score: undefined
        } as User)
        const searchResults3 = (await resolver.searchUsers(user.userId, "someone" + userSuffix, 50)).users
        assert.deepStrictEqual(searchResults3[0], expected2)

        //Should handle case where no users found
        const noUsersResult = (await resolver.searchUsers(user.userId, "fhdsglkjfhdgks", 50)).users
        assert.equal(noUsersResult.length, 0)
    })

    it('should paginate search users', async () => {
        const user = await repository.createUser(uuid(), "Billy" + uuid())
        const user2 = await repository.createUser(uuid(), "Billy" + uuid())
        const searchResults = await resolver.searchUsers(user.userId, "billy", 1)
        assert.equal(searchResults.users.length, 1)
        assert.exists(searchResults.nextCursor)
        const searchResults2 = await resolver.searchUsersWithCursor(searchResults.nextCursor as string)
        assert.equal(searchResults2.users.length, 1)
        assert.notDeepEqual(searchResults2.users[0], searchResults.users[0])
    })


    it('should update user info', async () => {
        const user1 = await repository.createUser(uuid(), uuid())
        const newUsername = user1.username + "zzz"
        await resolver.updateUserInfo(user1.userId, newUsername)
        const result = await resolver.getUser(user1.userId)
        assert.equal(result.user?.username, newUsername)

        //Test updating to the same name
        await resolver.updateUserInfo(user1.userId, newUsername)

        //Test adding an avatar
        const avatar = uuid()
        await resolver.updateUserInfo(user1.userId, newUsername, avatar)
        const result2 = await resolver.getUser(user1.userId)
        assert.equal(result2.user?.avatar, avatar)

        //Updating username should not remove avatar
        const newUsername2 = uuid()
        await resolver.updateUserInfo(user1.userId, newUsername2)
        // const result3 = await resolver.getUser(user1.userId)
        // assert.equal(result3.user?.avatar, avatar)
    })

    it('should throw error if user does not exist', async () => {
        try {
            await resolver.getUser(uuid())
            assert.fail("Returned a user that does not exist")
        } catch (error) {
            assert.ok("Threw error")
        }
    })

    it('should get leaderboard range', async () => {
        const user1 = await repository.createUser("first-" + uuid(), uuid())
        const user2 = await repository.createUser("second-" + uuid(), uuid())
        const user3 = await repository.createUser("third-" + uuid(), uuid())

        clock = sinon.useFakeTimers({ now: 100 })
        await resolver.createEvent(user1.userId, "HOME")

        clock = sinon.useFakeTimers({ now: 200 })
        await resolver.createEvent(user1.userId, "AWAY")
        await resolver.createEvent(user2.userId, "HOME")

        clock = sinon.useFakeTimers({ now: 300 })
        await resolver.createEvent(user1.userId, "HOME")
        await resolver.createEvent(user2.userId, "AWAY")
        await resolver.createEvent(user3.userId, "HOME")

        clock = sinon.useFakeTimers({ now: 400 })
        await resolver.createEvent(user1.userId, "AWAY")
        await resolver.createEvent(user2.userId, "HOME")
        await resolver.createEvent(user3.userId, "AWAY")

        clock = sinon.useFakeTimers({ now: 500 })
        await resolver.createEvent(user1.userId, "HOME")
        await resolver.createEvent(user2.userId, "AWAY")
        await resolver.createEvent(user3.userId, "HOME")

        const result = await resolver.getLeaderboardRange(0, 10)
        assert.deepStrictEqual(result.leaderboardScores[0], {
            rank: 1,
            score: 200,
            user: user2
        })
        assert.deepStrictEqual(result.leaderboardScores[1], {
            rank: 1,
            score: 200,
            user: user1
        })
        assert.deepStrictEqual(result.leaderboardScores[2], {
            rank: 2,
            score: 100,
            user: user3
        })

        clock = sinon.useFakeTimers({ now: 1000 })
        await resolver.getCurrentUser(user1.userId)
        await resolver.getCurrentUser(user2.userId)
        await resolver.getCurrentUser(user3.userId)
        const result2 = await resolver.getLeaderboardRange(0, 10)
        assert.deepStrictEqual(result2.leaderboardScores[0], {
            rank: 1,
            score: 700,
            user: user1
        })
        assert.deepStrictEqual(result2.leaderboardScores[1], {
            rank: 2,
            score: 600,
            user: user3
        })
        assert.deepStrictEqual(result2.leaderboardScores[2], {
            rank: 3,
            score: 200,
            user: user2
        })
    })

    it('should not be able to follow yourself', async () => {
        const userId = uuid()
        const user = await repository.createUser(userId, uuid())
        try {
            await resolver.followUser(userId, userId)
            assert.fail("Was able to follow yourself")
        } catch (error) {
            assert.ok("OK")
        }
        assert.equal(user.followingCount, 0)
        assert.equal(user.followerCount, 0)
        const followingUsers = await resolver.getFollowedUsers(userId)
        assert.equal(followingUsers.users.length, 0)
    })

    it('should not be able to follow user that does not exist', async () => {
        const userId = uuid()
        await repository.createUser(userId, uuid())
        try {
            await resolver.followUser(userId, uuid())
            assert.fail()
        } catch (error) {
            assert.ok("Following user that does not exist produced error")
        }
        const followed = await resolver.getFollowedUsers(userId)
        assert.equal(followed.users.length, 0)
        const followers = await resolver.getFollowers(userId)
        assert.equal(followers.users.length, 0)
    })

    it('creating event should update all time score', async () => {
        const user = await repository.createUser(uuid(), uuid())
        clock = sinon.useFakeTimers({ now: 100 })
        await resolver.createEvent(user.userId, "HOME")
        let result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0)

        clock = sinon.useFakeTimers({ now: 200 });
        await resolver.createEvent(user.userId, "AWAY")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0.000001)

        clock = sinon.useFakeTimers({ now: 300 });
        await resolver.createEvent(user.userId, "HOME")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0.000001)

        clock = sinon.useFakeTimers({ now: 500 });
        await resolver.createEvent(user.userId, "AWAY")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0.000003)

        //Time elapses, score is the same because last event was AWAY
        clock = sinon.useFakeTimers({ now: 1000 });
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0.000003)

        //Now Home event comes in
        clock = sinon.useFakeTimers({ now: 1500 });
        await resolver.createEvent(user.userId, "HOME")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0.000003)

        //Now recheck 500ms later
        clock = sinon.useFakeTimers({ now: 2000 });
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0.000008)
    })
})