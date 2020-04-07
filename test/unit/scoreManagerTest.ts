import { calculateScore } from '../../score/scoreManager'
import sinon, { stubInterface } from "ts-sinon";
import '../../data/model/Event'
import '../../data/model/User'
import '../../data/Repository'
import * as moment from 'moment'
import * as assert from 'assert'

let clock: sinon.SinonFakeTimers

beforeEach(async function () {
    clock = sinon.useFakeTimers({
        now: moment.duration(1, 'd').asMilliseconds()
    });
})

afterEach(function () {
    clock.restore();
})

describe('updateScore', function () {
    it('should calculate score with first event Home', async () => {
        // const oneDayMillis = moment.duration(1,'d').asMilliseconds()
        const repository = stubInterface<Repository>()
        const events:Event[] = [
            { timestamp: 100000, eventType: "HOME" },
            { timestamp: 200000, eventType: "AWAY" }
        ]

        // const result = new Promise<Event[]>(() => events)
        repository.getEventsFrom.resolves(events)

        const userId = "1234"
        const score = await calculateScore(userId, repository)
        assert.equal(Math.fround(score), Math.fround(0.11574074074074073), "Scores do not match!")
    })

    it('should calculate score with first event Away', async () => {
        // const oneDayMillis = moment.duration(1,'d').asMilliseconds()
        const repository = stubInterface<Repository>()
        const events:Event[] = [
            { timestamp: 100000, eventType: "AWAY" },
            { timestamp: 200000, eventType: "HOME" }
        ]

        // const result = new Promise<Event[]>(() => events)
        repository.getEventsFrom.resolves(events)

        const userId = "1234"
        const score = await calculateScore(userId, repository)
        assert.equal(Math.fround(score), Math.fround(99.88426208496094), "Scores do not match!")
    })

    it('should calculate score with only one away event at time 100000', async () => {
        // const oneDayMillis = moment.duration(1,'d').asMilliseconds()
        const repository = stubInterface<Repository>()
        const events:Event[] = [
            { timestamp: 100000, eventType: "AWAY" }
        ]

        // const result = new Promise<Event[]>(() => events)
        repository.getEventsFrom.resolves(events)

        const userId = "1234"
        const score = await calculateScore(userId, repository)
        assert.equal(Math.fround(score), Math.fround(0.11574074074074073), "Scores do not match!")
    })

    it('should calculate score with only one away event at time 0', async () => {
        // const oneDayMillis = moment.duration(1,'d').asMilliseconds()
        const repository = stubInterface<Repository>()
        const events:Event[] = [
            { timestamp: 0, eventType: "AWAY" }
        ]

        // const result = new Promise<Event[]>(() => events)
        repository.getEventsFrom.resolves(events)

        const userId = "1234"
        const score = await calculateScore(userId, repository)
        assert.equal(Math.fround(score), Math.fround(0), "Scores do not match!")
    })

    it('should calculate score with only one home event at time 0', async () => {
        // const oneDayMillis = moment.duration(1,'d').asMilliseconds()
        const repository = stubInterface<Repository>()
        const events:Event[] = [
            { timestamp: 0, eventType: "HOME" }
        ]

        // const result = new Promise<Event[]>(() => events)
        repository.getEventsFrom.resolves(events)

        const userId = "1234"
        const score = await calculateScore(userId, repository)
        assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
    })

    it('should calculate score with multiple duplicate events', async () => {
        // const oneDayMillis = moment.duration(1,'d').asMilliseconds()
        const repository = stubInterface<Repository>()
        const events:Event[] = [
            { timestamp: 100000, eventType: "HOME" },
            { timestamp: 200000, eventType: "HOME" },
            { timestamp: 300000, eventType: "AWAY" },
            { timestamp: 400000, eventType: "HOME" },
            { timestamp: 500000, eventType: "AWAY" },
            { timestamp: 600000, eventType: "AWAY" },
            { timestamp: 700000, eventType: "HOME" },
            { timestamp: 800000, eventType: "AWAY" },
        ]

        // const result = new Promise<Event[]>(() => events)
        repository.getEventsFrom.resolves(events)

        const userId = "1234"
        const score = await calculateScore(userId, repository)
        assert.equal(Math.fround(score), Math.fround(0.4629629629629629), "Scores do not match!")
    })
})