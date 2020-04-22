import * as AWS from "aws-sdk"
import { MainRepository } from "../../src/data/mainRepository";
import { User, Event, LeaderboardScore } from '../../src/data/model/Types';
import * as faker from 'faker'
import * as Redis from 'ioredis-mock';
import { RedisCache } from "../../src/data/redisCache";
import { assert } from "chai";
import { Redis as RedisInterface } from "ioredis";
import { v4 as uuid } from 'uuid';

const redis: RedisInterface = new Redis()
const redisCache = new RedisCache(redis)
const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
const repository = new MainRepository(documentClient, redisCache)
const expectedUser = {
    userId: 'bb463b8b-b76c-4f6a-9726-65ab5730b69b',
    username: 'Lonnie.Deckow'
}
const lonnieUserId = expectedUser.userId

async function createFakeUser(prefix = ""): Promise<User> {
    return await repository.createUser(prefix + uuid(), uuid())
}

describe("Main repository tests", () => {
    beforeEach('Flush redis', async () => {
        await redis.flushall()
    })

    after('Close down redis', async () => {
        await redis.quit()
    })

    beforeEach('Reset faker', () => {
        faker.seed(123)
    })

    it('Should follow user', async () => {
        const userIdToFollow = '5ce32379-318e-42ae-bf07-9488242cb158'

        //Verify that we are not currently following this user
        const followedUsersPrevious = await repository.getFollowedUsers(lonnieUserId)
        const hasFollowedUser = followedUsersPrevious.filter(user => {
            return user.userId === userIdToFollow
        }).length == 1
        assert.ok(!hasFollowedUser, "Currently is following user, should not be")

        //Follow user
        const followedUserPrevious = await repository.getUser(userIdToFollow) ?? assert.fail("No followed previous user found")
        const currentUserPrevious = await repository.getUser(lonnieUserId) ?? assert.fail("No current user previous found")
        await repository.followUser(lonnieUserId, userIdToFollow)
        const currentUser = await repository.getUser(lonnieUserId) ?? assert.fail("No current user found")
        const followedUser = await repository.getUser(userIdToFollow) ?? assert.fail("No followed user found")

        //Verify that the follower and following counts were updated
        assert.equal(currentUser.followingCount, (currentUserPrevious.followingCount ?? 0) + 1)
        assert.equal(followedUser.followerCount, (followedUserPrevious.followerCount ?? 0) + 1)

        //Verify that getFollowedUsers returns our newly followed user
        const followedUsers = await repository.getFollowedUsers(lonnieUserId)
        const followedUserFromResult = followedUsers.filter(user => {
            return user.userId === userIdToFollow
        })[0]
        assert.deepStrictEqual(followedUserFromResult, followedUser, "Followed user does not match")

        //Verify that getFollowers on target user returns our user
        const followingUsers = await repository.getFollowers(userIdToFollow)
        const followingUsersFromResult = followingUsers.filter(user => {
            return user.userId === lonnieUserId
        })[0]
        assert.deepStrictEqual(followingUsersFromResult, currentUser, "Following user does not match")

        const userIds = await repository.getWhichUsersAreFollowed(lonnieUserId, [userIdToFollow, 'b8f05ac0-90be-4246-8355-d80a8132e57a'])
        assert.equal(userIds.length, 1)
        assert.equal(userIds[0], userIdToFollow)

        //Test no followers on user
        const noFollowersResult = await repository.getFollowers(uuid())
        assert.equal(noFollowersResult.length, 0)
    })

    it('Should unfollow user', async () => {
        const userIdToUnfollow = '5ce32379-318e-42ae-bf07-9488242cb158'

        //Verify that we are currently following this user
        const followedUsersPrevious = await repository.getFollowedUsers(lonnieUserId)
        const hasFollowedUser = followedUsersPrevious.filter(user => {
            return user.userId === userIdToUnfollow
        }).length == 1
        assert.ok(hasFollowedUser, "Does not have followed user!")

        //Unfollow user
        const followedUserPrevious = await repository.getUser(userIdToUnfollow) ?? assert.fail("No followed previous user found")
        const currentUserPrevious = await repository.getUser(lonnieUserId) ?? assert.fail("No current user previous found")
        await repository.unfollowUser(lonnieUserId, userIdToUnfollow)
        const currentUser = await repository.getUser(lonnieUserId) ?? assert.fail("No current user found")
        const followedUser = await repository.getUser(userIdToUnfollow) ?? assert.fail("No followed user found")

        //Verify that the follower and following counts were decreased
        assert.equal(currentUser.followingCount, (currentUserPrevious.followingCount ?? 0) - 1)
        assert.equal(followedUser.followerCount, (followedUserPrevious.followerCount ?? 0) - 1)

        //Verify that getFollowedUsers does not retturn our newly followed user
        const hasFollowedUserAfter = followedUsersPrevious.filter(user => {
            return user.userId === userIdToUnfollow
        }).length == 0
        assert.ok(!hasFollowedUserAfter, "User still has followed user after unfollow")
    })

    it('Should search for users', async () => {
        const results = await repository.searchUsers('t')
        assert.equal(results.length, 1)

        const results2 = await repository.searchUsers(uuid())
        assert.equal(results2.length, 0)
    })

    it('Should find user and events after start time', async () => {
        const oneDay = 24 * 60 * 60 * 1000
        const startTime = new Date(oneDay).toISOString()
        const { user, events } = await repository.getUserAndEventsFromStartTime(lonnieUserId, startTime)
        if (!user) {
            assert.fail("User not found")
        }

        assert.equal(user.userId, expectedUser.userId)
        assert.equal(user.username, expectedUser.username)

        events.forEach((event) => {
            assert(event.userId == lonnieUserId, "UserIds do not match")
            assert(event.eventType === "HOME" || event.eventType === "AWAY", "Event type is invalid")
            assert(event.timestamp >= startTime, "Timestamp should be >= start time")
        })

        //Test getting events for noexistent user
        const emptyResult = await repository.getUserAndEventsFromStartTime(uuid(), startTime)
        assert.deepEqual(emptyResult, {
            user: undefined,
            events: []
        })
    });

    it('Should not create event if same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(lonnieUserId) ?? assert.fail("No latest event found")
        const testEvent: Event = {
            eventType: latestEvent.eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: lonnieUserId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, latestEvent)
    })

    it('Should create event if not same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(lonnieUserId) ?? assert.fail("No latest event found")
        const eventType = latestEvent.eventType == "HOME" ? "AWAY" : "HOME"
        //Last event for this user is HOME
        const testEvent: Event = {
            eventType: eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: lonnieUserId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, testEvent)
    });

    it('Should not get latest event for nonexistent user', async () => {
        const latestEvent = await repository.getLatestEventForUser(uuid())
        assert.notOk(latestEvent)
    });

    it('Should create new user ', async () => {
        const user = await createFakeUser()
        const expected: User = {
            userId: user.userId,
            username: user.username,
            allTimeScore: 0,
            followerCount: 0,
            followingCount: 0
        }
        assert.deepStrictEqual(user, expected)
    });

    it('Should not create duplicate user ', async () => {
        try {
            await repository.createUser(lonnieUserId, uuid())
            assert.fail("User should not have been created")
        } catch (error) {
            assert.ok("User was not created")
        }
    });

    it('Should get user by id', async () => {
        const user = await repository.getUser(lonnieUserId) ?? assert.fail("No user found")
        assert.equal(user.userId, expectedUser.userId)
        assert.equal(user.username, expectedUser.username)
    });

    it('Should update username', async () => {
        const user = await createFakeUser()
        await repository.updateUsername(user.userId, user.username + 'zzz')
        const userResult = await repository.getUser(user.userId)
        const expectedUser: User = {
            userId: user.userId,
            username: user.username + 'zzz',
            allTimeScore: 0,
            followerCount: 0,
            followingCount: 0
        }
        assert.deepStrictEqual(userResult, expectedUser)

        //Create user if username does not already exists
        const fakeUserId = uuid()
        const fakeusername = uuid()
        await repository.updateUsername(fakeUserId, fakeusername)
        const newUser = await repository.getUser(fakeUserId)
        assert.equal(newUser?.username, fakeusername)
    });

    it('Should update leaderboards', async () => {
        const user1 = await createFakeUser("a")
        const user2 = await createFakeUser("b")
        const user3 = await createFakeUser("c")
        const user4 = await createFakeUser("d")
        const user5 = await createFakeUser("e")
        const user6 = await createFakeUser("f")
        await repository.saveAllTimeScore(user1.userId, 900)
        await repository.saveAllTimeScore(user2.userId, 700)
        await repository.saveAllTimeScore(user3.userId, 700)
        await repository.saveAllTimeScore(user4.userId, 400)
        await repository.saveAllTimeScore(user5.userId, 400)
        await repository.saveAllTimeScore(user6.userId, 200)

        //Fake user ids should not actually be possible
        const scores = await repository.getLeaderboardScoreRange(0, 10)
        assert.equal(scores.length, 6, "Scores has wrong length!")
        const expected1: LeaderboardScore = {
            userId: user1.userId,
            username: user1.username,
            score: 900,
            rank: 1
        }

        const expected2: LeaderboardScore = {
            userId: user2.userId,
            username: user2.username,
            score: 700,
            rank: 2
        }

        const expected3: LeaderboardScore = {
            userId: user3.userId,
            username: user3.username,
            score: 700,
            rank: 2
        }

        const expected4: LeaderboardScore = {
            userId: user4.userId,
            username: user4.username,
            score: 400,
            rank: 3
        }

        const expected5: LeaderboardScore = {
            userId: user5.userId,
            username: user5.username,
            score: 400,
            rank: 3
        }
        const expected6: LeaderboardScore = {
            userId: user6.userId,
            username: user6.username,
            score: 200,
            rank: 4
        }

        assert.deepStrictEqual(scores[0], expected1, "First user is incorrect")
        assert.deepStrictEqual(scores[1], expected3, "Second user is incorrect")
        assert.deepStrictEqual(scores[2], expected2, "Third user is incorrect")
        assert.deepStrictEqual(scores[3], expected5, "Fourth user is incorrect")
        assert.deepStrictEqual(scores[4], expected4, "Fifth user is incorrect")
        assert.deepStrictEqual(scores[5], expected6, "Sixth user is incorrect")
    });

    it('Should save all time score', async () => {
        const user = await createFakeUser()
        await repository.saveAllTimeScore(user.userId, 500)
        const score = await repository.getAllTimeScore(user.userId)
        assert.equal(score, 500)
    });

    it('Should get all time leaderboard rank', async () => {
        const user1 = await createFakeUser("a")
        const user2 = await createFakeUser("b")
        const user3 = await createFakeUser("c")
        const user4 = await createFakeUser("d")
        const user5 = await createFakeUser("e")
        const user6 = await createFakeUser("f")
        await repository.saveAllTimeScore(user1.userId, 900)
        await repository.saveAllTimeScore(user2.userId, 700)
        await repository.saveAllTimeScore(user3.userId, 700)
        await repository.saveAllTimeScore(user4.userId, 400)
        await repository.saveAllTimeScore(user5.userId, 400)
        await repository.saveAllTimeScore(user6.userId, 200)
        assert.equal(1, await repository.getAllTimeLeaderboardRank(user1.userId))
        assert.equal(2, await repository.getAllTimeLeaderboardRank(user3.userId))
        assert.equal(3, await repository.getAllTimeLeaderboardRank(user2.userId))
        assert.equal(4, await repository.getAllTimeLeaderboardRank(user5.userId))
        assert.equal(5, await repository.getAllTimeLeaderboardRank(user4.userId))
        assert.equal(6, await repository.getAllTimeLeaderboardRank(user6.userId))
    });

    it('Should save 24 hour score', async () => {
        const user = await createFakeUser()
        await repository.save24HourScore(user.userId, 200)
    });
})
