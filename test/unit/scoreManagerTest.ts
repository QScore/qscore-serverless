import { calculateScore } from '../../src/score/scoreManager'
import sinon, { stubInterface } from "ts-sinon";
import * as assert from 'assert'
import { Repository } from '../../src/data/Repository';
import { Event, EventType, EventFull } from '../../src/data/model/Event';

// let clock: sinon.SinonFakeTimers

// beforeEach(function () {
//     clock = sinon.useFakeTimers({
//         now: 24 * 60 * 60 * 1000
//     });
// })

// afterEach(function () {
//     clock.restore();
// })

// describe('updateScore', function () {
//     it('should calculate score with first event Home', async () => {
//         const repository = stubInterface<Repository>()
//         const events: Event[] = [
//             { timestamp: 100000, eventType: EventType.HOME },
//             { timestamp: 200000, eventType: EventType.AWAY }
//         ]


//         repository.getUserAndEventsFromStartTime.resolves(events)

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(0.11574074074074073), "Scores do not match!")
//     })

//     it('should calculate score with first event Away', async () => {
//         const repository = stubInterface<Repository>()
//         const events: Event[] = [
//             { timestamp: 100000, eventType: EventType.AWAY },
//             { timestamp: 200000, eventType: EventType.HOME }
//         ]


//         repository.getUserAndEventsFromStartTime.resolves(events)

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(99.88426208496094), "Scores do not match!")
//     })

//     it('should calculate score with only one away event at time 100000', async () => {
//         const repository = stubInterface<Repository>()
//         const events: Event[] = [
//             { timestamp: 100000, eventType: EventType.AWAY }
//         ]


//         repository.getUserAndEventsFromStartTime.resolves(events)

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(0.11574074074074073), "Scores do not match!")
//     })

//     it('should calculate score with only one away event at time 0', async () => {
//         const repository = stubInterface<Repository>()
//         const events: Event[] = [
//             { timestamp: 0, eventType: EventType.AWAY }
//         ]


//         repository.getUserAndEventsFromStartTime.resolves(events)

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
//     })

//     it('should calculate score with only one home event at time 0', async () => {
//         const repository = stubInterface<Repository>()
//         const events: Event[] = [
//             { timestamp: 0, eventType: EventType.HOME }
//         ]


//         repository.getUserAndEventsFromStartTime.resolves(events)

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
//     })

//     it('should calculate score with single home event', async () => {
//         clock = sinon.useFakeTimers({
//             now: 24 * 60 * 60 * 1000 * 2 //2 days after 0
//         });
//         const repository = stubInterface<Repository>()
//         const events: EventFull[] = [
//             {
//                 timestamp: 100000,
//                 eventType: EventType.HOME,
//                 id: "asdf",
//                 userId: "asdf",
//                 userLocation: {
//                     latitude: 1234,
//                     longitude: 1234
//                 }
//             },
//         ]
//         repository.getUserAndEventsFromStartTime.resolves([] as EventFull[])
//         repository.getLatestEventForUser.resolves(events[0])

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
//     })


//     it('should calculate score with single away event', async () => {
//         clock = sinon.useFakeTimers({
//             now: 24 * 60 * 60 * 1000 * 2 //2 days after 0
//         });
//         const repository = stubInterface<Repository>()
//         const events: EventFull[] = [
//             {
//                 timestamp: 100000,
//                 eventType: EventType.AWAY,
//                 id: "asdf",
//                 userId: "asdf",
//                 userLocation: {
//                     latitude: 1234,
//                     longitude: 1234
//                 }
//             },
//         ]
//         repository.getUserAndEventsFromStartTime.resolves([] as EventFull[])
//         repository.getLatestEventForUser.resolves(events[0])

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
//     })

//     it('should calculate score with multiple duplicate events', async () => {
//         const repository = stubInterface<Repository>()
//         const events: Event[] = [
//             { timestamp: 100000, eventType: EventType.HOME },
//             { timestamp: 200000, eventType: EventType.HOME },
//             { timestamp: 300000, eventType: EventType.AWAY },
//             { timestamp: 400000, eventType: EventType.HOME },
//             { timestamp: 500000, eventType: EventType.AWAY },
//             { timestamp: 600000, eventType: EventType.AWAY },
//             { timestamp: 700000, eventType: EventType.HOME },
//             { timestamp: 800000, eventType: EventType.AWAY },
//         ]


//         repository.getUserAndEventsFromStartTime.resolves(events)

//         const userId = "1234"
//         const score = await calculateScore(userId, repository)
//         assert.equal(Math.fround(score), Math.fround(0.4629629629629629), "Scores do not match!")
//     })
// })