import {updateScore} from './scoreManager.js'

exports.handler = async (event) => {
    const newEvents = event.Records
        .filter(record => record.eventName == 'INSERT')
        .map(record => record.dynamodb.NewImage)

    await updateScore(newEvents)
}