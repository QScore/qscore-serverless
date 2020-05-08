import sinon from "ts-sinon";
import {User} from '../../src/data/model/types';
import * as faker from 'faker';
import {v4 as uuid} from 'uuid';
import {assert} from "chai";
import {testRepository, testResolver} from '../../src/data/testInjector';

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

describe('Main Resolver Integration tests', function () {
    const repository = testRepository
    const resolver = testResolver

    it('should create new user', async () => {
        const username = uuid()
        const userId = uuid()
        const result = await resolver.createUser(userId, username)
        assert.equal(result.user.username, username)
        assert.equal(result.user.userId, userId)
    })

    it('should get user', async () => {
        const user = await repository.createUser(uuid(), uuid())
        const result = await repository.getUser(user.userId)
        assert.deepStrictEqual(result, user)
    })

    it('should follow and unfollow user', async () => {
        const currentUser = await repository.createUser(uuid(), uuid())
        const user1 = await repository.createUser(uuid(), uuid())
        const user2 = await repository.createUser(uuid(), uuid())

        assert.equal(user1.followingCount, 0)
        assert.equal(user2.followingCount, 0)

        await resolver.followUser(user1.userId, user2.userId)

        const user1Result = await resolver.getUser(currentUser.userId, user1.userId)
        const user2Result = await resolver.getUser(currentUser.userId, user2.userId)

        assert.equal(user1Result.user?.followingCount, 1)
        assert.equal(user1Result.user?.followerCount, 0)
        assert.equal(user2Result.user?.followerCount, 1)
        assert.equal(user2Result.user?.followingCount, 0)

        //Check follows for user 1
        const user1Followers = await resolver.getFollowers(user1.userId, user1.userId)
        const user1Followed = await resolver.getFollowedUsers(user1.userId, user1.userId)
        assert.equal(user1Followers.users.length, 0)
        assert.equal(user1Followed.users.length, 1)
        assert.equal(user1Followed.users[0].isCurrentUserFollowing, true)
        assert.equal(user1Followed.users[0].userId, user2.userId)


        //Check follows for user 2
        const user2Followers = await resolver.getFollowers(user1.userId, user2.userId)
        const user2Follows = await resolver.getFollowedUsers(user1.userId, user2.userId)
        assert.equal(user2Followers.users.length, 1)
        assert.equal(user2Follows.users.length, 0)
        assert.equal(user2Followers.users[0].userId, user1.userId)
        assert.equal(user2Followers.users[0].isCurrentUserFollowing, false)

        //User 1 unfollows user 2
        await resolver.unfollowUser(user1.userId, user2.userId)
        assert.equal((await resolver.getFollowers(user1.userId, user1.userId)).users.length, 0)
        assert.equal((await resolver.getFollowedUsers(user1.userId, user1.userId)).users.length, 0)
        assert.equal((await resolver.getFollowers(user1.userId, user2.userId)).users.length, 0)
        assert.equal((await resolver.getFollowedUsers(user1.userId, user2.userId)).users.length, 0)
        assert.equal((await resolver.getUser(currentUser.userId, user1.userId)).user?.followingCount, 0)
        assert.equal((await resolver.getUser(currentUser.userId, user1.userId)).user?.followerCount, 0)
        assert.equal((await resolver.getUser(currentUser.userId, user2.userId)).user?.followingCount, 0)
        assert.equal((await resolver.getUser(currentUser.userId, user2.userId)).user?.followerCount, 0)
    })

    it('should search users', async () => {
        const userSuffix = uuid()
        const user = await repository.createUser(uuid(), "Billy" + userSuffix)
        const searchResults1 = (await resolver.searchUsers(user.userId, "billy", 50)).users
        const searchResults2 = (await resolver.searchUsers(user.userId, "billy" + userSuffix, 50)).users
        const expected: User = Object.assign(user, {
            isCurrentUserFollowing: false,
            followerCount: 0,
            followingCount: 0,
            allTimeScore: 0,
            rank: undefined,
            score: undefined
        } as User)
        assert(searchResults1.length > 0)
        assert.deepStrictEqual(searchResults2[0], expected)

        //Should show that we are following user
        const user2 = await repository.createUser(uuid(), "Someone" + userSuffix)
        await resolver.followUser(user.userId, user2.userId)
        const expected2: User = Object.assign(user2, {
            isCurrentUserFollowing: true,
            followerCount: 1,
            followingCount: 0,
            allTimeScore: 0,
            rank: undefined,
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
        const searchResults2 = await resolver.searchUsersWithCursor(user.userId, searchResults.nextCursor as string)
        assert.equal(searchResults2.users.length, 1)
        assert.notDeepEqual(searchResults2.users[0], searchResults.users[0])
    })


    it('should update user info', async () => {
        const currentUser = await repository.createUser(uuid(), uuid())
        const user1 = await repository.createUser(uuid(), uuid())
        const newUsername = user1.username + "zzz"
        await resolver.updateUserInfo({userId: user1.userId, username: newUsername})
        const result = await resolver.getUser(currentUser.userId, user1.userId)
        assert.equal(result.user?.username, newUsername)

        //Test updating to the same name
        await resolver.updateUserInfo({userId: user1.userId, username: newUsername})

        //Test adding an avatar
        const avatar = uuid()
        await resolver.updateUserInfo({
            userId: user1.userId,
            avatar: avatar
        })
        const result2 = await resolver.getUser(currentUser.userId, user1.userId)
        assert.equal(result2.user?.avatar, avatar)

        //Updating username should not remove avatar
        const newUsername2 = uuid()
        await resolver.updateUserInfo({
            userId: user1.userId,
            username: newUsername2
        })
        const result3 = await resolver.getUser(currentUser.userId, user1.userId)
        assert.equal(result3.user?.avatar, avatar)
    })

    it('should throw error if user does not exist', async () => {
        try {
            const currentUser = await repository.createUser(uuid(), uuid())
            await resolver.getUser(currentUser.userId, uuid())
            assert.fail("Returned a user that does not exist")
        } catch (error) {
            assert.ok("Threw error")
        }
    })

    it('should get leaderboard range', async () => {
        const user1 = await repository.createUser("first-" + uuid(), uuid())
        const user2 = await repository.createUser("second-" + uuid(), uuid())
        const user3 = await repository.createUser("third-" + uuid(), uuid())

        clock = sinon.useFakeTimers({now: 1000000})
        await resolver.createEvent(user1.userId, "HOME")

        clock = sinon.useFakeTimers({now: 2000000})
        await resolver.createEvent(user1.userId, "AWAY")
        await resolver.createEvent(user2.userId, "HOME")

        clock = sinon.useFakeTimers({now: 3000000})
        await resolver.createEvent(user1.userId, "HOME")
        await resolver.createEvent(user2.userId, "AWAY")
        await resolver.createEvent(user3.userId, "HOME")

        clock = sinon.useFakeTimers({now: 4000000})
        await resolver.createEvent(user1.userId, "AWAY")
        await resolver.createEvent(user2.userId, "HOME")
        await resolver.createEvent(user3.userId, "AWAY")

        clock = sinon.useFakeTimers({now: 5000000})
        await resolver.createEvent(user1.userId, "HOME")
        await resolver.createEvent(user2.userId, "AWAY")
        await resolver.createEvent(user3.userId, "HOME")

        clock = sinon.useFakeTimers({now: 6000000})
        await resolver.createEvent(user1.userId, "AWAY")

        const result = await resolver.getLeaderboardRange(user1.userId, 0, 10)
        assert.equal(result.users[0].userId, user1.userId)
        assert.equal(result.users[0].rank, 1)
        assert.equal(result.users[0].allTimeScore, 300)

        assert.equal(result.users[1].userId, user2.userId)
        assert.equal(result.users[1].rank, 2)
        assert.equal(result.users[1].allTimeScore, 200)

        assert.equal(result.users[2].userId, user3.userId)
        assert.equal(result.users[2].rank, 3)
        assert.equal(result.users[2].allTimeScore, 100)

        clock = sinon.useFakeTimers({now: 10000000})
        await resolver.getCurrentUser(user1.userId)
        await resolver.getCurrentUser(user2.userId)
        await resolver.getCurrentUser(user3.userId)
        const result2 = await resolver.getLeaderboardRange(user1.userId, 0, 10)

        assert.equal(result2.users[0].userId, user3.userId)
        assert.equal(result2.users[0].rank, 1)
        assert.equal(result2.users[0].allTimeScore, 600)

        assert.equal(result2.users[1].userId, user1.userId)
        assert.equal(result2.users[1].rank, 2)
        assert.equal(result2.users[1].allTimeScore, 300)

        assert.equal(result2.users[2].userId, user2.userId)
        assert.equal(result2.users[2].rank, 3)
        assert.equal(result2.users[2].allTimeScore, 200)

        //Test social leaderboard
        await resolver.followUser(user1.userId, user3.userId)
        const socialLeaderboard = await resolver.getSocialLeaderboardRange(user1.userId, 0, 100)
        assert.equal(socialLeaderboard.users.length, 2, "lengths are not equal")
        assert.equal(socialLeaderboard.users[0].userId, user3.userId)
        assert.equal(socialLeaderboard.users[0].rank, 1)
        assert.equal(socialLeaderboard.users[0].allTimeScore, 600)

        assert.equal(socialLeaderboard.users[1].userId, user1.userId)
        assert.equal(socialLeaderboard.users[1].rank, 2)
        assert.equal(socialLeaderboard.users[1].allTimeScore, 300)
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
        const followingUsers = await resolver.getFollowedUsers(user.userId, userId)
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
        const followed = await resolver.getFollowedUsers(userId, userId)
        assert.equal(followed.users.length, 0)
        const followers = await resolver.getFollowers(userId, userId)
        assert.equal(followers.users.length, 0)
    })

    it('creating event should update all time score', async () => {
        const user = await repository.createUser(uuid(), uuid())
        clock = sinon.useFakeTimers({now: 1000000})
        await resolver.createEvent(user.userId, "HOME")
        let result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 0)

        clock = sinon.useFakeTimers({now: 2000000});
        await resolver.createEvent(user.userId, "AWAY")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 100)

        clock = sinon.useFakeTimers({now: 3000000});
        await resolver.createEvent(user.userId, "HOME")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 100)

        clock = sinon.useFakeTimers({now: 5000000});
        await resolver.createEvent(user.userId, "AWAY")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 300)

        //Time elapses, score is the same because last event was AWAY
        clock = sinon.useFakeTimers({now: 10000000});
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 300)

        //Now Home event comes in
        clock = sinon.useFakeTimers({now: 15000000});
        await resolver.createEvent(user.userId, "HOME")
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 300)

        //Now recheck 500ms later
        clock = sinon.useFakeTimers({now: 20000000});
        result = await resolver.getCurrentUser(user.userId)
        assert.equal(result.user.allTimeScore, 800)
    })
})