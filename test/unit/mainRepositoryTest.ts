import {Event, LeaderboardScore, User} from '../../src/data/model/types';
import faker from 'faker'
import {assert} from "chai";
import {v4 as uuid} from 'uuid';
import {testRedis, testRepository} from '../../src/data/testInjector';

const redis = testRedis
const repository = testRepository

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
        let user = await repository.createUser(uuid(), uuid())
        let userToFollow = await repository.createUser(uuid(), uuid())

        //Follow user
        await repository.followUser(user.userId, userToFollow.userId)

        //Verify that the follower and following counts were updated

        user = await repository.getUser(user.userId) ?? assert.fail("Missing user")
        userToFollow = await repository.getUser(userToFollow.userId) ?? assert.fail("Missing user")
        assert.equal(user.followingCount, 1)
        assert.equal(user.followerCount, 0)
        assert.equal(userToFollow.followerCount, 1)
        assert.equal(userToFollow.followingCount, 0)

        //Verify that getFollowedUsers returns our newly followed user
        const followedUsers = await repository.getFollowedUsers(user.userId)
        assert.deepStrictEqual(followedUsers[0], userToFollow, "Followed user does not match")

        //Verify that getFollowers on target user returns our user
        const followingUsers = await repository.getFollowers(userToFollow.userId)
        assert.deepStrictEqual(followingUsers[0], user, "Following user does not match")

        const userIds = await repository.getWhichUsersAreFollowed(user.userId, [userToFollow.userId, 'b8f05ac0-90be-4246-8355-d80a8132e57a'])
        assert.equal(userIds.length, 1)
        assert.equal(userIds[0], userToFollow.userId)

        //Unfollow user
        await repository.unfollowUser(user.userId, userToFollow.userId)
        user = await repository.getUser(user.userId) ?? assert.fail("Missing user")
        userToFollow = await repository.getUser(userToFollow.userId) ?? assert.fail("Missing user")
        //Verify that the follower and following counts were updated
        assert.equal(user.followingCount, 0)
        assert.equal(user.followerCount, 0)
        assert.equal(userToFollow.followerCount, 0)
        assert.equal(userToFollow.followingCount, 0)

        //Get followed users
        const followedUsers2 = await repository.getFollowers(user.userId)
        assert.equal(followedUsers2.length, 0)

        //Get following users
        const followingUsers2 = await repository.getFollowers(userToFollow.userId)
        assert.equal(followingUsers2.length, 0)
    })

    it('Should search for users', async () => {
        const results = await repository.searchUsers('t', 50)
        assert.equal(results.users.length, 1)

        const results2 = await repository.searchUsers(uuid(), 50)
        assert.equal(results2.users.length, 0)
    })

    it('Should not create event if same event type as previous ', async () => {
        const user = await createFakeUser()
        await repository.createEvent({
            eventType: "HOME",
            timestamp: "100",
            userId: user.userId
        })

        const latestEvent = await repository.getLatestEventForUser(user.userId) ?? assert.fail("No latest event found")

        const testEvent: Event = {
            eventType: latestEvent.eventType,
            timestamp: new Date(Date.now()).toISOString(),
            userId: user.userId
        }
        const result = await repository.createEvent(testEvent)
        assert.deepStrictEqual(result, latestEvent)
    })

    it('Should create event if not same event type as previous ', async () => {
        const user = await createFakeUser()
        await repository.createEvent({
            eventType: "HOME",
            timestamp: "100",
            userId: user.userId
        })

        await repository.getLatestEventForUser(user.userId) ?? assert.fail("No latest event found")

        const testEvent: Event = {
            eventType: "AWAY",
            timestamp: new Date(Date.now()).toISOString(),
            userId: user.userId
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
            followingCount: 0,
            avatar: undefined
        }
        assert.deepStrictEqual(user, expected)
    });

    it('Should update user', async () => {
        const user = await createFakeUser()
        await repository.updateUserInfo({
            userId: user.userId,
            username: user.username + 'zzz'
        })
        const userResult = await repository.getUser(user.userId)
        const expectedUser: User = {
            userId: user.userId,
            username: user.username + 'zzz',
            avatar: undefined,
            allTimeScore: 0,
            followerCount: 0,
            followingCount: 0
        }
        assert.deepStrictEqual(userResult, expectedUser)
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

        // //Fake user ids should not actually be possible
        const scores = await repository.getLeaderboardScoreRange(0, 10)
        assert.equal(scores.length, 6, "Scores has wrong length!")
        const expected1: LeaderboardScore = {
            user: user1,
            score: 900,
            rank: 1
        }

        const expected2: LeaderboardScore = {
            user: user2,
            score: 700,
            rank: 2
        }

        const expected3: LeaderboardScore = {
            user: user3,
            score: 700,
            rank: 2
        }

        const expected4: LeaderboardScore = {
            user: user4,
            score: 400,
            rank: 3
        }

        const expected5: LeaderboardScore = {
            user: user5,
            score: 400,
            rank: 3
        }
        const expected6: LeaderboardScore = {
            user: user6,
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
})
