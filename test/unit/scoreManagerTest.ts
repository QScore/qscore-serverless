import * as scoreManager from '../../src/score/scoreManager'
import sinon from "ts-sinon";
import * as assert from 'assert'
import { Event } from '../../src/data/model/Types';

let clock: sinon.SinonFakeTimers
// const repository = stubInterface<Repository>()
// repository.getUserAndEventsFromStartTime.resolves(events)



describe('updateScore', function () {
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
            }
        ]
        const score = scoreManager.calculateScore(events)
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

        const score = scoreManager.calculateScore(events)
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

        const score = scoreManager.calculateScore(events)
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





        const score = scoreManager.calculateScore(events)
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

        const score = scoreManager.calculateScore(events)
        assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
    })

    it('should calculate score with single home event', async () => {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000 * 2 //2 days after 0
        });

        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "HOME",
                userId: "na"
            },
        ]

        const score = scoreManager.calculateScore(events)
        assert.equal(Math.fround(score), Math.fround(100), "Scores do not match!")
    })


    it('should calculate score with single away event', async () => {
        clock = sinon.useFakeTimers({
            now: 24 * 60 * 60 * 1000 * 2 //2 days after 0
        });
        const events: Event[] = [
            {
                timestamp: new Date(100000).toISOString(),
                eventType: "AWAY",
                userId: "na"
            },
        ]

        const score = scoreManager.calculateScore(events)
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

        const score = scoreManager.calculateScore(events)
        assert.equal(Math.fround(score), Math.fround(0.4629629629629629), "Scores do not match!")
    })
})