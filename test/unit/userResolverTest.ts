import sinon, { stubInterface } from "ts-sinon";
import * as assert from 'assert'
import { Event, User } from '../../src/data/model/Types';
import { UserResolver } from '../../src/graphql/resolvers/UserResolver';
import { DynamoDbRepository, GetUserAndEventsResult } from '../../src/data/DynamoDbRepository';
import * as AWS from "aws-sdk";
import { Repository } from '../../src/data/Repository';
import * as faker from 'faker';

let clock: sinon.SinonFakeTimers
const testRepository = stubInterface<Repository>()
const testResolver = new UserResolver(testRepository)
const fakeUser: User = {
    userId: faker.random.uuid(),
    username: faker.random.uuid(),
    followerCount: 1337,
    followingCount: 1
}

const documentClient = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
})
const actualResolver = new UserResolver(new DynamoDbRepository(documentClient))
const actualUser = {
    userId: 'bb463b8b-b76c-4f6a-9726-65ab5730b69b',
    username: 'Lonnie.Deckow'
}

describe('User Resolver Unit Tests', function () {
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
            },
            {
                userId: 'user2',
                username: 'gerbert',
            }
        ])

        testRepository.getWhichUsersAreFollowed.resolves([
            'user1'
        ])

        const result = await testResolver.searchUsers(fakeUser.userId, 'g')
        const expectedResult = {
            users: [{
                id: 'user1',
                username: 'gertrude',
                isCurrentUserFollowing: true,
                followingCount: undefined,
                followerCount: undefined
            }, {
                id: 'user2',
                username: 'gerbert',
                isCurrentUserFollowing: false,
                followingCount: undefined,
                followerCount: undefined
            }]
        }

        assert.deepStrictEqual(result, expectedResult)
    })
})

