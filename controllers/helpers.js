
// load UI data model 
var ui = require('../models/uiDataModel')
var Event = require('../models/eventModel')

// Helper - reset UI data
function resetUI() {

    ui.data.event = {
        name: null,
        location: null,
        presenter: null,
        start: null,
        end: null,
        email: null,
        notes: null,
        pin: null
    }

    ui.data.listResults = []
}
exports.resetUI = resetUI




// Helper - make PIN
function makePin(attempts, callback) {

    if (attempts >= 20) {
        console.log('ERROR, pin generation failed after too many collisions (20)')
        callback('too may attempts at pin generation', null)
    }

    var text = ""
    var possible = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (var i = 0; i <= 6; i++) {
        if (i == 3) {
            text += '-'
        } else {
            text += possible.charAt(Math.floor(Math.random() * possible.length))
        }
    }

    var query = {
        'event.pin': text,
        'deleted': false
    }

    // check PIN doesn't already exist
    Event.find(query, function (err, result) {

        if (err) {
            callback(err, null) // error
        } else {
            if (result.length) {
                attempts++
                console.log('WARNING, collision detected in pin generation attempt', 1)
                makePin(attempts, callback)

            } else {
                callback(null, text) // no pin collision all good
            }
        }
    })
}
exports.makePin = makePin
