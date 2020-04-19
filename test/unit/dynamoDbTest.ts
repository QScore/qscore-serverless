import * as AWS from "aws-sdk"
import * as assert from 'assert'
import { DynamoDbRepository } from "../../src/data/dynamoDbRepository";
import { User, Event, LeaderboardScore } from '../../src/data/model/Types';
import * as faker from 'faker'
import * as Redis from 'ioredis-mock';

describe("DynamoDb New Format Tests", () => {
    const redis = new Redis()
    const documentClient = new AWS.DynamoDB.DocumentClient({
        region: 'localhost',
        endpoint: 'http://localhost:8000'
    })
    const repository = new DynamoDbRepository(documentClient, redis)
    const expectedUser = {
        userId: 'bb463b8b-b76c-4f6a-9726-65ab5730b69b',
        username: 'Lonnie.Deckow'
    }
    const userId = expectedUser.userId

    before('Flush redis', async () => {
        redis.flushall()
    })

    after('Close down redis', async () => {
        redis.quit()
    })

    it('Should follow user', async () => {
        const userIdToFollow = '95b65a55-334f-4ac1-8606-272614e6cebf'

        //Verify that we are not currently following this user
        const followedUsersPrevious = await repository.getFollowedUsers(userId)
        const hasFollowedUser = followedUsersPrevious.filter(user => {
            return user.userId === userIdToFollow
        }).length == 1
        assert.ok(!hasFollowedUser, "Currently is following user, should not be")

        //Follow user
        const followedUserPrevious = await repository.getUser(userIdToFollow) ?? assert.fail("No followed previous user found")
        const currentUserPrevious = await repository.getUser(userId) ?? assert.fail("No current user previous found")
        await repository.followUser(userId, userIdToFollow)
        const currentUser = await repository.getUser(userId) ?? assert.fail("No current user found")
        const followedUser = await repository.getUser(userIdToFollow) ?? assert.fail("No followed user found")

        //Verify that the follower and following counts were updated
        assert.equal(currentUser.followingCount, (currentUserPrevious.followingCount ?? 0) + 1)
        assert.equal(followedUser.followerCount, (followedUserPrevious.followerCount ?? 0) + 1)

        //Verify that getFollowedUsers returns our newly followed user
        const followedUsers = await repository.getFollowedUsers(userId)
        const followedUserFromResult = followedUsers.filter(user => {
            return user.userId === userIdToFollow
        })[0]
        assert.deepStrictEqual(followedUserFromResult, followedUser)

        //Verify that getFollowers on target user returns our user
        const followingUsers = await repository.getFollowers(userIdToFollow)
        const followingUsersFromResult = followingUsers.filter(user => {
            return user.userId === userId
        })[0]
        assert.deepStrictEqual(followingUsersFromResult, currentUser)

        const userIds = await repository.getWhichUsersAreFollowed(userId, [userIdToFollow, 'b8f05ac0-90be-4246-8355-d80a8132e57a'])
        assert.equal(userIds.length, 1)
        assert.equal(userIds[0], userIdToFollow)
    })

    it('Should unfollow user', async () => {
        const userIdToUnfollow = '95b65a55-334f-4ac1-8606-272614e6cebf'

        //Verify that we are currently following this user
        const followedUsersPrevious = await repository.getFollowedUsers(userId)
        const hasFollowedUser = followedUsersPrevious.filter(user => {
            return user.userId === userIdToUnfollow
        }).length == 1
        assert.ok(hasFollowedUser, "Does not have followed user!")

        //Unfollow user
        const followedUserPrevious = await repository.getUser(userIdToUnfollow) ?? assert.fail("No followed previous user found")
        const currentUserPrevious = await repository.getUser(userId) ?? assert.fail("No current user previous found")
        await repository.unfollowUser(userId, userIdToUnfollow)
        const currentUser = await repository.getUser(userId) ?? assert.fail("No current user found")
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
        const results = await repository.searchUsers('c')
        assert.equal(results.length, 2)
    })

    it('Should find user and events after start time', async () => {
        const oneDay = 24 * 60 * 60 * 1000
        const startTime = new Date(oneDay).toISOString()
        const { user, events } = await repository.getUserAndEventsFromStartTime(userId, startTime)
        if (!user) {
            assert.fail("User not found")
        }

        assert.equal(user.userId, expectedUser.userId)
        assert.equal(user.username, expectedUser.username)

        events.forEach((event) => {
            assert(event.userId == userId)
            assert(event.eventType === "HOME" || event.eventType === "AWAY")
            assert(event.timestamp >= startTime)
        })
    });

    it('Should not create event if same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(userId) ?? assert.fail("No latest event found")
        const testEvent: Event = {
            eventType: latestEvent.eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: userId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, latestEvent)
    })

    it('Should create event if not same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(userId) ?? assert.fail("No latest event found")
        const eventType = latestEvent.eventType == "HOME" ? "AWAY" : "HOME"
        //Last event for this user is HOME
        const testEvent: Event = {
            eventType: eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: userId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, testEvent)
    });

    it('Should create new user ', async () => {
        const user: User = {
            userId: 'zzzz' + faker.random.uuid(),
            username: 'zzzz' + faker.random.uuid(),
            followerCount: 1337,
            followingCount: 1
        }
        try {
            await repository.createUser(user)
            assert.ok("User created successfully")
        } catch (error) {
            assert.fail(error)
        }
    });

    it('Should not create duplicate user ', async () => {
        const user: User = {
            userId: userId,
            username: faker.random.uuid(),
            followerCount: 1337,
            followingCount: 1
        }
        try {
            await repository.createUser(user)
            assert.fail("User should not have been created")
        } catch (error) {
            assert.ok("User was not created")
        }
    });

    it('Should get user by id', async () => {
        const user = await repository.getUser(userId) ?? assert.fail("No user found")
        assert.equal(user.userId, expectedUser.userId)
        assert.equal(user.username, expectedUser.username)
    });

    it('Should update user', async () => {
        //First create a new user
        const user: User = {
            userId: 'zzzz' + faker.random.uuid(),
            username: 'zzzz' + faker.random.uuid()
        }
        await repository.createUser(user)

        //First create a new user
        const updatedUser: User = {
            userId: user.userId,
            username: user.username + 'zzz',
            followerCount: undefined,
            followingCount: undefined
        }
        //Then update the user
        const result = await repository.updateUser(updatedUser)
        const userResult = await repository.getUser(user.userId)
        assert.deepStrictEqual(userResult, updatedUser)
    });

    it('Should update leaderboards', async () => {
        const results = await repository.searchUsers('c')
        const user1 = results[0]
        const user2 = results[1]
        await repository.save24HourScore(user1.userId, 300)
        await repository.save24HourScore(userId, 900)
        await repository.save24HourScore(user2.userId, 500)
        const scores = await repository.getTopLeaderboardScores(3)
        console.log(JSON.stringify(scores))
        assert.equal(scores.length, 3, "Scores has wrong length!")
        const expected1: LeaderboardScore = {
            userId: userId,
            username: expectedUser.username,
            score: 900,
            rank: 1
        }

        const expected2: LeaderboardScore = {
            userId: user2.userId,
            username: user2.username,
            score: 500,
            rank: 2
        }

        const expected3: LeaderboardScore = {
            userId: user1.userId,
            username: user1.username,
            score: 300,
            rank: 3
        }
        assert.deepStrictEqual(scores[0], expected1)
        assert.deepStrictEqual(scores[1], expected2)
        assert.deepStrictEqual(scores[2], expected3)
    });
})