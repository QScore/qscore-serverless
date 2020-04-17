import * as AWS from "aws-sdk"
import * as assert from 'assert'
import { DynamoDbRepository } from "../../src/data/DynamoDbRepository";
import { User, Event } from "../../src/data/model/Types";
import * as faker from 'faker'

const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
const repository = new DynamoDbRepository(documentClient)

const expectedUser = {
    userId: 'bb463b8b-b76c-4f6a-9726-65ab5730b69b',
    username: 'Lonnie.Deckow'
}
const userId = expectedUser.userId

describe("DynamoDb New Format Tests", () => {

    it('Should follow user', async () => {
        const userIdToFollow = '95b65a55-334f-4ac1-8606-272614e6cebf'

        //Verify that we are not currently following this user
        const followedUsersPrevious = await repository.getFollowedUsers(userId)
        const hasFollowedUser = followedUsersPrevious.filter(user => {
            return user.userId === userIdToFollow
        }).length == 1
        assert.ok(!hasFollowedUser, "Currently is following user, should not be")

        //Follow user
        const followedUserPrevious = await repository.getUser(userIdToFollow)
        const currentUserPrevious = await repository.getUser(userId)
        await repository.followUser(userId, userIdToFollow)
        const currentUser = await repository.getUser(userId)
        const followedUser = await repository.getUser(userIdToFollow)

        //Verify that the follower and following counts were updated
        assert.equal(currentUser.followingCount, currentUserPrevious.followingCount + 1)
        assert.equal(followedUser.followerCount, followedUserPrevious.followerCount + 1)

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
        const followedUserPrevious = await repository.getUser(userIdToUnfollow)
        const currentUserPrevious = await repository.getUser(userId)
        await repository.unfollowUser(userId, userIdToUnfollow)
        const currentUser = await repository.getUser(userId)
        const followedUser = await repository.getUser(userIdToUnfollow)

        //Verify that the follower and following counts were decreased
        assert.equal(currentUser.followingCount, currentUserPrevious.followingCount - 1)
        assert.equal(followedUser.followerCount, followedUserPrevious.followerCount - 1)

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
        const result = await repository.getUserAndEventsFromStartTime(userId, startTime)

        assert.equal(result.user.userId, expectedUser.userId)
        assert.equal(result.user.username, expectedUser.username)

        result.events.forEach((event) => {
            assert(event.userId == userId)
            assert(event.eventType === "HOME" || event.eventType === "AWAY")
            assert(event.timestamp >= startTime)
        })
    });

    it('Should not create event if same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(userId)
        const testEvent: Event = {
            eventType: latestEvent.eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: userId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, latestEvent)
    })

    it('Should create event if not same event type as previous ', async () => {
        const latestEvent = await repository.getLatestEventForUser(userId)
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
            userId: faker.random.uuid(),
            username: faker.random.uuid(),
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

    it('Should not create user with same username', async () => {
        //TODO: need GSI on username
    });

    it('Should get user by id', async () => {
        const user = await repository.getUser(userId)
        assert.equal(user.userId, expectedUser.userId)
        assert.equal(user.username, expectedUser.username)
    });
})