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
    // called from: pin-div
    // displays: pin entry form
    //
    // loads the pin entry form
    //
    app.post('/feedback/pin', function (req, res) {


        var pin = req.body.pin1.toUpperCase() + '-' + req.body.pin2.toUpperCase()

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

                ui.data.feedback = event.feedback


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



    // 3 - Capture feedback, update event and show confirmation
    // 
    // called from: feedback-div
    // displays: feedback confirmation 
    //
    // captures feedback from form, finds event, calculates feedback array 
    //
    app.post('/feedback', function (req, res) {

        var feedbackDate = new Date(Date.now())

        // find out how many feedback entries we have so far so we can add more later



        var feedback = {
            rating: {
                event: Number(req.body.event),
                presenter: Number(req.body.presenter),
                engaging: Number(req.body.engaging),
                innovative: Number(req.body.innovative),
                inspiring: Number(req.body.inspiring),
                informative: Number(req.body.informative)
            },
            notes: req.body.notes,
            name: req.body.name,
            email: req.body.email,
            date: feedbackDate
        }

        console.log(JSON.stringify(feedback, null, 3))

        // ui flow
        var date = new Date(Date.now())
        ui.flow.timestamp = date
        ui.flow.activateDiv = 'feedback-confirmation-div'
        ui.flow.activateButton = 'feedback-button'

        // find pin, if found updated it, if not create new doc (option upsert = true)
        Event.findByIdAndUpdate( ui.data.event.id, {
            $push: {
                feedback: feedback
            }
        }, function (err, event) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                res.status = 200

                console.log(event)

                // ui flow
                ui.flow.timestamp = new Date(Date.now())
                ui.flow.activateDiv = 'feedback-confirmation-div'
                ui.flow.activateButton = 'feedback-button'

                res.setHeader('Content-Type', 'text/html');
                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })

    })



}