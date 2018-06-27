// Jimoo - feedback controler
// web ui and mongo controller for the feedback interactions (provide feedback on event)
//

module.exports = function (app) {

    // require Helper functions
    var helper = require('./helpers')

    // load Event model for mongo
    var Event = require('../models/eventModel')

    // load UI data model 
    var ui = require('../models/uiDataModel')

    // 1 - Show PIN entry form
    // 
    // called from: /
    // displays: pin entry form
    //
    // loads the pin entry form
    //
    app.get('/', function (req, res) {

        helper.resetUI()

        // ui flow
        ui.flow.timestamp = new Date(Date.now())
        ui.flow.activateDiv = 'pin-div'
        ui.flow.activateButton = 'pin-button'

        res.setHeader('Content-Type', 'text/html');
        res.render('./index.ejs', {
            ui: ui
        })
    })

   

    // 2 - Show Feedback entry form based on PIN
    // 
    // called from: /
    // displays: pin entry form
    //
    // loads the pin entry form
    //
    app.post('/feedback', function (req, res) {

        

        var pin = req.body.pin1 + '-' + req.body.pin2
        
        var query = {
            'event.pin': pin,
            'event.deleted': false
        }

        Event.findOne(query, function (err, event) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                res.status(200)
                ui.data.event.id = event.id
                ui.data.event.name = event.event.name
                ui.data.event.location = event.event.location
                ui.data.event.presenter = event.event.presenter
                ui.data.event.email = event.event.email
                ui.data.event.notes = event.event.notes
                ui.data.event.pin = event.event.pin
                ui.data.event.start = event.event.start
                ui.data.event.end = event.event.end

                // ui flow
                ui.flow.timestamp = new Date(Date.now())
                ui.flow.activateDiv = 'feedback-div'
                ui.flow.activateButton = 'feedback-button'

                res.setHeader('Content-Type', 'text/html');
                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })


    })


}