// Jimoo - feedback admin controler
// web ui and mongo controller for the admin interactions (event management)
//

module.exports = function (app) {

    // load Event model for mongo
    var Event = require('../models/eventModel')

     // load UI data model 
     var ui = require('../models/uiDataModel')

    //  todays date and time (used as default event dates)
    var dateNow = new Date(Date.now()).toISOString().split('T')[0]
    var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

    //  todays date & todays date + 1 month (as default ui)
    var thisYear = new Date(Date.now()).getFullYear()
    var thisMonth = new Date(Date.now()).getMonth()
    var StartDate = new Date(thisYear, thisMonth, 2).toISOString().split('T')[0]
    var EndDate = new Date(thisYear, thisMonth + 1, 2).toISOString().split('T')[0]


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


    // 1 - List events (default admin view)
    // 
    // called from: 
    // displays: 
    //
    // loads default event list for current month
    // 
    app.get('/admin', function (req, res) {

        // init the UI  object
        resetUI()

        // prepare dates to be used by mongo filter
        var startdate = new Date(ui.dates.listStartDate + ' 00:00:00')
        var enddate = new Date(ui.dates.listStartDate + ' 24:00:00')

        var query = {
            'event.start': {
                $gte: startdate,
                $lte: enddate
            },
            'event.deleted': false
        }

        Event.find(query, function (err, events) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                res.status(200)
                ui.data.listResults = events
            }

            // ui flow
            ui.flow.timestamp = new Date(Date.now())
            ui.flow.activateDiv = 'list-div'
            ui.flow.activateButton = 'list-button'

            res.setHeader('Content-Type', 'text/html');
            res.render('./index.ejs', {
                ui: ui
            })
        })

    })


    // 2A. Create event 
    // called from : create screen, OK button
    // displays : create event confirmation screen
    // 
    // captures form event data into ui object + generates PIN 
    //
    app.post('/admin/event/create-ok', function (req, res) {

        ui.data.event.name = req.body.name
        ui.data.event.location = req.body.location
        ui.data.event.presenter = req.body.presenter
        ui.data.event.email = req.body.email
        ui.data.event.notes = req.body.notes
        ui.data.event.startdate = req.body.startdate
        ui.data.event.starttime = req.body.starttime
        ui.data.event.enddate = req.body.enddate
        ui.data.event.endtime = req.body.endtime

        // ui flow       
        var date = new Date(Date.now())
        ui.flow.timestamp = date
        ui.flow.activateDiv = 'create-confirmation-div'
        ui.flow.activateButton = 'create-button'


        // if we don't have a PIN, generate it
        if (ui.data.event.pin == null) {
            makePin(0, function (err, pincode) {
                if (err) {
                    res.status(500)
                    res.send(err)
                } else {
                    res.status(200)
                    ui.data.event.pin = pincode

                    res.render('./index.ejs', {
                        ui: ui
                    })
                }
            })
        } else {
            res.status(200)
            // render confirmation screen
            res.render('./index.ejs', {
                ui: ui
            })
        }
    })


    // 2B. Create event
    // called from : event creation confirmation screen, ok button
    // displays : event created and PIN screen
    //
    // creates mongo doc if pin doesn't exist, otherwise updates it (supporting modify functions)
    //
    app.get('/admin/event/create-confirm-ok', function (req, res) {

        // PIN maker helper function
        // generates random 5 char code + checks if collision exists in mongo

        // setup date and time for mongo insert
        var startd = new Date(ui.data.event.startdate + " " + ui.data.event.starttime)
        var endd = new Date(ui.data.event.enddate + " " + ui.data.event.endtime)

        // match on PIN
        var query = {
            'event.pin': ui.data.event.pin,
            'event.deleted': false
        }

        var data = {
            event: {
                name: ui.data.event.name,
                location: ui.data.event.location,
                presenter: ui.data.event.presenter,
                email: ui.data.event.email,
                notes: ui.data.event.notes,
                start: startd,
                end: endd,
                pin: ui.data.event.pin,
                deleted: false
            }
        }

        // ui flow
        var date = new Date(Date.now())
        ui.flow.timestamp = date
        ui.flow.activateDiv = 'event-created-div'
        ui.flow.activateButton = 'create-button'

        // find pin, if found updated it, if not create new doc (option upsert = true)
        Event.findOneAndUpdate(query, data, {
            upsert: true
        }, function (err, event) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                res.status = 201
                // redirect to save screen
                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })
    })


    // 2C. Create event 
    // called from: confirm screen, back button
    // displays: create event form
    //
    // redisplayes the event creation form
    //
    app.get('/admin/event/create-confirm-cancel', function (req, res) {

        // ui flow
        var date = new Date(Date.now())
        ui.flow.timestamp = date
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton = 'create-button'

        res.status(200)
        res.render('./index.ejs', {
            ui: ui
        })
    })

    // 3. List Events 
    //
    // called from: list events button
    // displays: list of events with opton to modify or delete them
    //
    // gets event list from mongo and loads ui object with them
    app.post('/admin/event/list', function (req, res) {


        // reset anything in the event ui object
        resetUI()

        // prepare form dates to be used by mongo filter
        var startdate = new Date(req.body.lstartdate + ' 00:00:00')
        var enddate = new Date(req.body.lenddate + ' 24:00:00')

        // set UI date defaults to form dates
        ui.dates.listStartDate = req.body.lstartdate
        ui.dates.listEndDate = req.body.lenddate

        var query = {
            'event.start': {
                $gte: startdate,
                $lte: enddate
            },
            'event.deleted': false
        }

        Event.find(query, function (err, events) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                res.status(200)
                ui.data.listResults = events
            }

            // ui flow
            ui.flow.timestamp = new Date(Date.now())
            ui.flow.activateDiv = 'list-div'
            ui.flow.activateButton = 'list-button'

            res.render('./index.ejs', {
                ui: ui
            })
        })
    })


    // 3. Modify Event 
    //
    // called from : modify button on event list
    // displays: the event creation screen prepopulated so it can be modified
    //
    // finds mongo object by id, loads event UI object
    app.get('/admin/event/modify/:id', function (req, res) {

        // set timestamp & init ui flow
        ui.flow.timestamp = new Date(Date.now())
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton = 'create-button'
        ui.flow.function = 'modify'

        var id = req.params.id;

        // find document and set ui object with it's value
        Event.findById(id, function (err, event) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                ui.data.event.id = id
                ui.data.event.name = event.event.name
                ui.data.event.location = event.event.location
                ui.data.event.presenter = event.event.presenter
                ui.data.event.email = event.event.email
                ui.data.event.notes = event.event.notes
                ui.data.event.pin = event.event.pin
                ui.data.event.start = event.event.start
                ui.data.event.end = event.event.end

                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })
    })


    // 4A. Delete Event 
    //
    // called from: delete event button from event list
    // displays: delete confirmation screen
    //
    // gets event data from mongo and loads ui object
    app.get('/admin/event/delete/:id', function (req, res) {

        // set timestamp & init ui flow
        ui.flow.timestamp = new Date(Date.now())
        ui.flow.activateDiv = 'delete-confirmation-div'
        ui.flow.activateButton = 'list-button'
        ui.flow.function = 'delete'

        var id = req.params.id;

        // find document and set ui object with it's value
        Event.findById(id, function (err, event) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
                ui.data.event.id = id
                ui.data.event.name = event.event.name
                ui.data.event.location = event.event.location
                ui.data.event.presenter = event.event.presenter
                ui.data.event.email = event.event.email
                ui.data.event.notes = event.event.notes
                ui.data.event.pin = event.event.pin
                ui.data.event.start = event.event.start
                ui.data.event.end = event.event.end

                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })
    })


    // 4B. Delete Event 
    // 
    // called from: ok button on delete confirmation screen
    // displays: goes back to event list
    //
    // finds mongo object by ID and soft deletes it (event.deleted attrib = true)
    app.get('/admin/event/delete-confirm-ok', function (req, res) {

        // set timestamp & init ui flow
        ui.flow.timestamp = new Date(Date.now())
        ui.flow.activateDiv = 'list-div'
        ui.flow.activateButton = 'list-button'
        ui.flow.function = 'delete'

        var id = ui.data.event.id;

        // find document and set ui object with it's value
        Event.findByIdAndUpdate(id, { 'event.deleted': true }, function (err, event) {
            if (err) {
                res.status(500)
                res.send(err)
            } else {
            
                resetUI()
                res.render('./index.ejs', {
                    ui: ui
                })
            }
        })
    })
}